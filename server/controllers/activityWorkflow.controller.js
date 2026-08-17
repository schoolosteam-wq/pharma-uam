const db = require("../models");
const ActivityWorkflowDefinition = db.ActivityWorkflowDefinition;
const { auditHelper } = require("../utils/auditHelper");

exports.create = async (req, res) => {
  try {
    const wf = await ActivityWorkflowDefinition.create(req.body);
    await auditHelper("ACTIVITY_WORKFLOW_DEF", wf.id, "CREATED", null, {
      Activity: wf.activityName,
      Steps: (wf.steps || []).map(s => s.name)
    }, req.userId, req.ip, "Activity workflow created");
    res.status(201).send(wf);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const defs = await ActivityWorkflowDefinition.findAll({ order: [["activityName", "ASC"]] });
    res.send(defs);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const wf = await ActivityWorkflowDefinition.findByPk(req.params.id);
    if (!wf) return res.status(404).send({ message: "Not found" });
    res.send(wf);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const wf = await ActivityWorkflowDefinition.findByPk(req.params.id);
    if (!wf) return res.status(404).send({ message: "Not found" });

    const oldVal = {
      Activity: wf.activityName,
      Steps: (wf.steps || []).map(s => s.name)
    };

    const { activityName, steps, isActive } = req.body;
    await wf.update({ activityName, steps, isActive });

    const newVal = {
      Activity: wf.activityName,
      Steps: (wf.steps || []).map(s => s.name)
    };

    const changedOld = {}, changedNew = {};
    for (const key of Object.keys(oldVal)) {
      if (JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key])) {
        changedOld[key] = oldVal[key];
        changedNew[key] = newVal[key];
      }
    }
    if (Object.keys(changedOld).length > 0) {
      changedOld["Activity"] = wf.activityName;
      changedNew["Activity"] = wf.activityName;
    }

    await auditHelper("ACTIVITY_WORKFLOW_DEF", wf.id, "UPDATED", changedOld, changedNew, req.userId, req.ip, "Activity workflow updated");
    res.send(wf);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const wf = await ActivityWorkflowDefinition.findByPk(req.params.id);
    if (!wf) return res.status(404).send({ message: "Not found" });

    const oldVal = {
      Activity: wf.activityName,
      Steps: (wf.steps || []).map(s => s.name)
    };
    await wf.destroy();
    await auditHelper("ACTIVITY_WORKFLOW_DEF", req.params.id, "DELETED", oldVal, null, req.userId, req.ip, "Activity workflow deleted");
    res.send({ message: "Deleted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};