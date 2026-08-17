const jwt = require("jsonwebtoken");
const config = require("../config/auth.config");
const db = require("../models");
const User = db.User;
const Role = db.Role;

verifyToken = (req, res, next) => {
  let token = req.headers["x-access-token"] || req.headers["authorization"];
  if (!token) return res.status(403).send({ message: "No token provided!" });
  if (token.startsWith("Bearer ")) token = token.slice(7);
  jwt.verify(token, config.secret, (err, decoded) => {
    if (err) return res.status(401).send({ message: "Unauthorized!" });
    req.userId = decoded.id;
    next();
  });
};

requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const user = await User.findByPk(req.userId, {
        include: [{ model: Role, as: "roles", include: [db.Permission] }]
      });
      if (!user) return res.status(403).send({ message: "No permission" });

      const permissions = [];
      user.roles.forEach(role => {
        role.permissions?.forEach(p => permissions.push(p.permissionName));
      });

      if (permissions.includes(permissionName)) {
        next();
      } else {
        res.status(403).send({ message: "Insufficient permissions" });
      }
    } catch (error) {
      res.status(500).send({ message: error.message });
    }
  };
};

const authJwt = { verifyToken, requirePermission };
module.exports = authJwt;