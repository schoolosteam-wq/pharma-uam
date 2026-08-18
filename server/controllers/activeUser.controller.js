const db = require("../models");
const ActiveUser = db.ActiveUserList;
const User = db.User;
const ApplicationRole = db.ApplicationRole;
const ApplicationGroup = db.ApplicationGroup;
const UserApplicationRole = db.UserApplicationRole;
const UserApplicationGroup = db.UserApplicationGroup;
const Application = db.Application;
const csvService = require("../services/csvService");
const fs = require("fs");
const { Op } = require("sequelize");
const { getUserFacilities } = require("../utils/facilityFilter");
const { auditHelper } = require("../utils/auditHelper");

exports.findAll = async (req, res) => {
  try {
    const { applicationId, status } = req.query;

    if (!applicationId) {
      return res.status(400).send({ message: "applicationId is required" });
    }

    const whereActiveUser = { applicationId };
    if (status && status !== "All") {
      whereActiveUser.status = status;
    }

    // ✅ Facility filter – simple और सही
    const allowedFacilityIds = await getUserFacilities(
      req.userId,
      req.headers["x-facility-id"]
    );

    if (allowedFacilityIds !== null) {
      if (allowedFacilityIds.length === 0) {
        whereActiveUser.id = -1;
      } else {
        const userFacilityRecords = await db.UserFacility.findAll({
          where: { facilityId: { [Op.in]: allowedFacilityIds } },
          attributes: ["userId"],
          raw: true,
        });
        const allowedUserIds = userFacilityRecords.map((u) => u.userId);
        whereActiveUser.userId = { [Op.in]: allowedUserIds };
      }
    }

    // ✅ सिर्फ active users की list लाओ
    const activeUsers = await ActiveUser.findAll({
      where: whereActiveUser,
      attributes: ["id", "userId", "applicationId", "username", "status", "createdAt"],
      order: [[ "id", "ASC" ]],
    });

    // ✅ Manual loop से user data और roles/groups fetch करो
    const result = [];
    for (let i = 0; i < activeUsers.length; i++) {
      const au = activeUsers[i];

      // User fetch करो
      const user = await User.findByPk(au.userId, {
        attributes: ["id", "fullName", "username", "email", "employeeId"],
      });
      if (!user) continue;

      // Application roles fetch करो
      const userRoles = await UserApplicationRole.findAll({
        where: { userId: user.id },
        include: [
          {
            model: ApplicationRole,
            where: { applicationId },
            attributes: ["roleName"],
          },
        ],
      });
      const roleNames = userRoles
        .map((ur) => ur.applicationRole?.roleName)
        .filter(Boolean);

      // Application groups fetch करो
      const userGroups = await UserApplicationGroup.findAll({
        where: { userId: user.id },
        include: [
          {
            model: ApplicationGroup,
            where: { applicationId },
            attributes: ["groupName"],
          },
        ],
      });
      const groupNames = userGroups
        .map((ug) => ug.applicationGroup?.groupName)
        .filter(Boolean);

      const roles = [...roleNames, ...groupNames].join(", ") || "—";

      result.push({
        key: au.id,
        srNo: i + 1,
        userId: user.id,
        fullName: user.fullName,
        username: au.username,
        email: user.email || "",
        employeeId: user.employeeId || "",
        roles: roles,
        status: au.status,
        applicationId: au.applicationId,
        createdAt: au.createdAt,
      });
    }

    res.send(result);
  } catch (error) {
    console.error("Active user fetch error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.downloadSampleCsv = async (req, res) => {
  const csvContent =
    "Sr. No,User Name,Emp Code,User ID (Application),Role/Group,Status\n" +
    "1,Test User,EMP001,test.user,Administrator,Active\n" +
    "2,Jane Smith,EMP002,jane.smith,Reviewer / G1,Inactive";

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=sample_active_users.csv"
  );
  res.send(csvContent);
};

exports.bulkUpload = async (req, res) => {
  const { applicationId } = req.body;
  if (!applicationId) {
    return res.status(400).send({ message: "applicationId is required" });
  }
  if (!req.file) {
    return res.status(400).send({ message: "No CSV file uploaded" });
  }

  try {
    const application = await Application.findByPk(applicationId);
    if (!application) {
      return res.status(404).send({ message: "Application not found" });
    }

    const data = await csvService.parseCSV(req.file.path);
    const summary = {
      total: data.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (const row of data) {
      const srNo = row["Sr. No"] || "";
      const empCode = (row["Emp Code"] || "").trim();
      const userIdApp = (row["User ID (Application)"] || "").trim();
      const roleGroupRaw = (row["Role/Group"] || "").trim();
      const statusRaw = (row["Status"] || "Active").trim();

      if (!empCode || !userIdApp) {
        summary.skipped++;
        summary.errors.push({ srNo, reason: "Emp Code or User ID missing" });
        continue;
      }

      // UAM user find by employeeId
      const user = await User.findOne({ where: { employeeId: empCode } });
      if (!user) {
        summary.skipped++;
        summary.errors.push({ srNo, empCode, reason: "User not found in UAM" });
        continue;
      }

      // Role/Group values ko "/" se split karo
      const parts = roleGroupRaw
        .split("/")
        .map((s) => s.trim())
        .filter((s) => s);

      const rolesToAssign = [];
      const groupsToAssign = [];
      let invalidPart = null;

      for (const part of parts) {
        const role = await ApplicationRole.findOne({
          where: { applicationId, roleName: part },
        });
        if (role) {
          rolesToAssign.push(role);
          continue;
        }

        const group = await ApplicationGroup.findOne({
          where: { applicationId, groupName: part },
        });
        if (group) {
          groupsToAssign.push(group);
          continue;
        }

        invalidPart = part;
        break;
      }

      if (invalidPart) {
        summary.skipped++;
        summary.errors.push({
          srNo,
          empCode,
          reason: `Role/Group '${invalidPart}' not found in application`,
        });
        continue;
      }

      const status = statusRaw === "Inactive" ? "Inactive" : "Active";

      // Duplicate check
      const existing = await ActiveUser.findOne({
        where: { userId: user.id, applicationId },
      });

      if (existing) {
        // Update ActiveUserList
        await existing.update({
          username: userIdApp,
          status,
          approvedBy: req.userId,
          reviewedBy: req.userId,
        });

        // Remove old roles and groups
        const existingRoles = await UserApplicationRole.findAll({
          where: { userId: user.id },
          include: [{ model: ApplicationRole, where: { applicationId } }],
        });
        for (const er of existingRoles) await er.destroy();

        const existingGroups = await UserApplicationGroup.findAll({
          where: { userId: user.id },
          include: [{ model: ApplicationGroup, where: { applicationId } }],
        });
        for (const eg of existingGroups) await eg.destroy();

        // Create new mappings
        if (rolesToAssign.length > 0) {
          await UserApplicationRole.bulkCreate(
            rolesToAssign.map((r) => ({
              userId: user.id,
              applicationRoleId: r.id,
            }))
          );
        }
        if (groupsToAssign.length > 0) {
          await UserApplicationGroup.bulkCreate(
            groupsToAssign.map((g) => ({
              userId: user.id,
              applicationGroupId: g.id,
            }))
          );
        }

        summary.updated++;
        await auditHelper(
          "ACTIVE_USER_BULK_UPLOAD",
          existing.id,
          "UPDATED",
          null,
          {
            "Application Name": application.name,
            "Emp Code": empCode,
            "User ID (Application)": userIdApp,
            "Roles/Groups": parts,
            "Status": status,
          },
          req.userId,
          req.ip,
          "Active user updated via bulk upload"
        );
      } else {
        // Create new entry
        const newActiveUser = await ActiveUser.create({
          userId: user.id,
          applicationId,
          username: userIdApp,
          status,
          approvedBy: req.userId,
          reviewedBy: req.userId,
        });

        if (rolesToAssign.length > 0) {
          await UserApplicationRole.bulkCreate(
            rolesToAssign.map((r) => ({
              userId: user.id,
              applicationRoleId: r.id,
            }))
          );
        }
        if (groupsToAssign.length > 0) {
          await UserApplicationGroup.bulkCreate(
            groupsToAssign.map((g) => ({
              userId: user.id,
              applicationGroupId: g.id,
            }))
          );
        }

        summary.created++;
        await auditHelper(
          "ACTIVE_USER_BULK_UPLOAD",
          newActiveUser.id,
          "CREATED",
          null,
          {
            "Application Name": application.name,
            "Emp Code": empCode,
            "User ID (Application)": userIdApp,
            "Roles/Groups": parts,
            "Status": status,
          },
          req.userId,
          req.ip,
          "Active user created via bulk upload"
        );
      }
    }

    // Clean temp file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.send({
      message: `Upload completed. Created: ${summary.created}, Updated: ${summary.updated}, Skipped: ${summary.skipped}`,
      summary,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Bulk upload error:", error);
    res.status(500).send({ message: error.message });
  }
};