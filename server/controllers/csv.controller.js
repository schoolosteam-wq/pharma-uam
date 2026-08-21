const fs = require("fs");
const csvService = require("../services/csvService");
const db = require("../models");
const { auditHelper } = require("../utils/auditHelper");
const { Op } = require("sequelize");
const ApplicationRole = db.ApplicationRole;
const ApplicationGroup = db.ApplicationGroup;

// Helper: Resolve facility ID from value (numeric ID or name/code)
async function resolveFacilityId(value) {
  if (!value) return null;
  if (!isNaN(value)) return parseInt(value, 10);

  const facility = await db.Facility.findOne({
    where: {
      [Op.or]: [
        { name: value },
        { code: value },
      ],
    },
  });
  return facility ? facility.id : null;
}

// Helper: Resolve department ID
async function resolveDepartmentId(value) {
  if (!value) return null;
  if (!isNaN(value)) return parseInt(value, 10);

  const dept = await db.Facility.findOne({
    where: {
      type: "DEPARTMENT",
      [Op.or]: [
        { name: value },
        { code: value },
      ],
    },
  });
  return dept ? dept.id : null;
}

// Helper: Parse date to ISO YYYY-MM-DD
function parseDateToISO(value) {
  if (!value) return null;
  // Try native Date parsing (already ISO)
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }
  // Try dd/mm/yy or dd/mm/yyyy
  const parts = value.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

exports.bulkUpload = async (req, res) => {
  const { module } = req.params;
  if (!req.file) {
    return res.status(400).send({ message: "No CSV file uploaded" });
  }

  let log = null;
  let totalRows = 0;

  try {
    const data = await csvService.parseCSV(req.file.path);
    totalRows = data.length;
    const created = [];
    const skipped = [];
    const errors = [];

    // Create bulk upload log entry (status IN_PROGRESS initially)
    log = await db.BulkUploadLog.create({
      module,
      filename: req.file.originalname,
      uploadedBy: req.userId,
      status: "IN_PROGRESS",
      totalRows,
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

        const existing = await db.Instrument.findOne({ where: { instrumentId: identifier } });
        if (existing) {
          skipped.push({ rowNumber: index + 1, identifier, reason: `Duplicate Instrument ID: ${identifier}` });
          continue;
        }

        try {
          const departmentId = await resolveDepartmentId(row["Department"] || row["departmentId"]);
          const facilityId = await resolveFacilityId(row["Facility"] || row["facilityId"]);

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
            departmentId: departmentId,
            connectionStatus: row["Connection Status"] || "Standalone",
            facilityId: facilityId,
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

        // Pre-validation for instrument linking
        let instrumentInstances = [];
        const instrumentIdsStr = row["Instrument IDs"] || row["instrumentIds"];
        if (instrumentIdsStr) {
          const instrumentIdStrings = instrumentIdsStr.split(",").map(s => s.trim()).filter(s => s);
          if (instrumentIdStrings.length > 0) {
            const instruments = await db.Instrument.findAll({
              where: { instrumentId: { [Op.in]: instrumentIdStrings } },
            });
            if (instruments.length !== instrumentIdStrings.length) {
              skipped.push({
                rowNumber: index + 1,
                identifier: hostname,
                reason: `Some instruments not found: ${instrumentIdStrings.join(", ")}`,
              });
              continue;
            }
            instrumentInstances = instruments;

            const primaryIds = instruments.map(i => i.id);
            const alreadyLinked = await db.ComputerInstrument.findAll({
              where: { instrumentId: { [Op.in]: primaryIds } },
              attributes: ["instrumentId"],
            });
            if (alreadyLinked.length > 0) {
              skipped.push({
                rowNumber: index + 1,
                identifier: hostname,
                reason: `Some instruments already connected to another computer: ${alreadyLinked.map(i => i.instrumentId).join(", ")}`,
              });
              continue;
            }
          }
        }

        try {
          const departmentId = await resolveDepartmentId(row["Department"] || row["departmentId"]);
          const facilityId = await resolveFacilityId(row["Facility"] || row["facilityId"]);

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
            departmentId: departmentId,
            facilityId: facilityId,
            createdBy: req.userId,
          });

          if (instrumentInstances.length > 0) {
            await computer.setInstruments(instrumentInstances);
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

        // Pre-validation for instrument linking
        let instrumentIds = [];
        const instrumentIdsStr = row["Instrument IDs"] || row["instrumentIds"];
        if (instrumentIdsStr) {
          instrumentIds = instrumentIdsStr.split(",").map(s => s.trim()).filter(s => s);
          if (instrumentIds.length > 0) {
            const alreadyAssigned = await db.Instrument.findAll({
              where: {
                instrumentId: { [Op.in]: instrumentIds },
                applicationId: { [Op.ne]: null },
              },
              attributes: ["instrumentId"],
            });
            if (alreadyAssigned.length > 0) {
              skipped.push({
                rowNumber: index + 1,
                identifier: `${name} v${version}`,
                reason: `Some instruments already assigned to another application: ${alreadyAssigned.map(i => i.instrumentId).join(", ")}`,
              });
              continue;
            }
          }
        }

        try {
          const departmentId = await resolveDepartmentId(row["Department"] || row["departmentId"]);
          const facilityId = await resolveFacilityId(row["Facility"] || row["facilityId"]);
          const lastPeriodicReviewDate = parseDateToISO(row["Last Periodic Review Date"] || row["lastPeriodicReviewDate"]);

          const application = await db.Application.create({
            name,
            versionNo: version,
            manufacturer: row["Manufacturer"] || row["manufacturer"] || null,
            oemContact: row["OEM Contact"] || row["oemContact"] || null,
            status: row["Status"] || row["status"] || "ACTIVE",
            facilityId: facilityId,
            departmentId: departmentId,
            applicationOwner: row["Application Owner"] || row["applicationOwner"] || null,
            gampCategory: row["GAMP Category"] || row["gampCategory"] || null,
            validated: row["Validated"] === "Yes" || row["Validated"] === "TRUE" || row["validated"] === "true" ? true : false,
            eresApplicable: row["ERES Applicable"] === "Yes" || row["ERES Applicable"] === "TRUE" || row["eresApplicable"] === "true" ? true : false,
            lastPeriodicReviewDate,
            databaseType: row["Database Type"] || row["databaseType"] || null,
            auditTrailEnabled: row["Audit Trail Enabled"] === "Yes" || row["Audit Trail Enabled"] === "TRUE" || row["auditTrailEnabled"] === "true" ? true : false,
            applicationCriticality: row["Application Criticality"] || row["applicationCriticality"] || null,
            createdBy: req.userId,
          });

          // Roles & Groups handling
          const rolesStr = row["Roles"] || row["roles"];
          const groupsStr = row["Groups"] || row["groups"];
          const roles = rolesStr ? rolesStr.split(",").map(r => r.trim()).filter(r => r) : [];
          const groups = groupsStr ? groupsStr.split(",").map(g => g.trim()).filter(g => g) : [];

          if (roles.length > 0) {
            const roleRecords = roles.map(roleName => ({ roleName, applicationId: application.id }));
            await ApplicationRole.bulkCreate(roleRecords);
          }
          if (groups.length > 0) {
            const groupRecords = groups.map(groupName => ({ groupName, applicationId: application.id }));
            await ApplicationGroup.bulkCreate(groupRecords);
          }

          if (instrumentIds.length > 0) {
            await db.Instrument.update(
              { applicationId: application.id },
              { where: { instrumentId: { [Op.in]: instrumentIds } } }
            );
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
      // Invalid module
      if (log) {
        await log.update({ status: "FAILED", errorRows: totalRows });
      }
      return res.status(400).send({ message: "Invalid module" });
    }

    // Update log summary (success path)
    await log.update({
      status: "COMPLETED",
      successRows: created.length,
      skippedRows: skipped.length,
      errorRows: errors.length,
    });

    // Save details for skipped/errors
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
    // Log failed status if log exists
    if (log) {
      await log.update({ status: "FAILED", errorRows: totalRows, successRows: 0, skippedRows: 0 });
      // Save one generic error detail
      await db.BulkUploadLogDetail.create({
        logId: log.id,
        rowNumber: 0,
        identifier: "GENERAL",
        status: "ERROR",
        reason: error.message,
      });
    }
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Bulk upload error:", error);
    res.status(500).send({ message: error.message });
  }
};