const express = require("express");
const router = express.Router();
const controller = require("../controllers/dashboard.controller");
const { verifyToken } = require("../middleware/authJwt");

router.get("/", [verifyToken], controller.getStats);

module.exports = router;