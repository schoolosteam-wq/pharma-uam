const fs = require("fs");
const csvService = require("../services/csvService");
const db = require("../models");
const { auditHelper } = require("../utils/auditHelper");
const ApplicationRole = db.ApplicationRole;
const ApplicationGroup = db.ApplicationGroup;

exports.bulkUpload = async (req, res) => {
  const { module } = req.params; // e.g., "applications"
  if (!req.file) {
    return res.status(400).send({ message: "No CSV file uploaded" });
  }

  try {
    const data = await csvService.parseCSV(req.file.path);
    let Model;
    switch (module) {
      case "applications":
        Model = db.Application;
        break;
      case "instruments":
        Model = db.Instrument;
        break;
      case "computers":
        Model = db.Computer;
        break;
      default:
        return res.status(400).send({ message: "Invalid module" });
    }

    const created = [];
          // Special handling for applications – roles/groups/facilityId
    if (module === "applications") {
      for (const row of data) {
        // Extract roles and groups from CSV row
        const roles = row.roles ? row.roles.split(",").map(r => r.trim()).filter(r => r) : [];
        const groups = row.groups ? row.groups.split(",").map(g => g.trim()).filter(g => g) : [];
        
        // Remove roles/groups from row (they are not direct columns)
        delete row.roles;
        delete row.groups;

        // Create application with remaining fields (including facilityId if present)
        const app = await db.Application.create({
          name: row.name,
          manufacturer: row.manufacturer || null,
          versionNo: row.versionNo || null,
          oemContact: row.oemContact || null,
          status: row.status || "ACTIVE",
          facilityId: row.facilityId || null,
          createdBy: req.userId,
        });

        // Create application roles
        if (roles.length > 0) {
          const roleRecords = roles.map(roleName => ({
            roleName,
            applicationId: app.id
          }));
          await ApplicationRole.bulkCreate(roleRecords);
        }

        // Create application groups
        if (groups.length > 0) {
          const groupRecords = groups.map(groupName => ({
            groupName,
            applicationId: app.id
          }));
          await ApplicationGroup.bulkCreate(groupRecords);
        }

        created.push(app);
        await auditHelper("APPLICATION", app.id, "BULK_CREATE", null, app.toJSON(), req.userId, req.ip);
      }
    } else {
      // Existing generic handling for instruments/computers
      for (const row of data) {
        const entity = await Model.create(row);
        created.push(entity);
        await auditHelper(module.toUpperCase(), entity.id, "BULK_CREATE", null, entity.toJSON(), req.userId, req.ip);
      }
    }

    // Delete temp file
    fs.unlinkSync(req.file.path);

    res.send({ message: `${created.length} records imported successfully` });
  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).send({ message: error.message });
  }
};