const db = require("../models");
const User = db.User;
const Role = db.Role;
const Group = db.Group;
const Facility = db.Facility;
const PasswordHistory = db.PasswordHistory;
const { Op } = require("sequelize");
const { auditHelper } = require("../utils/auditHelper");
const { syncADUsers } = require("../utils/adHelper");
const { getUserFacilities, applyFacilityFilter } = require("../utils/facilityFilter");
const bcrypt = require("bcryptjs");

exports.findAll = async (req, res) => {
  try {
    // ✅ Search & limit from query params
    const { search, limit } = req.query;

    let query = {
      attributes: ["id", "employeeId", "username", "fullName", "department", "departmentId", "designation", "isActive", "email"],
      include: [
        { model: Role, as: "roles", attributes: ["roleName"] },
        { model: Group, as: "groups", attributes: ["groupName"] },
        { model: Facility, as: "facilities", attributes: ["id", "name"] },
        { model: Facility, as: "departmentFacility", attributes: ["id", "name"] },
      ],
      order: [["fullName", "ASC"]],
    };

    // ✅ Search filter (fullName or username)
    if (search) {
      query.where = {
        [Op.or]: [
          { fullName: { [Op.iLike]: `%${search}%` } },
          { username: { [Op.iLike]: `%${search}%` } },
        ],
      };
    }

    // ✅ Limit (only for search endpoints)
    if (limit) {
      query.limit = parseInt(limit, 10);
    }

    const selectedFacilityId = req.headers["x-facility-id"];
    const userFacs = await getUserFacilities(req.userId, selectedFacilityId);

    if (userFacs !== null) {
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
        { model: Facility, as: "facilities" },
        { model: Facility, as: "departmentFacility", attributes: ["id", "name"] },
      ],
    });
    if (!user) return res.status(404).send({ message: "User not found" });
    res.send(user);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { password, roles, groups, facilityIds, departmentId, ...userData } = req.body;

    let hashedPassword = null;
    let expiryDate = null;
    if (password) {
      hashedPassword = bcrypt.hashSync(password, 8);
      expiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    }

    let departmentName = userData.department || "";
    if (departmentId) {
      const deptFacility = await Facility.findByPk(departmentId);
      if (deptFacility) {
        departmentName = deptFacility.name;
      }
    }

    const user = await User.create({
      ...userData,
      department: departmentName,
      departmentId: departmentId || null,
      passwordHash: hashedPassword,
      passwordExpiryDate: expiryDate,
      createdBy: req.userId,
    });

    let roleNames = roles || [];
    if (roleNames.length === 0) roleNames = ["User"];
    const roleRecords = await Role.findAll({ where: { roleName: roleNames } });
    await user.setRoles(roleRecords);

    let groupNames = groups || [];
    if (groupNames.length === 0) groupNames = ["User"];
    const groupRecords = await Group.findAll({ where: { groupName: groupNames } });
    await user.setGroups(groupRecords);

    if (facilityIds && facilityIds.length) {
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

    if (hashedPassword) {
      await PasswordHistory.create({ userId: user.id, passwordHash: hashedPassword });
    }

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
    console.error("User create error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [
        { model: Role, as: "roles" },
        { model: Group, as: "groups" },
        { model: Facility, as: "facilities" },
        { model: Facility, as: "departmentFacility", attributes: ["id", "name"] },
      ],
    });
    if (!user) return res.status(404).send({ message: "User not found" });

    const oldClean = {
      Username: user.username,
      "Full Name": user.fullName,
      Email: user.email,
      Department: user.department,
      Designation: user.designation,
      "Employee ID": user.employeeId,
      "Joining Date": user.joiningDate || "—",
      "Date Of Birth": user.dateOfBirth || "—",
      "Contact Details": user.contactDetails ? JSON.stringify(user.contactDetails) : "—",
      "Reporting Manager": user.reportingManager || "—",
      Status: user.isActive ? "Active" : "Inactive",
      "System Roles": user.roles.map(r => r.roleName).join(", ") || "—",
      "System Groups": user.groups.map(g => g.groupName).join(", ") || "—",
      "Facilities": user.facilities.map(f => f.name).join(", ") || "—",
    };

    const { password, roles, groups, facilityIds, departmentId, ...userData } = req.body;

    if (password) {
      const lastPasswords = await PasswordHistory.findAll({
        where: { userId: user.id },
        order: [["createdAt", "DESC"]],
        limit: 5,
      });
      const isReused = lastPasswords.some(ph => bcrypt.compareSync(password, ph.passwordHash));
      if (isReused) {
        return res.status(400).send({ message: "Password cannot be the same as any of your last 5 passwords" });
      }
      userData.passwordHash = bcrypt.hashSync(password, 8);
      userData.passwordExpiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      await PasswordHistory.create({ userId: user.id, passwordHash: userData.passwordHash });
      await auditHelper("USER", user.id, "PASSWORD_RESET", null, { Username: user.username, "Password Reset": "Yes" }, req.userId, req.ip, "Password reset by administrator");
    }

    if (departmentId !== undefined) {
      const deptFacility = departmentId ? await Facility.findByPk(departmentId) : null;
      userData.department = deptFacility ? deptFacility.name : user.department;
      userData.departmentId = departmentId || null;
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
      const requestedFacilities = await Facility.findAll({ where: { id: facilityIds } });
      const validFacilities = requestedFacilities.filter(f => f.type === "FACTORY");
      await user.setFacilities(validFacilities);
    }

    await user.reload({
      include: [
        { model: Role, as: "roles" },
        { model: Group, as: "groups" },
        { model: Facility, as: "facilities" },
        { model: Facility, as: "departmentFacility", attributes: ["id", "name"] },
      ],
    });

    const newClean = {
      Username: user.username,
      "Full Name": user.fullName,
      Email: user.email,
      Department: user.department,
      Designation: user.designation,
      "Employee ID": user.employeeId,
      "Joining Date": user.joiningDate || "—",
      "Date Of Birth": user.dateOfBirth || "—",
      "Contact Details": user.contactDetails ? JSON.stringify(user.contactDetails) : "—",
      "Reporting Manager": user.reportingManager || "—",
      Status: user.isActive ? "Active" : "Inactive",
      "System Roles": user.roles.map(r => r.roleName).join(", ") || "—",
      "System Groups": user.groups.map(g => g.groupName).join(", ") || "—",
      "Facilities": user.facilities.map(f => f.name).join(", ") || "—",
    };

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

    await auditHelper("USER", user.id, "UPDATED", changedOld, changedNew, req.userId, req.ip, "User updated");

    res.send(user);
  } catch (error) {
    console.error("User update error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [
        { model: Role, as: "roles" },
        { model: Group, as: "groups" },
        { model: Facility, as: "facilities" },
      ],
    });
    if (!user) return res.status(404).send({ message: "User not found" });

    const oldClean = {
      Username: user.username,
      "Full Name": user.fullName,
      Email: user.email,
      Department: user.department,
      Designation: user.designation,
      "Employee ID": user.employeeId,
      Status: user.isActive ? "Active" : "Inactive",
    };

    await user.destroy();
    await auditHelper("USER", req.params.id, "DELETED", oldClean, null, req.userId, req.ip, "User deleted");
    res.send({ message: "User deleted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getProfileWithAppRoles = async (req, res) => {
  try {
    const userId = req.userId;
    const { applicationId } = req.query;

    const user = await User.findByPk(userId, {
      attributes: { exclude: ["passwordHash"] },
      include: [
        { model: Role, as: "roles" },
        { model: Group, as: "groups" },
        { model: Facility, as: "facilities" },
        { model: Facility, as: "departmentFacility", attributes: ["id", "name"] },
      ],
    });
    if (!user) return res.status(404).send({ message: "User not found" });

    let applicationRoles = [];
    let applicationGroups = [];

    if (applicationId) {
      const userAppRoles = await db.UserApplicationRole.findAll({
        where: { userId },
        include: [{ model: db.ApplicationRole, where: { applicationId } }],
      });
      applicationRoles = userAppRoles.map(ur => ur.applicationRole.roleName);

      const userAppGroups = await db.UserApplicationGroup.findAll({
        where: { userId },
        include: [{ model: db.ApplicationGroup, where: { applicationId } }],
      });
      applicationGroups = userAppGroups.map(ug => ug.applicationGroup.groupName);
    }

    res.send({
      ...user.toJSON(),
      applicationRoles,
      applicationGroups,
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
        if (!row.employeeId || !row.username || !row.email || !row.fullName ||
            !row.department || !row.designation || !row.joiningDate) {
          errors.push({ row, error: "Missing mandatory field" });
          continue;
        }

        let contactDetails = {};
        if (row.contactDetails) {
          try { contactDetails = JSON.parse(row.contactDetails); } catch (e) { contactDetails = { phone: row.contactDetails }; }
        }

        // DepartmentId support (optional)
        let departmentId = null;
        if (row.departmentId) {
          departmentId = parseInt(row.departmentId) || null;
        }

        const userData = {
          employeeId: row.employeeId,
          username: row.username,
          domainUserId: row.domainUserId || row.username,
          email: row.email,
          fullName: row.fullName,
          department: row.department,
          departmentId,
          designation: row.designation,
          joiningDate: row.joiningDate,
          contactDetails,
          reportingManager: row.reportingManager || null,
          dateOfBirth: row.dateOfBirth || null,
          passwordHash: null,
        };

        const user = await User.create(userData);

        const defaultRole = await Role.findOne({ where: { roleName: "User" } });
        if (defaultRole) await user.addRole(defaultRole);

        const defaultGroup = await Group.findOne({ where: { groupName: "User" } });
        if (defaultGroup) await user.addGroup(defaultGroup);

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

exports.downloadSampleCsv = async (req, res) => {
  const csvContent =
    "employeeId,username,domainUserId,email,fullName,department,departmentId,designation,joiningDate,contactDetails,reportingManager,dateOfBirth\n" +
    'EMP001,john.doe,john.doe,john@pharma.com,John Doe,Quality,1,HOD,2023-01-15,"{""phone"":""1234567890""}",Jane Smith,1990-05-20\n' +
    'EMP002,jane.smith,jane.smith,jane@pharma.com,Jane Smith,IT,2,Administrator,2022-06-01,"{""phone"":""0987654321""}",,1988-11-12';

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=sample_users.csv");
  res.send(csvContent);
};