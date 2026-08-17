const express = require("express");
const router = express.Router();
const controller = require("../controllers/facility.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");

router.post("/", [verifyToken, requirePermission("CREATE_FACILITY")], controller.create);
router.get("/", [verifyToken, requirePermission("VIEW_FACILITY")], controller.findAll);
router.get("/factories", [verifyToken], controller.getAllFactories);
router.get("/:id", [verifyToken, requirePermission("VIEW_FACILITY")], controller.findOne);
router.put("/:id", [verifyToken, requirePermission("EDIT_FACILITY")], controller.update);
router.delete("/:id", [verifyToken, requirePermission("DELETE_FACILITY")], controller.delete);

module.exports = router;