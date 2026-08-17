// server/controllers/role.controller.js
const db = require("../models");
const Role = db.Role;
const Permission = db.Permission;
const { auditHelper } = require("../utils/auditHelper");

exports.create = async (req, res) => {
  try {
    const { permissions, ...roleData } = req.body;
    const role = await Role.create(roleData);
    if (permissions && permissions.length) {
      const permRecords = permissions.map(p => ({ permissionName: p, roleId: role.id }));
      await Permission.bulkCreate(permRecords);
    }

    const newPermNames = permissions || [];
    const auditNewVal = {
      "Role Name": role.roleName,
      Description: role.description || '',
      Permissions: newPermNames,
    };

    await auditHelper(
      "ROLE", role.id, "CREATED",
      null, auditNewVal,
      req.userId, req.ip,
      "Role created"
    );

    res.status(201).send(role);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const roles = await Role.findAll({ include: [Permission] });
    res.send(roles);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id, { include: [Permission] });
    if (!role) return res.status(404).send({ message: "Not found" });
    res.send(role);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).send({ message: "Not found" });
    if (role.isSystem) return res.status(400).send({ message: "System roles cannot be modified" });

    const oldPermissions = (await Permission.findAll({ where: { roleId: role.id } })).map(p => p.permissionName);
    const oldAuditVal = {
      "Role Name": role.roleName,
      Description: role.description || '',
      Permissions: oldPermissions,
    };

    await role.update(req.body);

    if (req.body.permissions) {
      await Permission.destroy({ where: { roleId: role.id } });
      if (Array.isArray(req.body.permissions) && req.body.permissions.length > 0) {
        const permRecords = req.body.permissions.map(p => ({ permissionName: p, roleId: role.id }));
        await Permission.bulkCreate(permRecords);
      }
    }

    const newPermissions = req.body.permissions || oldPermissions;
    const newAuditVal = {
      "Role Name": role.roleName,
      Description: role.description || '',
      Permissions: newPermissions,
    };

    // --- diff only changed fields ---
    const changedOld = {};
    const changedNew = {};
    for (const key of Object.keys(oldAuditVal)) {
      if (JSON.stringify(oldAuditVal[key]) !== JSON.stringify(newAuditVal[key])) {
        changedOld[key] = oldAuditVal[key];
        changedNew[key] = newAuditVal[key];
      }
    }

    if (Object.keys(changedOld).length > 0) {
      changedOld["Role Name"] = role.roleName;
      changedNew["Role Name"] = role.roleName;
    }

    await auditHelper(
      "ROLE", role.id, "UPDATED",
      changedOld, changedNew,
      req.userId, req.ip,
      "Role updated"
    );

    res.send(role);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.updatePermissions = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).send({ message: "Role not found" });
    if (role.isSystem) return res.status(400).send({ message: "Cannot modify system role permissions" });

    const oldPermissions = (await Permission.findAll({ where: { roleId: role.id } })).map(p => p.permissionName);

    const { permissions } = req.body;

    await Permission.destroy({ where: { roleId: role.id } });
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const permRecords = permissions.map(p => ({ permissionName: p, roleId: role.id }));
      await Permission.bulkCreate(permRecords);
    }

    const newPermissions = permissions || [];

    const oldAuditVal = {
      "Role Name": role.roleName,
      Permissions: oldPermissions,
    };
    const newAuditVal = {
      "Role Name": role.roleName,
      Permissions: newPermissions,
    };

    // --- diff only changed fields ---
    const changedOld = {};
    const changedNew = {};
    for (const key of Object.keys(oldAuditVal)) {
      if (JSON.stringify(oldAuditVal[key]) !== JSON.stringify(newAuditVal[key])) {
        changedOld[key] = oldAuditVal[key];
        changedNew[key] = newAuditVal[key];
      }
    }

    if (Object.keys(changedOld).length > 0) {
      changedOld["Role Name"] = role.roleName;
      changedNew["Role Name"] = role.roleName;
    }

    await auditHelper(
      "ROLE", role.id, "PERMISSIONS_UPDATED",
      changedOld, changedNew,
      req.userId, req.ip,
      "Role permissions updated"
    );

    res.send({ message: "Permissions updated" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getMyPermissions = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.userId, {
      include: [{ model: Role, as: "roles", include: [db.Permission] }]
    });
    const permissions = [];
    user.roles.forEach(role => {
      role.permissions?.forEach(p => permissions.push(p.permissionName));
    });
    res.send({ permissions });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).send({ message: "Not found" });
    if (role.isSystem) return res.status(400).send({ message: "Cannot delete system role" });

    const oldPermissions = (await Permission.findAll({ where: { roleId: role.id } })).map(p => p.permissionName);
    const oldAuditVal = {
      "Role Name": role.roleName,
      Description: role.description || '',
      Permissions: oldPermissions,
    };

    await role.destroy();

    await auditHelper(
      "ROLE", req.params.id, "DELETED",
      oldAuditVal, null,
      req.userId, req.ip,
      "Role deleted"
    );

    res.send({ message: "Deleted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};