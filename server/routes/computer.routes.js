const express = require("express");
const router = express.Router();
const controller = require("../controllers/computer.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");

router.post("/", [verifyToken, requirePermission("CREATE_COMPUTER")], controller.create);
router.get("/", [verifyToken, requirePermission("VIEW_COMPUTER")], controller.findAll);
router.get("/sample-csv", [verifyToken, requirePermission("CREATE_COMPUTER")], controller.downloadSampleCsv);
router.get("/:id", [verifyToken, requirePermission("VIEW_COMPUTER")], controller.findOne);
router.put("/:id", [verifyToken, requirePermission("EDIT_COMPUTER")], controller.update);
router.delete("/:id", [verifyToken, requirePermission("DELETE_COMPUTER")], controller.delete);

module.exports = router;