const express = require("express");
const router = express.Router();
const controller = require("../controllers/request.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");
const upload = require("../middleware/upload");

// Any authenticated user can create a request
router.post("/", [verifyToken], controller.create);
router.get("/", [verifyToken], controller.findAll);
router.get("/:id", [verifyToken], controller.findOne);  // owner or admin can view

// Actions requiring specific permissions
router.put("/:id/submit", [verifyToken], controller.submit);
router.put("/:id/approve", [verifyToken, requirePermission("APPROVE_REQUEST")], controller.approveStep);
router.put("/:id/return", [verifyToken, requirePermission("RETURN_REQUEST")], controller.returnRequest);
router.put("/:id/reject", [verifyToken, requirePermission("REJECT_REQUEST")], controller.rejectRequest);
router.put("/:id/complete-password", [verifyToken, requirePermission("APPROVE_REQUEST")], controller.completeWithPassword);
router.put("/:id/complete-facility-access", [verifyToken, requirePermission("APPROVE_REQUEST")], controller.completeFacilityAccess);
router.post("/:id/resubmit", [verifyToken], controller.resubmit);
router.post("/:id/documents", [verifyToken, upload.single("file")], controller.uploadDocument);

module.exports = router;