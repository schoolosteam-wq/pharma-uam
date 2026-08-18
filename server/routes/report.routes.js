const express = require("express");
const router = express.Router();
const controller = require("../controllers/report.controller");
const { verifyToken } = require("../middleware/authJwt");

router.get("/active-users/pdf", [verifyToken], controller.activeUserListPDF);
router.get("/applications/pdf", [verifyToken], controller.applicationListPDF);
router.get("/instruments/pdf", [verifyToken], controller.instrumentListPDF);
router.get("/computers/pdf", [verifyToken], controller.computerListPDF);
router.get("/audit/pdf", [verifyToken], controller.auditTrailPDF);

module.exports = router;