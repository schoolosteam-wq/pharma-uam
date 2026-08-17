const express = require("express");
const router = express.Router();
const controller = require("../controllers/role.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");

router.post("/", [verifyToken, requirePermission("MANAGE_ROLES")], controller.create);
router.get("/", [verifyToken, requirePermission("VIEW_USER")], controller.findAll);
router.get("/:id", [verifyToken, requirePermission("VIEW_USER")], controller.findOne);
router.get("/permissions/me", [verifyToken], controller.getMyPermissions);

// permissions update route पहले रखें (इसके बाद /:id नहीं आना चाहिए)
router.put("/:id/permissions", [verifyToken, requirePermission("MANAGE_ROLES")], controller.updatePermissions);

router.put("/:id", [verifyToken, requirePermission("MANAGE_ROLES")], controller.update);
router.delete("/:id", [verifyToken, requirePermission("MANAGE_ROLES")], controller.delete);

module.exports = router;