// server/controllers/workflow.controller.js
const db = require("../models");
const WorkflowDefinition = db.WorkflowDefinition;
const User = db.User;
const { auditHelper } = require("../utils/auditHelper");

// Compare two step arrays and return added/removed step names
function stepDiff(oldSteps, newSteps) {
  const oldStr = oldSteps.map(s => JSON.stringify(s));
  const newStr = newSteps.map(s => JSON.stringify(s));

  const addedNames = newSteps
    .filter((_, i) => !oldStr.includes(newStr[i]))
    .map(s => s.name);

  const removedNames = oldSteps
    .filter((_, i) => !newStr.includes(oldStr[i]))
    .map(s => s.name);

  return {
    added: [...new Set(addedNames)],
    removed: [...new Set(removedNames)]
  };
}

exports.create = async (req, res) => {
  try {
    const wf = await WorkflowDefinition.create(req.body);
    const auditNewVal = {
      "Module Type": wf.moduleType,
      Steps: (wf.steps || []).map(s => s.name)
    };
    await auditHelper("WORKFLOW_DEF", wf.id, "CREATED", null, auditNewVal, req.userId, req.ip, "Workflow definition created");
    res.status(201).send(wf);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const wfs = await WorkflowDefinition.findAll();
    res.send(wfs);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const wf = await WorkflowDefinition.findByPk(req.params.id);
    if (!wf) return res.status(404).send({ message: "Not found" });
    res.send(wf);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const wf = await WorkflowDefinition.findByPk(req.params.id);
    if (!wf) return res.status(404).send({ message: "Not found" });

    const { auditAction, auditGroupName, auditRoleName, ...updateData } = req.body;

    await wf.update(updateData);

    const actionByUser = await User.findByPk(req.userId);
    const username = actionByUser ? actionByUser.fullName || actionByUser.username : 'Unknown';

    const changedOld = { "Module Type": wf.moduleType };
    const changedNew = { "Module Type": wf.moduleType };

    if (auditAction === 'added') {
      const stepName = auditGroupName ? `${auditGroupName} Approval` : (auditRoleName ? `${auditRoleName} Approval` : 'Unknown');
      changedNew["Added Steps"] = [stepName];
      changedNew["Added By"] = username;
    } else if (auditAction === 'removed') {
      const stepName = auditGroupName ? `${auditGroupName} Approval` : (auditRoleName ? `${auditRoleName} Approval` : 'Unknown');
      changedOld["Removed Steps"] = [stepName];
      changedNew["Removed By"] = username;
    } else {
      // ✅ Fallback: जब auditAction undefined हो (e.g., सीधे API से update)
      const oldSteps = (wf.previous('steps') || wf.steps || []).map(s => s.name);
      const newSteps = (wf.steps || []).map(s => s.name);
      changedOld["Steps"] = JSON.stringify(oldSteps);
      changedNew["Steps"] = JSON.stringify(newSteps);
    }

    await auditHelper("WORKFLOW_DEF", wf.id, "UPDATED", changedOld, changedNew, req.userId, req.ip, "Workflow definition updated");
    res.send(wf);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const wf = await WorkflowDefinition.findByPk(req.params.id);
    if (!wf) return res.status(404).send({ message: "Not found" });

    const auditOldVal = {
      "Module Type": wf.moduleType,
      Steps: (wf.steps || []).map(s => s.name)
    };
    await wf.destroy();

    await auditHelper("WORKFLOW_DEF", req.params.id, "DELETED", auditOldVal, null, req.userId, req.ip, "Workflow definition deleted");
    res.send({ message: "Deleted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};