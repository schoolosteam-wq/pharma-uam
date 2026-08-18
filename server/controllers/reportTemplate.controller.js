// server/controllers/reportTemplate.controller.js
const db = require("../models");
const ReportTemplate = db.ReportTemplate;
const Facility = db.Facility;
const { auditHelper } = require("../utils/auditHelper");
const path = require("path");
const fs = require("fs");

// GET template – pass facilityId as query, if not given return global
exports.getTemplate = async (req, res) => {
  try {
    const { facilityId } = req.query;
    const where = facilityId ? { facilityId } : { facilityId: null };
    const template = await ReportTemplate.findOne({ where });
    res.send(template || {});
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// Save or update template
exports.saveTemplate = async (req, res) => {
  try {
    const { facilityId, ...templateData } = req.body;
    const where = facilityId ? { facilityId } : { facilityId: null };
    let template = await ReportTemplate.findOne({ where });

    if (template) {
      await template.update({ facilityId: facilityId || null, ...templateData });
    } else {
      template = await ReportTemplate.create({ facilityId: facilityId || null, ...templateData });
    }

    await auditHelper(
      "REPORT_TEMPLATE",
      template.id,
      template ? "UPDATED" : "CREATED",
      null,
      { facilityId: facilityId || "Global", ...templateData },
      req.userId,
      req.ip,
      "Report template saved"
    );

    res.send(template);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// Upload logo – returns logoPath
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: "No file uploaded" });
    }
    const logoPath = `/uploads/templates/${req.file.filename}`;
    res.send({ logoPath });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// Upload reference PDF/Image – temporary preview, not saved
exports.uploadReference = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: "No file uploaded" });
    }
    const fileUrl = `/uploads/templates/reference/${req.file.filename}`;
    res.send({ fileUrl });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// Copy template from one facility to another (facilityId null = global)
exports.copyTemplate = async (req, res) => {
  try {
    const { fromFacilityId, toFacilityId } = req.body;
    if (fromFacilityId === undefined || toFacilityId === undefined) {
      return res.status(400).send({ message: "fromFacilityId and toFacilityId are required" });
    }

    const fromWhere = fromFacilityId ? { facilityId: fromFacilityId } : { facilityId: null };
    const fromTemplate = await ReportTemplate.findOne({ where: fromWhere });
    if (!fromTemplate) {
      return res.status(404).send({ message: "Source template not found" });
    }

    const data = fromTemplate.toJSON();
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    data.facilityId = toFacilityId || null;

    const toWhere = toFacilityId ? { facilityId: toFacilityId } : { facilityId: null };
    let existing = await ReportTemplate.findOne({ where: toWhere });
    if (existing) {
      await existing.update(data);
    } else {
      await ReportTemplate.create(data);
    }

    await auditHelper(
      "REPORT_TEMPLATE",
      existing?.id || "NEW",
      "COPIED",
      null,
      { from: fromFacilityId || "Global", to: toFacilityId || "Global" },
      req.userId,
      req.ip,
      "Report template copied"
    );

    res.send({ message: "Template copied successfully" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};