const express = require("express");
const router = express.Router();
const controller = require("../controllers/activityWorkflow.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");

router.post("/", [verifyToken, requirePermission("MANAGE_WORKFLOW")], controller.create);
router.get("/", [verifyToken], controller.findAll);
router.get("/:id", [verifyToken], controller.findOne);
router.put("/:id", [verifyToken, requirePermission("MANAGE_WORKFLOW")], controller.update);
router.delete("/:id", [verifyToken, requirePermission("MANAGE_WORKFLOW")], controller.delete);

module.exports = router;