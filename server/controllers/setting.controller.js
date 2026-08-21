// server/controllers/setting.controller.js (complete)
const db = require("../models");
const Setting = db.Setting;
const { testConnection } = require("../utils/adHelper");
const { testEmailConnection, sendTestEmail } = require("../utils/emailHelper");
const { auditHelper } = require("../utils/auditHelper");

// ---------- AD CONFIG ----------

exports.getADConfig = async (req, res) => {
  try {
    const settings = await Setting.findAll({
      where: { key: ["ad_enabled", "ad_url", "ad_baseDN", "ad_domain", "ad_username", "ad_password", "ad_syncInterval"] }
    });
    const config = {};
    settings.forEach(s => { config[s.key] = s.value; });
    if (config.ad_password) config.ad_password = "••••••••";

    // “VIEWED” ऑडिट अब नहीं बनेगा (क्लीन लॉग)
    res.send(config);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.testADConnection = async (req, res) => {
  try {
    const result = await testConnection();

    await auditHelper("SETTING", "AD", "TEST_CONNECTION", null, result, req.userId, req.ip, "AD connection test performed");

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.saveADConfig = async (req, res) => {
  try {
    const { ad_enabled, ad_url, ad_baseDN, ad_domain, ad_username, ad_password, ad_syncInterval } = req.body;
    const pairs = [
      { key: "ad_enabled", value: String(ad_enabled === true || ad_enabled === "true") },
      { key: "ad_url", value: ad_url || "" },
      { key: "ad_baseDN", value: ad_baseDN || "" },
      { key: "ad_domain", value: ad_domain || "" },
      { key: "ad_username", value: ad_username || "" },
      { key: "ad_syncInterval", value: ad_syncInterval || "24" }
    ];
    // Save password only if new value provided and NOT masked
    if (ad_password && ad_password !== "••••••••" && ad_password !== "XXXXXXXX") {
      pairs.push({ key: "ad_password", value: ad_password });
    }

    // Upsert
    for (let p of pairs) {
      await Setting.upsert(p);
    }

    // --- Audit – masked password ---
    const auditData = pairs.reduce((acc, p) => {
      if (p.key === "ad_password") {
        acc[p.key] = "********";  // always masked
      } else {
        acc[p.key] = p.value;
      }
      return acc;
    }, {});
    await auditHelper("SETTING", "AD", "SAVED", null, auditData, req.userId, req.ip, "AD configuration saved");

    res.send({ message: "AD configuration saved" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ---------- EMAIL CONFIG ----------

exports.getEmailConfig = async (req, res) => {
  try {
    const settings = await Setting.findAll({
      where: { key: ["smtp_enabled", "smtp_host", "smtp_port", "smtp_user", "smtp_from"] }
    });
    const config = {};
    settings.forEach(s => { config[s.key] = s.value; });
    const passSetting = await Setting.findOne({ where: { key: "smtp_pass" } });
    config.smtp_pass = passSetting ? "••••••••" : "";

    // “VIEWED” ऑडिट अब नहीं बनेगा
    res.send(config);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.saveEmailConfig = async (req, res) => {
  try {
    const pairs = Object.entries(req.body).map(([key, value]) => ({ key, value }));
    const filteredPairs = pairs.filter(p => !(p.key === "smtp_pass" && p.value === "••••••••"));
    for (let p of filteredPairs) {
      await Setting.upsert(p);
    }

    await auditHelper("SETTING", "EMAIL", "SAVED", null, req.body, req.userId, req.ip, "Email configuration saved");

    res.send({ message: "Email configuration saved" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.testEmailConnection = async (req, res) => {
  try {
    const result = await testEmailConnection();

    await auditHelper("SETTING", "EMAIL", "TEST_CONNECTION", null, result, req.userId, req.ip, "Email connection test performed");

    res.send(result);
  } catch (error) {
    console.error("Test email connection error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.sendTestEmail = async (req, res) => {
  try {
    const { test_email } = req.body;
    if (!test_email) return res.status(400).send({ message: "Please provide a test email address" });

    await sendTestEmail(test_email);

    await auditHelper("SETTING", "EMAIL", "TEST_EMAIL_SENT", null, { testEmail: test_email }, req.userId, req.ip, "Test email sent");

    res.send({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ---------- OU MAPPING ----------
exports.getOUMapping = async (req, res) => {
  try {
    const setting = await Setting.findOne({ where: { key: "ad_ou_mapping" } });
    const mapping = setting ? JSON.parse(setting.value) : {};
    res.send(mapping);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.saveOUMapping = async (req, res) => {
  try {
    // पुराना मैपिंग पढ़ें
    const oldSetting = await Setting.findOne({ where: { key: "ad_ou_mapping" } });
    const oldMapping = oldSetting ? JSON.parse(oldSetting.value) : {};

    // नया मैपिंग सेव करें
    await Setting.upsert({
      key: "ad_ou_mapping",
      value: JSON.stringify(req.body || {})
    });

    // ऑडिट के लिए old और new दोनों भेजें
    const newMapping = req.body || {};

    await auditHelper(
      "SETTING", "AD", "OU_MAPPING_SAVED",
      oldMapping,      // oldValue
      newMapping,      // newValue
      req.userId, req.ip,
      "AD OU Mapping saved"
    );

    res.send({ message: "OU Mapping saved" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ---------- COMPANY LOGO ----------

// GET current logo (public)
exports.getLogo = async (req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");
    const possibleExtensions = [".png", ".jpg", ".jpeg", ".svg", ".gif"];
    for (const ext of possibleExtensions) {
      const logoPath = path.join(__dirname, "..", "uploads", "logos", "company_logo" + ext);
      if (fs.existsSync(logoPath)) {
        return res.send({ logoUrl: "/uploads/logos/company_logo" + ext });
      }
    }
    res.send({ logoUrl: null });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// Upload logo (protected)
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ message: "No file uploaded" });
    }

    // Audit trail for logo upload
    await auditHelper(
      "SETTING",
      "LOGO",
      "UPLOADED",
      null,
      { Filename: req.file.originalname, Path: req.file.path },
      req.userId,
      req.ip,
      "Company logo uploaded"
    );

    res.send({ message: "Logo uploaded successfully", path: req.file.path });
  } catch (error) {
    console.error("Logo upload error:", error);
    res.status(500).send({ message: error.message });
  }
};