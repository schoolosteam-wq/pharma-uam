const db = require("../models");
const Application = db.Application;
const ApplicationActivity = db.ApplicationActivity;
const { auditHelper } = require("../utils/auditHelper");

// Get enabled activity names for an application
exports.getActivities = async (req, res) => {
  try {
    const applicationId = req.params.id;
    const rows = await ApplicationActivity.findAll({ where: { applicationId, isEnabled: true } });
    res.send(rows.map(r => r.activityName));
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// Save/update activity mapping for an application
exports.saveActivities = async (req, res) => {
  try {
    const applicationId = req.params.id;
    const { activities } = req.body;   // array of activity names (strings)

    if (!Array.isArray(activities)) {
      return res.status(400).send({ message: "activities must be an array" });
    }

    // Get old mapping for audit
    const oldRows = await ApplicationActivity.findAll({ where: { applicationId } });
    const oldActivities = oldRows.filter(r => r.isEnabled).map(r => r.activityName).sort();

    // Remove all existing for this application, then insert new ones
    await ApplicationActivity.destroy({ where: { applicationId } });

    const newRows = activities.map(name => ({
      applicationId,
      activityName: name,
      isEnabled: true
    }));
    if (newRows.length > 0) {
      await ApplicationActivity.bulkCreate(newRows);
    }

    // Audit
    await auditHelper(
      "APPLICATION_ACTIVITY", applicationId, "MAPPING_UPDATED",
      { activities: oldActivities },
      { activities: [...activities].sort() },
      req.userId, req.ip,
      "Application activities updated"
    );

    res.send({ message: "Activity mapping saved" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};