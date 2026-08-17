const db = require("../models");
const User = db.User;
const Role = db.Role;
const Group = db.Group;
const Facility = db.Facility;
const PasswordHistory = db.PasswordHistory;
const { auditHelper } = require("../utils/auditHelper");
const { syncADUsers } = require("../utils/adHelper");
const { getUserFacilities, applyFacilityFilter } = require("../utils/facilityFilter");
const bcrypt = require("bcryptjs");

exports.findAll = async (req, res) => {
  try {
    let query = {
      attributes: ["id", "employeeId", "username", "fullName", "department", "designation", "isActive", "email"],
      include: [
        { model: Role, as: "roles", attributes: ["roleName"] },
        { model: Group, as: "groups", attributes: ["groupName"] },
        { model: Facility, as: "facilities", attributes: ["id", "name"] }
      ],
      order: [["fullName", "ASC"]],
    };

    // ✅ Get user's facility IDs (with optional header)
    const selectedFacilityId = req.headers['x-facility-id'];
    const userFacs = await getUserFacilities(req.userId, selectedFacilityId);

    // Non‑admins see only users that share at least one facility with them
    if (userFacs !== null) {
      // Filter users that belong to any of those facilities
      query.include[2].where = { id: userFacs };
      query.include[2].required = true;
    }

    const users = await User.findAll(query);
    res.send(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["passwordHash"] },
      include: [
        { model: Role, as: "roles" },
        { model: Group, as: "groups" },
        { model: Facility, as: "facilities" }
      ]
    });
    if (!user) return res.status(404).send({ message: "User not found" });
    res.send(user);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { password, roles, groups, facilityIds, ...userData } = req.body;
    let hashedPassword = null;
    let expiryDate = null;

    if (password) {
      hashedPassword = bcrypt.hashSync(password, 8);
      expiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
    }

    const user = await User.create({
      ...userData,
      passwordHash: hashedPassword,
      passwordExpiryDate: expiryDate,   // ✅ set expiry
      createdBy: req.userId,
    });

    // Assign roles (default "User" if none provided)
    let roleNames = roles || [];
    if (roleNames.length === 0) roleNames = ["User"];
    const roleRecords = await Role.findAll({ where: { roleName: roleNames } });
    await user.setRoles(roleRecords);

    // Assign groups (default "User" if none provided)
    let groupNames = groups || [];
    if (groupNames.length === 0) groupNames = ["User"];
    const groupRecords = await Group.findAll({ where: { groupName: groupNames } });
    await user.setGroups(groupRecords);

    // Assign facilities
    if (facilityIds && facilityIds.length) {
      // ✅ केवल फैक्ट्री सुविधाएँ चुनें
      const requestedFacilities = await Facility.findAll({ where: { id: facilityIds } });
      const validFacilities = requestedFacilities.filter(f => f.type === "FACTORY");
      await user.setFacilities(validFacilities);
    } else {
      const creatorFacs = await getUserFacilities(req.userId);
      if (creatorFacs && creatorFacs.length > 0) {
        const defaultFac = await Facility.findByPk(creatorFacs[0]);
        if (defaultFac) await user.addFacility(defaultFac);
      }
    }

    // ✅ Save password to history (only if password was provided)
    if (hashedPassword) {
      await PasswordHistory.create({ userId: user.id, passwordHash: hashedPassword });
    }

    // AUDIT
    const cleanNewValue = {
      Username: user.username,
      "Full Name": user.fullName,
      Email: user.email,
      Department: user.department,
      Designation: user.designation,
      "Employee ID": user.employeeId,
      Status: user.isActive ? "Active" : "Inactive",
    };
    await auditHelper("USER", user.id, "CREATED", null, cleanNewValue, req.userId, req.ip, "User created");

    res.status(201).send({ message: "User created", userId: user.id });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [
        { model: Role, as: "roles" },
        { model: Group, as: "groups" },
        { model: Facility, as: "facilities" }
      ]
    });
    if (!user) return res.status(404).send({ message: "User not found" });

    // ---- old readable values ----
    const oldClean = {
      Username: user.username,
      "Full Name": user.fullName,
      Email: user.email,
      Department: user.department,
      Designation: user.designation,
      "Employee ID": user.employeeId,
      "Joining Date": user.joiningDate || '—',
      "Date Of Birth": user.dateOfBirth || '—',
      "Contact Details": user.contactDetails ? JSON.stringify(user.contactDetails) : '—',
      "Reporting Manager": user.reportingManager || '—',
      Status: user.isActive ? 'Active' : 'Inactive',
      "System Roles": user.roles.map(r => r.roleName).join(', ') || '—',
      "System Groups": user.groups.map(g => g.groupName).join(', ') || '—',
      "Facilities": user.facilities.map(f => f.name).join(', ') || '—',
    };

    const { password, roles, groups, facilityIds, ...userData } = req.body;

    // ✅ Password history & expiry logic
    if (password) {
      // Check password history (last 5 passwords)
      const lastPasswords = await PasswordHistory.findAll({
        where: { userId: user.id },
        order: [['createdAt', 'DESC']],
        limit: 5
      });
      const isReused = lastPasswords.some(ph => bcrypt.compareSync(password, ph.passwordHash));
      if (isReused) {
        return res.status(400).send({ message: "Password cannot be the same as any of your last 5 passwords" });
      }

      userData.passwordHash = bcrypt.hashSync(password, 8);
      userData.passwordExpiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      // Save new password to history
      await PasswordHistory.create({ userId: user.id, passwordHash: userData.passwordHash });

      // ✅ Password reset audit
      await auditHelper(
        "USER", user.id, "PASSWORD_RESET",
        null,
        { Username: user.username, "Password Reset": "Yes" },
        req.userId, req.ip,
        "Password reset by administrator"
      );
    }

    await user.update({ ...userData, updatedBy: req.userId });

    if (roles !== undefined) {
      const roleRecords = await Role.findAll({ where: { roleName: roles } });
      await user.setRoles(roleRecords);
    }
    if (groups !== undefined) {
      const groupRecords = await Group.findAll({ where: { groupName: groups } });
      await user.setGroups(groupRecords);
    }
    if (facilityIds !== undefined) {
      // ✅ केवल फैक्ट्री सुविधाएँ चुनें
      const requestedFacilities = await Facility.findAll({ where: { id: facilityIds } });
      const validFacilities = requestedFacilities.filter(f => f.type === "FACTORY");
      await user.setFacilities(validFacilities);
    }

    await user.reload({
      include: [
        { model: Role, as: "roles" },
        { model: Group, as: "groups" },
        { model: Facility, as: "facilities" }
      ]
    });

    // ---- new readable values ----
    const newClean = {
      Username: user.username,
      "Full Name": user.fullName,
      Email: user.email,
      Department: user.department,
      Designation: user.designation,
      "Employee ID": user.employeeId,
      "Joining Date": user.joiningDate || '—',
      "Date Of Birth": user.dateOfBirth || '—',
      "Contact Details": user.contactDetails ? JSON.stringify(user.contactDetails) : '—',
      "Reporting Manager": user.reportingManager || '—',
      Status: user.isActive ? 'Active' : 'Inactive',
      "System Roles": user.roles.map(r => r.roleName).join(', ') || '—',
      "System Groups": user.groups.map(g => g.groupName).join(', ') || '—',
      "Facilities": user.facilities.map(f => f.name).join(', ') || '—',
    };

    // diff
    const changedOld = {};
    const changedNew = {};
    for (const key of Object.keys(oldClean)) {
      if (oldClean[key] !== newClean[key]) {
        changedOld[key] = oldClean[key];
        changedNew[key] = newClean[key];
      }
    }

    if (Object.keys(changedOld).length > 0) {
      changedOld.Username = user.username;
      changedNew.Username = user.username;
      changedOld["Full Name"] = user.fullName;
      changedNew["Full Name"] = user.fullName;
    }

    await auditHelper(
      "USER", user.id, "UPDATED",
      changedOld, changedNew,
      req.userId, req.ip,
      "User updated"
    );

    res.send(user);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// Delete user

exports.delete = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [
        { model: Role, as: "roles" },
        { model: Group, as: "groups" },
        { model: Facility, as: "facilities" }
      ]
    });
    if (!user) return res.status(404).send({ message: "User not found" });

    const oldClean = {
      Username: user.username,
      "Full Name": user.fullName,
      Email: user.email,
      Department: user.department,
      Designation: user.designation,
      "Employee ID": user.employeeId,
      Status: user.isActive ? 'Active' : 'Inactive',
    };

    await user.destroy();

    await auditHelper("USER", req.params.id, "DELETED", oldClean, null, req.userId, req.ip, "User deleted");
    res.send({ message: "User deleted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// Get current user's profile (for NewRequest etc.)
exports.getProfileWithAppRoles = async (req, res) => {
  try {
    const userId = req.userId;
    const { applicationId } = req.query;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ["passwordHash"] },
      include: [
        { model: Role, as: "roles" },
        { model: Group, as: "groups" },
        { model: Facility, as: "facilities" }
      ]
    });
    if (!user) return res.status(404).send({ message: "User not found" });

    let applicationRoles = [];
    let applicationGroups = [];

    if (applicationId) {
      // User's roles for that application
      const userAppRoles = await db.UserApplicationRole.findAll({
        where: { userId },
        include: [{ model: db.ApplicationRole, where: { applicationId } }]
      });
      applicationRoles = userAppRoles.map(ur => ur.applicationRole.roleName);

      // User's groups for that application
      const userAppGroups = await db.UserApplicationGroup.findAll({
        where: { userId },
        include: [{ model: db.ApplicationGroup, where: { applicationId } }]
      });
      applicationGroups = userAppGroups.map(ug => ug.applicationGroup.groupName);
    }

    res.send({
      ...user.toJSON(),
      applicationRoles,
      applicationGroups
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.syncAD = async (req, res) => {
  try {
    const result = await syncADUsers(req.userId);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// Bulk upload users via CSV
exports.bulkUpload = async (req, res) => {
  const fs = require("fs");
  const csvService = require("../services/csvService");
  if (!req.file) return res.status(400).send({ message: "No CSV file" });

  try {
    const data = await csvService.parseCSV(req.file.path);
    const created = [];
    const errors = [];

    for (const row of data) {
      try {
        // mandatory fields check
        if (!row.employeeId || !row.username || !row.email || !row.fullName ||
            !row.department || !row.designation || !row.joiningDate) {
          errors.push({ row, error: "Missing mandatory field" });
          continue;
        }

        let contactDetails = {};
        if (row.contactDetails) {
          try {
            contactDetails = JSON.parse(row.contactDetails);
          } catch (e) {
            contactDetails = { phone: row.contactDetails };
          }
        }

        const userData = {
          employeeId: row.employeeId,
          username: row.username,
          domainUserId: row.domainUserId || row.username,
          email: row.email,
          fullName: row.fullName,
          department: row.department,
          designation: row.designation,
          joiningDate: row.joiningDate,
          contactDetails,
          reportingManager: row.reportingManager || null,
          dateOfBirth: row.dateOfBirth || null,
          passwordHash: null,
        };

        const user = await User.create(userData);

        // === Default role "User" for every CSV imported user ===
        const defaultRole = await Role.findOne({ where: { roleName: "User" } });
        if (defaultRole) {
          await user.addRole(defaultRole);
        }

        // === Default group "User" (if that group exists) ===
        const defaultGroup = await Group.findOne({ where: { groupName: "User" } });
        if (defaultGroup) {
          await user.addGroup(defaultGroup);
        }

        // If CSV contains a "roles" column (comma separated), assign those as well
        if (row.roles) {
          const extraRoles = row.roles.split(",").map(r => r.trim()).filter(r => r);
          const extraRoleRecords = await Role.findAll({ where: { roleName: extraRoles } });
          await user.addRoles(extraRoleRecords);
        }

        created.push(user);
        await auditHelper("USER", user.id, "BULK_CREATE", null, user.toJSON(), req.userId, req.ip);
      } catch (err) {
        errors.push({ row, error: err.message });
      }
    }

    fs.unlinkSync(req.file.path);
    res.send({
      message: `${created.length} users imported successfully`,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).send({ message: error.message });
  }
};

// Download sample CSV for user bulk upload
exports.downloadSampleCsv = async (req, res) => {
  const csvContent =
    "employeeId,username,domainUserId,email,fullName,department,designation,joiningDate,contactDetails,reportingManager,dateOfBirth\n" +
    'EMP001,john.doe,john.doe,john@pharma.com,John Doe,Quality,HOD,2023-01-15,"{""phone"":""1234567890""}",Jane Smith,1990-05-20\n' +
    'EMP002,jane.smith,jane.smith,jane@pharma.com,Jane Smith,IT,Administrator,2022-06-01,"{""phone"":""0987654321""}",,1988-11-12';

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=sample_users.csv");
  res.send(csvContent);
};