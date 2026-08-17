const express = require("express");
const router = express.Router();
const controller = require("../controllers/group.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");

router.post("/", verifyToken, requirePermission("MANAGE_GROUPS"), controller.create);
router.get("/", verifyToken, requirePermission("VIEW_USER"), controller.findAll);
router.get("/:id", verifyToken, requirePermission("VIEW_USER"), controller.findOne);
router.get("/:id/members", verifyToken, requirePermission("MANAGE_GROUPS"), controller.getMembers);
router.put("/:id/members", verifyToken, requirePermission("MANAGE_GROUPS"), controller.updateMembers);
router.put("/:id", verifyToken, requirePermission("MANAGE_GROUPS"), controller.update);
router.delete("/:id", verifyToken, requirePermission("MANAGE_GROUPS"), controller.delete);

module.exports = router;