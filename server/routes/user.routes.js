const express = require("express");
const router = express.Router();
const controller = require("../controllers/user.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");
const upload = require("../middleware/upload");

router.get("/", [verifyToken, requirePermission("VIEW_USER")], controller.findAll);
router.get("/profile", [verifyToken], controller.getProfileWithAppRoles);
router.get("/sample-csv", [verifyToken, requirePermission("CREATE_USER")], controller.downloadSampleCsv);
router.get("/:id", [verifyToken, requirePermission("VIEW_USER")], controller.findOne);
router.post("/", [verifyToken, requirePermission("CREATE_USER")], controller.create);
router.post("/bulk-upload", [verifyToken, requirePermission("CREATE_USER"), upload.single("file")], controller.bulkUpload);
router.post("/sync-ad", [verifyToken, requirePermission("CREATE_USER")], controller.syncAD);
router.put("/:id", [verifyToken, requirePermission("EDIT_USER")], controller.update);
router.delete("/:id", [verifyToken, requirePermission("DELETE_USER")], controller.delete);

module.exports = router;