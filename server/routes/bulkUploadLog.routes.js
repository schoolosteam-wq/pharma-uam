const express = require("express");
const router = express.Router();
const db = require("../models");
const { verifyToken } = require("../middleware/authJwt");

router.get("/:id/details", [verifyToken], async (req, res) => {
  try {
    const logId = req.params.id;
    const log = await db.BulkUploadLog.findByPk(logId, {
      include: [{ model: db.BulkUploadLogDetail, as: "details" }],
    });
    if (!log) return res.status(404).send({ message: "Log not found" });
    res.send(log);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

router.get("/:id/download", [verifyToken], async (req, res) => {
  try {
    const logId = req.params.id;
    const log = await db.BulkUploadLog.findByPk(logId, {
      include: [{ model: db.BulkUploadLogDetail, as: "details" }],
    });
    if (!log) return res.status(404).send({ message: "Log not found" });

    let csv = "Row Number,Identifier,Status,Reason\n";
    log.details.forEach(d => {
      csv += `${d.rowNumber},${d.identifier || ""},${d.status},${d.reason || ""}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=bulk_upload_${log.module}_${log.id}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

module.exports = router;