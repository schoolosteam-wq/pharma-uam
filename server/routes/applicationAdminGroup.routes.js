const express = require("express");
const router = express.Router();
const controller = require("../controllers/applicationAdminGroup.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");

router.get("/:id/admin-groups", [verifyToken], controller.getAdminGroups);
router.put("/:id/admin-groups", [verifyToken, requirePermission("MANAGE_WORKFLOW")], controller.saveAdminGroups);

module.exports = router;