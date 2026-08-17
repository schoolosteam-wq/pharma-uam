const express = require("express");
const router = express.Router();
const controller = require("../controllers/application.controller");
const { verifyToken, requirePermission } = require("../middleware/authJwt");

router.post("/", [verifyToken, requirePermission("CREATE_APPLICATION")], controller.create);
// GET सभी एथेंटिकेटेड यूज़र के लिए खुला रखें (request बनाने हेतु)
router.get("/", [verifyToken], controller.findAll);
router.get("/sample-csv", [verifyToken], controller.downloadSampleCsv);
router.get("/:id/roles-groups", [verifyToken], controller.getRolesGroups);  // roles भी ज़रूरी हैं
router.get("/list-for-request", [verifyToken], controller.listForRequest);
router.get("/:id", [verifyToken, requirePermission("VIEW_APPLICATION")], controller.findOne);
router.put("/:id", [verifyToken, requirePermission("EDIT_APPLICATION")], controller.update);
router.delete("/:id", [verifyToken, requirePermission("DELETE_APPLICATION")], controller.delete);

module.exports = router;