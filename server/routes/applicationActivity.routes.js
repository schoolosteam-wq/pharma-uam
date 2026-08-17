const express = require("express");
const router = express.Router();
const controller = require("../controllers/applicationActivity.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");

router.get("/:id/activities", [verifyToken], controller.getActivities);
router.put("/:id/activities", [verifyToken, requirePermission("MANAGE_WORKFLOW")], controller.saveActivities);

module.exports = router;