const db = require("../models");
const MasterActivity = db.MasterActivity;
const { auditHelper } = require("../utils/auditHelper");

exports.create = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    const activity = await MasterActivity.create({
      name,
      description: description || "",
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.userId,
    });
    await auditHelper("MASTER_ACTIVITY", activity.id, "CREATED", null, {
      Name: activity.name,
      Description: activity.description,
      "Is Active": activity.isActive ? "Yes" : "No",
    }, req.userId, req.ip, "Master activity created");
    res.status(201).send(activity);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const activities = await MasterActivity.findAll({ order: [["name", "ASC"]] });
    res.send(activities);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const activity = await MasterActivity.findByPk(req.params.id);
    if (!activity) return res.status(404).send({ message: "Not found" });
    res.send(activity);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const activity = await MasterActivity.findByPk(req.params.id);
    if (!activity) return res.status(404).send({ message: "Not found" });

    const oldVal = {
      Name: activity.name,
      Description: activity.description,
      "Is Active": activity.isActive ? "Yes" : "No",
    };

    const { name, description, isActive } = req.body;
    await activity.update({
      name,
      description,
      isActive,
      updatedBy: req.userId,
    });

    const newVal = {
      Name: activity.name,
      Description: activity.description,
      "Is Active": activity.isActive ? "Yes" : "No",
    };

    const changedOld = {}, changedNew = {};
    for (const key of Object.keys(oldVal)) {
      if (oldVal[key] !== newVal[key]) {
        changedOld[key] = oldVal[key];
        changedNew[key] = newVal[key];
      }
    }
    if (Object.keys(changedOld).length > 0) {
      changedOld["Name"] = activity.name;
      changedNew["Name"] = activity.name;
    }

    await auditHelper("MASTER_ACTIVITY", activity.id, "UPDATED", changedOld, changedNew, req.userId, req.ip, "Master activity updated");
    res.send(activity);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const activity = await MasterActivity.findByPk(req.params.id);
    if (!activity) return res.status(404).send({ message: "Not found" });

    const oldVal = {
      Name: activity.name,
      Description: activity.description,
    };
    await activity.destroy();
    await auditHelper("MASTER_ACTIVITY", req.params.id, "DELETED", oldVal, null, req.userId, req.ip, "Master activity deleted");
    res.send({ message: "Deleted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};