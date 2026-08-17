const express = require("express");
const router = express.Router();
const controller = require("../controllers/auth.controller");
const { verifyToken } = require("../middleware/authJwt");

router.post("/precheck", controller.precheck);
router.post("/login", controller.signin);
router.post("/logout", [verifyToken], controller.signout);   // new
router.post("/facility-switch", [verifyToken], controller.facilitySwitch);
router.post("/forgot-password", controller.forgotPassword);

module.exports = router;