const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const controller = require("../controllers/setting.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");


router.get("/ad-config", [verifyToken, requirePermission("MANAGE_ROLES")], controller.getADConfig);
router.put("/ad-config", [verifyToken, requirePermission("MANAGE_ROLES")], controller.saveADConfig);
router.get("/ad-ou-mapping", [verifyToken, requirePermission("MANAGE_ROLES")], controller.getOUMapping);
router.put("/ad-ou-mapping", [verifyToken, requirePermission("MANAGE_ROLES")], controller.saveOUMapping);
router.get("/email-config", [verifyToken, requirePermission("MANAGE_ROLES")], controller.getEmailConfig);
router.put("/email-config", [verifyToken, requirePermission("MANAGE_ROLES")], controller.saveEmailConfig);
router.post("/ad-test", [verifyToken, requirePermission("MANAGE_ROLES")], controller.testADConnection);
router.post("/email-test", [verifyToken, requirePermission("MANAGE_ROLES")], controller.testEmailConnection);
router.post("/send-test-email", [verifyToken, requirePermission("MANAGE_ROLES")], controller.sendTestEmail);

// Multer config for logo
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/logos/");
  },
  filename: function (req, file, cb) {
    cb(null, "company_logo" + path.extname(file.originalname));
  }
});
const logoUpload = multer({ storage: logoStorage });

// ✅ GET current company logo (public)
router.get("/logo", async (req, res) => {
  try {
    const logoPath = path.join(__dirname, "..", "uploads", "logos", "company_logo.png");
    if (fs.existsSync(logoPath)) {
      return res.send({ logoUrl: "/uploads/logos/company_logo.png" });
    }
    // try other extensions
    const extensions = [".jpg", ".jpeg", ".svg", ".gif"];
    for (const ext of extensions) {
      const p = path.join(__dirname, "..", "uploads", "logos", "company_logo" + ext);
      if (fs.existsSync(p)) {
        return res.send({ logoUrl: "/uploads/logos/company_logo" + ext });
      }
    }
    res.send({ logoUrl: null });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// Logo upload route
router.post("/upload-logo", [verifyToken, requirePermission("MANAGE_ROLES"), logoUpload.single("logo")], async (req, res) => {
  try {
    if (!req.file) return res.status(400).send({ message: "No logo file" });
    res.send({ message: "Logo uploaded", path: req.file.path });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

module.exports = router;