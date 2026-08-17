const nodemailer = require("nodemailer");
const db = require("../models");
const Setting = db.Setting;

async function getSmtpConfig() {
  const settings = await Setting.findAll({
    where: { key: ["smtp_enabled", "smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from"] }
  });
  const cfg = {};
  settings.forEach(s => { cfg[s.key] = s.value; });
  return cfg;
}

async function sendEmail(to, subject, html) {
  const cfg = await getSmtpConfig();
  if (cfg.smtp_enabled !== "true") return;

  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port: Number(cfg.smtp_port) || 587,
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
  });

  await transporter.sendMail({
    from: cfg.smtp_from || cfg.smtp_user,
    to,
    subject,
    html,
  });
}

async function testEmailConnection() {
  try {
    const cfg = await getSmtpConfig();
    if (cfg.smtp_enabled !== "true") {
      return { success: false, message: "Email notifications are disabled" };
    }

    // Check that required fields are present
    if (!cfg.smtp_host || !cfg.smtp_port || !cfg.smtp_user || !cfg.smtp_pass) {
      return { success: false, message: "Incomplete SMTP configuration. Please fill all fields." };
    }

    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: Number(cfg.smtp_port),
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    });

    await transporter.verify();
    return { success: true, message: "SMTP connection successful" };
  } catch (error) {
    console.error("SMTP test error:", error);
    return { success: false, message: error.message };
  }
}

async function sendTestEmail(to) {
  const cfg = await getSmtpConfig();
  if (cfg.smtp_enabled !== "true") throw new Error("Email notifications are disabled");

  if (!cfg.smtp_host || !cfg.smtp_port || !cfg.smtp_user || !cfg.smtp_pass) {
    throw new Error("Incomplete SMTP configuration. Please save the configuration first.");
  }

  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port: Number(cfg.smtp_port),
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
  });

  await transporter.sendMail({
    from: cfg.smtp_from || cfg.smtp_user,
    to,
    subject: "Pharma UAM – Test Email",
    html: "<p>This is a test email from Pharma User Management System.</p>",
  });
}

module.exports = { sendEmail, testEmailConnection, sendTestEmail };