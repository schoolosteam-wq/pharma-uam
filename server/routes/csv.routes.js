const express = require("express");
const router = express.Router();
const controller = require("../controllers/csv.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");
const upload = require("../middleware/upload");

// Applications CSV upload
router.post(
  "/applications",
  [verifyToken, requirePermission("MANAGE_APPLICATION_BULK_UPLOAD"), upload.single("file")],
  (req, res) => {
    req.params.module = "applications";
    controller.bulkUpload(req, res);
  }
);

// Instruments CSV upload
router.post(
  "/instruments",
  [verifyToken, requirePermission("MANAGE_INSTRUMENT_BULK_UPLOAD"), upload.single("file")],
  (req, res) => {
    req.params.module = "instruments";
    controller.bulkUpload(req, res);
  }
);

// Computers CSV upload
router.post(
  "/computers",
  [verifyToken, requirePermission("MANAGE_COMPUTER_BULK_UPLOAD"), upload.single("file")],
  (req, res) => {
    req.params.module = "computers";
    controller.bulkUpload(req, res);
  }
);

module.exports = router;