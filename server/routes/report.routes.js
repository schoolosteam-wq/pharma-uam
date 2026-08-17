const express = require("express");
const router = express.Router();
const controller = require("../controllers/report.controller");
const { verifyToken } = require("../middleware/authJwt");

router.get("/active-users/pdf", [verifyToken], controller.activeUserListPDF);

module.exports = router;