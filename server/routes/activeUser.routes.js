const express = require("express");
const router = express.Router();
const controller = require("../controllers/activeUser.controller");
const { verifyToken } = require("../middleware/authJwt");

router.get("/", [verifyToken], controller.findAll);

module.exports = router;