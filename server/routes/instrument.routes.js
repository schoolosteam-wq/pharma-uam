const express = require("express");
const router = express.Router();
const controller = require("../controllers/instrument.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");

router.post("/", [verifyToken, requirePermission("CREATE_INSTRUMENT")], controller.create);
router.get("/", [verifyToken, requirePermission("VIEW_INSTRUMENT")], controller.findAll);
router.get("/sample-csv", [verifyToken, requirePermission("CREATE_INSTRUMENT")], controller.downloadSampleCsv);
router.get("/:id", [verifyToken, requirePermission("VIEW_INSTRUMENT")], controller.findOne);
router.put("/:id", [verifyToken, requirePermission("EDIT_INSTRUMENT")], controller.update);
router.delete("/:id", [verifyToken, requirePermission("DELETE_INSTRUMENT")], controller.delete);

module.exports = router;