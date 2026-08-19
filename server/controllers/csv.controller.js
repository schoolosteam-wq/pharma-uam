const fs = require("fs");
const csvService = require("../services/csvService");
const db = require("../models");
const { auditHelper } = require("../utils/auditHelper");
const { Op } = require("sequelize");
const ApplicationRole = db.ApplicationRole;
const ApplicationGroup = db.ApplicationGroup;

exports.bulkUpload = async (req, res) => {
  const { module } = req.params;
  if (!req.file) {
    return res.status(400).send({ message: "No CSV file uploaded" });
  }

  try {
    const data = await csvService.parseCSV(req.file.path);
    const created = [];
    const skipped = [];
    const errors = [];

    // Create bulk upload log entry
    const log = await db.BulkUploadLog.create({
      module,
      filename: req.file.originalname,
      uploadedBy: req.userId,
      status: "IN_PROGRESS",
      totalRows: data.length,
      successRows: 0,
      skippedRows: 0,
      errorRows: 0,
    });

    if (module === "instruments") {
      for (const [index, row] of data.entries()) {
        const identifier = row["Instrument ID"] || row["instrumentId"];
        if (!identifier) {
          skipped.push({ rowNumber: index + 1, identifier: "", reason: "Instrument ID missing" });
          continue;
        }

        // Check duplicate by instrumentId
        const existing = await db.Instrument.findOne({ where: { instrumentId: identifier } });
        if (existing) {
          skipped.push({ rowNumber: index + 1, identifier, reason: `Duplicate Instrument ID: ${identifier}` });
          continue;
        }

        try {
          const instrument = await db.Instrument.create({
            instrumentId: identifier,
            assetCode: row["Asset Code"] || null,
            instrumentType: row["Instrument Type"] || null,
            make: row["Make"] || null,
            model: row["Model"] || null,
            serialNumber: row["Serial Number"] || null,
            oemDetails: row["OEM Details"] ? JSON.parse(row["OEM Details"]) : {},
            status: row["Status"] || "ACTIVE",
            currentLocation: row["Current Location"] || null,
            departmentId: row["Department"] ? parseInt(row["Department"]) : null,
            connectionStatus: row["Connection Status"] || "Standalone",
            facilityId: row["Facility"] ? parseInt(row["Facility"]) : null,
            createdBy: req.userId,
          });
          created.push(instrument);
          await auditHelper("INSTRUMENT", instrument.id, "BULK_CREATE", null, instrument.toJSON(), req.userId, req.ip);
        } catch (err) {
          errors.push({ rowNumber: index + 1, identifier, reason: err.message });
        }
      }
    } else if (module === "computers") {
      for (const [index, row] of data.entries()) {
        const hostname = row["Hostname"] || row["hostname"];
        if (!hostname) {
          skipped.push({ rowNumber: index + 1, identifier: "", reason: "Hostname missing" });
          continue;
        }

        const existing = await db.Computer.findOne({ where: { hostname } });
        if (existing) {
          skipped.push({ rowNumber: index + 1, identifier: hostname, reason: `Duplicate Hostname: ${hostname}` });
          continue;
        }

        try {
          const computer = await db.Computer.create({
            hostname,
            computerMakeModel: row["Computer Make & Model"] || row["Make & Model"] || null,
            serialNumber: row["Serial Number"] || null,
            assetCode: row["Asset Code"] || null,
            osVersion: row["OS Version"] || null,
            antivirusStatus: row["Antivirus Status"] || "Not Installed",
            domainStatus: row["Domain Status"] || "Workgroup",
            systemOwner: row["System Owner"] || null,
            csvDone: row["CSV Done"] === "Yes" || row["CSV Done"] === "TRUE" ? true : false,
            location: row["Location"] || null,
            ipAddress: row["IP Address"] || null,
            status: row["Status"] || "ACTIVE",
            departmentId: row["Department"] ? parseInt(row["Department"]) : null,
            facilityId: row["Facility"] ? parseInt(row["Facility"]) : null,
            createdBy: req.userId,
          });

          // Link to instruments if provided
          const instrumentIdsStr = row["Instrument IDs"] || row["instrumentIds"];
          if (instrumentIdsStr) {
            const instrumentIds = instrumentIdsStr.split(",").map(s => s.trim()).filter(s => s);
            if (instrumentIds.length > 0) {
              const instruments = await db.Instrument.findAll({ where: { instrumentId: { [Op.in]: instrumentIds } } });
              if (instruments.length > 0) {
                await computer.setInstruments(instruments);
              } else {
                skipped.push({ rowNumber: index + 1, identifier: hostname, reason: "No matching instruments found for linking" });
              }
            }
          }

          created.push(computer);
          await auditHelper("COMPUTER", computer.id, "BULK_CREATE", null, computer.toJSON(), req.userId, req.ip);
        } catch (err) {
          errors.push({ rowNumber: index + 1, identifier: hostname, reason: err.message });
        }
      }
    } else if (module === "applications") {
      for (const [index, row] of data.entries()) {
        const name = row["Application Name"] || row["name"];
        const version = row["Version"] || row["versionNo"];
        if (!name || !version) {
          skipped.push({ rowNumber: index + 1, identifier: `${name || ""} ${version || ""}`, reason: "Application Name or Version missing" });
          continue;
        }

        const existing = await db.Application.findOne({ where: { name, versionNo: version } });
        if (existing) {
          skipped.push({ rowNumber: index + 1, identifier: `${name} v${version}`, reason: `Duplicate Application: ${name} v${version}` });
          continue;
        }

        try {
          const application = await db.Application.create({
            name,
            versionNo: version,
            manufacturer: row["Manufacturer"] || row["manufacturer"] || null,
            oemContact: row["OEM Contact"] || row["oemContact"] || null,
            status: row["Status"] || row["status"] || "ACTIVE",
            facilityId: row["Facility"] ? parseInt(row["Facility"]) : (row["facilityId"] ? parseInt(row["facilityId"]) : null),
            departmentId: row["Department"] ? parseInt(row["Department"]) : (row["departmentId"] ? parseInt(row["departmentId"]) : null),
            applicationOwner: row["Application Owner"] || row["applicationOwner"] || null,
            gampCategory: row["GAMP Category"] || row["gampCategory"] || null,
            validated: row["Validated"] === "Yes" || row["Validated"] === "TRUE" || row["validated"] === "true" ? true : false,
            eresApplicable: row["ERES Applicable"] === "Yes" || row["ERES Applicable"] === "TRUE" || row["eresApplicable"] === "true" ? true : false,
            lastPeriodicReviewDate: row["Last Periodic Review Date"] || row["lastPeriodicReviewDate"] || null,
            databaseType: row["Database Type"] || row["databaseType"] || null,
            auditTrailEnabled: row["Audit Trail Enabled"] === "Yes" || row["Audit Trail Enabled"] === "TRUE" || row["auditTrailEnabled"] === "true" ? true : false,
            applicationCriticality: row["Application Criticality"] || row["applicationCriticality"] || null,
            createdBy: req.userId,
          });

          // -------- ADDED FROM SECOND VERSION: Roles & Groups handling --------
          // Extract roles and groups from CSV row (supports both column names)
          const rolesStr = row["Roles"] || row["roles"];
          const groupsStr = row["Groups"] || row["groups"];
          const roles = rolesStr ? rolesStr.split(",").map(r => r.trim()).filter(r => r) : [];
          const groups = groupsStr ? groupsStr.split(",").map(g => g.trim()).filter(g => g) : [];

          // Create application roles
          if (roles.length > 0) {
            const roleRecords = roles.map(roleName => ({
              roleName,
              applicationId: application.id
            }));
            await ApplicationRole.bulkCreate(roleRecords);
          }

          // Create application groups
          if (groups.length > 0) {
            const groupRecords = groups.map(groupName => ({
              groupName,
              applicationId: application.id
            }));
            await ApplicationGroup.bulkCreate(groupRecords);
          }

          // -------- Existing linking logic from first version --------
          // Link instruments via Instrument IDs
          const instrumentIdsStr = row["Instrument IDs"] || row["instrumentIds"];
          if (instrumentIdsStr) {
            const instrumentIds = instrumentIdsStr.split(",").map(s => s.trim()).filter(s => s);
            if (instrumentIds.length > 0) {
              await db.Instrument.update(
                { applicationId: application.id },
                { where: { instrumentId: { [Op.in]: instrumentIds } } }
              );
            }
          }

          // Link computers via Hostnames
          const computerHostnamesStr = row["Computer Hostnames"] || row["computerHostnames"];
          if (computerHostnamesStr) {
            const hostnames = computerHostnamesStr.split(",").map(s => s.trim()).filter(s => s);
            if (hostnames.length > 0) {
              const computers = await db.Computer.findAll({ where: { hostname: { [Op.in]: hostnames } } });
              if (computers.length > 0) {
                await application.setComputers(computers);
              }
            }
          }

          created.push(application);
          await auditHelper("APPLICATION", application.id, "BULK_CREATE", null, application.toJSON(), req.userId, req.ip);
        } catch (err) {
          errors.push({ rowNumber: index + 1, identifier: `${name} v${version}`, reason: err.message });
        }
      }
    } else {
      // Unsupported module
      await log.update({ status: "FAILED", errorRows: data.length });
      return res.status(400).send({ message: "Invalid module" });
    }

    // Update log summary
    await log.update({
      status: "COMPLETED",
      successRows: created.length,
      skippedRows: skipped.length,
      errorRows: errors.length,
    });

    // Save details
    for (const s of skipped) {
      await db.BulkUploadLogDetail.create({
        logId: log.id,
        rowNumber: s.rowNumber,
        identifier: s.identifier,
        status: "SKIPPED",
        reason: s.reason,
      });
    }
    for (const e of errors) {
      await db.BulkUploadLogDetail.create({
        logId: log.id,
        rowNumber: e.rowNumber,
        identifier: e.identifier,
        status: "ERROR",
        reason: e.reason,
      });
    }

    // Clean temp file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.send({
      message: `Upload completed. Created: ${created.length}, Skipped: ${skipped.length}, Errors: ${errors.length}`,
      logId: log.id,
      created: created.length,
      skipped: skipped.length,
      errors: errors.length,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Bulk upload error:", error);
    res.status(500).send({ message: error.message });
  }
};