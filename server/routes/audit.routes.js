const express = require("express");
const router = express.Router();
const controller = require("../controllers/audit.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");

router.get("/", [verifyToken, requirePermission("VIEW_AUDIT")], controller.findAll);

module.exports = router;