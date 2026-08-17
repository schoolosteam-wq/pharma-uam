const fs = require("fs");
const csvService = require("../services/csvService");
const db = require("../models");
const { auditHelper } = require("../utils/auditHelper");

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
    for (const row of data) {
      // Basic validation: assume column names match model fields
      const entity = await Model.create(row);
      created.push(entity);
      await auditHelper(module.toUpperCase(), entity.id, "BULK_CREATE", null, entity.toJSON(), req.userId, req.ip);
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