// server/routes/reportTemplate.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/reportTemplate.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Multer for logo
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/templates";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "logo-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"), false);
  },
});

// Multer for reference (PDF/Image)
const referenceStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/templates/reference";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "ref-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const referenceUpload = multer({
  storage: referenceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype === "application/pdf" || ext === ".pdf" ||
        file.mimetype.startsWith("image/") || ['.png', '.jpg', '.jpeg'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF or images allowed"), false);
    }
  },
});

router.get("/", [verifyToken, requirePermission("VIEW_USER")], controller.getTemplate);
router.post("/", [verifyToken, requirePermission("MANAGE_GROUPS")], controller.saveTemplate);
router.post("/upload-logo", [verifyToken, requirePermission("MANAGE_GROUPS"), logoUpload.single("logo")], controller.uploadLogo);
router.post("/upload-reference", [verifyToken, requirePermission("MANAGE_GROUPS"), referenceUpload.single("reference")], controller.uploadReference);
router.post("/copy", [verifyToken, requirePermission("MANAGE_GROUPS")], controller.copyTemplate);

module.exports = router;