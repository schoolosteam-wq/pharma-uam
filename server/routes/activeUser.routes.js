const express = require("express");
const router = express.Router();
const controller = require("../controllers/activeUser.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");
const upload = require("../middleware/upload");

// Existing: fetch active users
router.get("/", [verifyToken], controller.findAll);

// New: download sample CSV for bulk upload
router.get(
  "/sample-csv",
  [verifyToken, requirePermission("MANAGE_ACTIVE_USER_BULK_UPLOAD")],
  controller.downloadSampleCsv
);

// New: bulk upload active users
router.post(
  "/bulk-upload",
  [
    verifyToken,
    requirePermission("MANAGE_ACTIVE_USER_BULK_UPLOAD"),
    upload.single("file"),
  ],
  controller.bulkUpload
);

module.exports = router;