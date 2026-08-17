const db = require("../models");
const Application = db.Application;
const Group = db.Group;
const ApplicationAdminGroup = db.ApplicationAdminGroup;
const { auditHelper } = require("../utils/auditHelper");

// Get admin groups for an application
exports.getAdminGroups = async (req, res) => {
  try {
    const applicationId = req.params.id;
    const app = await Application.findByPk(applicationId, {
      include: [{ model: Group, as: "adminGroups", attributes: ["id", "groupName"] }]
    });
    if (!app) return res.status(404).send({ message: "Application not found" });
    res.send(app.adminGroups.map(g => ({ id: g.id, groupName: g.groupName })));
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// Save admin groups for an application
exports.saveAdminGroups = async (req, res) => {
  try {
    const applicationId = req.params.id;
    const { groupIds } = req.body;

    if (!Array.isArray(groupIds)) {
      return res.status(400).send({ message: "groupIds must be an array" });
    }

    // Purane group names
    const oldGroups = await ApplicationAdminGroup.findAll({
      where: { applicationId },
      include: [{ model: Group, attributes: ["id", "groupName"] }]
    });
    const oldGroupNames = oldGroups.map(r => r.Group?.groupName).filter(Boolean).sort();

    // Nayi group names
    const newGroupRecords = await Group.findAll({ where: { id: groupIds } });
    const newGroupNames = newGroupRecords.map(g => g.groupName).sort();

    // Update mapping
    await ApplicationAdminGroup.destroy({ where: { applicationId } });
    if (groupIds.length > 0) {
      const mappings = groupIds.map(groupId => ({ applicationId, groupId }));
      await ApplicationAdminGroup.bulkCreate(mappings);
    }

    await auditHelper(
      "APPLICATION_ADMIN_GROUP",
      applicationId,
      "MAPPING_UPDATED",
      { "Admin Groups": oldGroupNames },
      { "Admin Groups": newGroupNames },
      req.userId,
      req.ip,
      "Application admin groups updated"
    );

    res.send({ message: "Admin groups saved" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};