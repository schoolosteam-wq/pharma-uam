const db = require("../models");
const Request = db.Request;
const RequestDocument = db.RequestDocument;
const WorkflowDefinition = db.WorkflowDefinition;
const WorkflowHistory = db.WorkflowHistory;
const User = db.User;
const Role = db.Role;
const Group = db.Group;
const ApplicationRole = db.ApplicationRole;
const UserApplicationRole = db.UserApplicationRole;
const ActivityWorkflowDefinition = db.ActivityWorkflowDefinition;
const { auditHelper } = require("../utils/auditHelper");
const { sendEmail } = require("../utils/emailHelper");
const { getUserFacilities, applyFacilityFilter } = require("../utils/facilityFilter");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

// ---------- Enhanced email notification helper ----------
async function sendRequestNotification(requestId, action, actionBy, comments = "") {
  try {
    const request = await Request.findByPk(requestId, {
      include: [
        { model: User, as: "requester", attributes: ["id", "username", "fullName", "email"] },
        { model: User, as: "targetUser", attributes: ["id", "username", "fullName", "email"] }
      ]
    });
    if (!request) return;

    const requestUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/requests/${request.id}`;
    const actionByUser = await User.findByPk(actionBy, { attributes: ["fullName", "email"] });

    const emailSubject = `Request ${request.requestNo} - ${action}`;
    const emailBody = `
      <p><strong>Request:</strong> ${request.requestNo}</p>
      <p><strong>Type:</strong> ${request.type}</p>
      <p><strong>Status:</strong> ${request.status}</p>
      <p><strong>Action:</strong> ${action}</p>
      <p><strong>Performed By:</strong> ${actionByUser ? actionByUser.fullName : 'System'}</p>
      ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
      <p><a href="${requestUrl}">View Request</a></p>
    `;

    let recipients = [];

    if (action === "SUBMITTED") {
      if (request.requester && request.requester.email) recipients.push(request.requester.email);
      const steps = request.workflowSteps || [];
      if (steps.length > 0) {
        const firstStep = steps[0];
        if (firstStep.approverRole) {
          const approverRole = await Role.findOne({ where: { roleName: firstStep.approverRole } });
          if (approverRole) {
            const users = await approverRole.getUsers();
            users.forEach(u => { if (u.email) recipients.push(u.email); });
          }
        }
        if (firstStep.approverGroup) {
          const approverGroup = await Group.findOne({ where: { groupName: firstStep.approverGroup } });
          if (approverGroup) {
            const users = await approverGroup.getUsers();
            users.forEach(u => { if (u.email) recipients.push(u.email); });
          }
        }
      }
    } else if (action === "APPROVED") {
      if (request.requester && request.requester.email) recipients.push(request.requester.email);
      if (request.targetUser && request.targetUser.email) recipients.push(request.targetUser.email);
      await request.reload();
      const steps = request.workflowSteps || [];
      const updatedCurrentStep = request.currentStep;
      if (updatedCurrentStep <= steps.length) {
        const nextStep = steps[updatedCurrentStep - 1];
        if (nextStep) {
          if (nextStep.approverRole) {
            const approverRole = await Role.findOne({ where: { roleName: nextStep.approverRole } });
            if (approverRole) {
              const users = await approverRole.getUsers();
              users.forEach(u => { if (u.email) recipients.push(u.email); });
            }
          }
          if (nextStep.approverGroup) {
            const approverGroup = await Group.findOne({ where: { groupName: nextStep.approverGroup } });
            if (approverGroup) {
              const users = await approverGroup.getUsers();
              users.forEach(u => { if (u.email) recipients.push(u.email); });
            }
          }
        }
      } else {
        const itRole = await Role.findOne({ where: { roleName: "IT Administrator" } });
        if (itRole) {
          const users = await itRole.getUsers();
          users.forEach(u => { if (u.email) recipients.push(u.email); });
        }
        const itGroup = await Group.findOne({ where: { groupName: "IT Administrator" } });
        if (itGroup) {
          const users = await itGroup.getUsers();
          users.forEach(u => { if (u.email) recipients.push(u.email); });
        }
      }
    } else if (action === "REJECTED" || action === "RETURNED") {
      if (request.requester && request.requester.email) recipients.push(request.requester.email);
      if (request.targetUser && request.targetUser.email) recipients.push(request.targetUser.email);
    } else if (action === "RESUBMIT_CREATED") {
      if (request.requester && request.requester.email) recipients.push(request.requester.email);
      const steps = request.workflowSteps || [];
      if (steps.length > 0) {
        const firstStep = steps[0];
        if (firstStep.approverRole) {
          const approverRole = await Role.findOne({ where: { roleName: firstStep.approverRole } });
          if (approverRole) {
            const users = await approverRole.getUsers();
            users.forEach(u => { if (u.email) recipients.push(u.email); });
          }
        }
        if (firstStep.approverGroup) {
          const approverGroup = await Group.findOne({ where: { groupName: firstStep.approverGroup } });
          if (approverGroup) {
            const users = await approverGroup.getUsers();
            users.forEach(u => { if (u.email) recipients.push(u.email); });
          }
        }
      }
    }

    recipients = [...new Set(recipients)];
    for (const email of recipients) {
      if (email) {
        await sendEmail(email, emailSubject, emailBody);
      }
    }
  } catch (error) {
    console.error(`Email notification failed for action ${action}:`, error);
  }
}

// ---------- Helper: generate request number ----------
async function generateRequestNo(version = null) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await Request.count({
    where: { requestNo: { [db.Sequelize.Op.like]: `REQ-${dateStr}-%` } }
  });
  const seq = String(count + 1).padStart(4, "0");
  const base = `REQ-${dateStr}-${seq}`;
  return version ? `${base}-R${version}` : base;
}

// ==================== CREATE ====================
exports.create = async (req, res) => {
  try {
    const currentUser = await User.findByPk(req.userId, {
      include: [{ model: Role, as: "roles" }]
    });
    const isUser = currentUser.roles.some(r => r.roleName === "User");
    if (!isUser) {
      return res.status(403).send({ message: "Only users with the 'User' role can create requests." });
    }

    const { type, targetUserId, payload } = req.body;

    // ✅ अगर targetUserId नहीं भेजा तो requester खुद target है
    const finalTargetUserId = targetUserId || req.userId;

    // ---- facilityId resolve करें ----
    let facilityId = req.body.facilityId || null;

    if (!facilityId && payload?.applicationId) {
      const app = await db.Application.findByPk(payload.applicationId, {
        attributes: ["id", "facilityId"]
      });
      facilityId = app?.facilityId || null;
    }

    if (!facilityId) {
      const targetUser = await User.findByPk(finalTargetUserId, {
        include: [{ model: db.Facility, as: "facilities", attributes: ["id"] }]
      });
      if (targetUser && targetUser.facilities && targetUser.facilities.length > 0) {
        facilityId = targetUser.facilities[0].id;
      }
    }

    if (!facilityId) {
      const currentUserFacs = await getUserFacilities(req.userId);
      if (currentUserFacs !== null && currentUserFacs.length > 0) {
        facilityId = currentUserFacs[0];
      }
    }

    const requestNo = await generateRequestNo();

    const request = await Request.create({
      requestNo,
      type,
      requesterId: req.userId,
      targetUserId: finalTargetUserId,
      payload,
      status: "DRAFT",
      facilityId,
      createdBy: req.userId,
    });

    // ❌ यहाँ कोई audit नहीं बनेगा – audit सिर्फ submit पर बनेगा
    res.status(201).send(request);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ==================== SUBMIT ====================
exports.submit = async (req, res) => {
  try {
    const requestId = req.params.id;
    const request = await Request.findByPk(requestId);
    if (!request) return res.status(404).send({ message: "Request not found" });
    if (request.status !== "DRAFT")
      return res.status(400).send({ message: "Only draft requests can be submitted" });

    let steps = [];

    // पहले fixed workflow देखें
    const wfDef = await WorkflowDefinition.findOne({
      where: { moduleType: request.type, isActive: true }
    });

    if (wfDef) {
      steps = wfDef.steps;
    } else {
      // custom activity workflow देखें
      const activityWf = await db.ActivityWorkflowDefinition.findOne({
        where: { activityName: request.type, isActive: true }
      });
      if (activityWf) {
        steps = activityWf.steps;
      } else {
        return res.status(400).send({ message: "No workflow defined for this activity" });
      }
    }

    await request.update({
      status: "SUBMITTED",
      workflowSteps: steps,
      currentStep: 1,
      version: 1
    });

    await WorkflowHistory.create({
      requestId: request.id,
      version: 1,
      stepNo: 0,
      stepName: "Submission",
      action: "SUBMITTED",
      actionBy: req.userId,
      comments: "Request submitted"
    });

    // ===== Simple audit =====
    const requester = await User.findByPk(request.requesterId, {
      attributes: ["username", "fullName"]
    });
    const target = request.targetUserId
      ? await User.findByPk(request.targetUserId, { attributes: ["username", "fullName"] })
      : null;

    const auditDetails = {
      "Request No": request.requestNo,
      Type: request.type.replace(/_/g, " "),
      Requester: requester ? requester.fullName || requester.username : "",
      Target: target ? target.fullName || target.username : "",
    };

    // ✅ Application name अगर payload में applicationId है
    if (request.payload?.applicationId) {
      const app = await db.Application.findByPk(request.payload.applicationId, {
        attributes: ["id", "name"]
      });
      if (app) {
        auditDetails["Application"] = app.name;
      }
    }

    // ✅ Requested Role अगर payload में है
    if (request.payload?.requestedRole) {
      auditDetails["Requested Role"] = request.payload.requestedRole;
    }

    await auditHelper(
      "REQUEST",
      request.id,
      "SUBMITTED",
      null,
      auditDetails,
      req.userId,
      req.ip,
      "Request submitted"
    );

    await sendRequestNotification(request.id, "SUBMITTED", req.userId);

    res.send({ message: "Request submitted", requestNo: request.requestNo });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ==================== APPROVE STEP ====================
exports.approveStep = async (req, res) => {
  try {
    const { comments } = req.body;
    const request = await Request.findByPk(req.params.id);
    if (!request) return res.status(404).send({ message: "Request not found" });
    if (request.status !== "SUBMITTED" && request.status !== "IN_PROGRESS")
      return res.status(400).send({ message: "Request not in approvable state" });

    const steps = request.workflowSteps;
    const currentStepIdx = request.currentStep - 1;
    if (currentStepIdx >= steps.length)
      return res.status(400).send({ message: "All steps already completed" });

    const user = await User.findByPk(req.userId, {
      include: [{ model: Role, as: "roles" }, { model: Group, as: "groups" }]
    });
    const step = steps[currentStepIdx];
    let authorized = false;
    if (step.approverRole) {
      authorized = user.roles.some(r => r.roleName === step.approverRole);
    }
    if (step.approverGroup) {
      authorized = authorized || user.groups.some(g => g.groupName === step.approverGroup);
    }

    // Global admin fallback (पहले से)
    const isGlobalAdmin = user.roles.some(r =>
      ["Default Administrator", "Administrator", "IT Administrator"].includes(r.roleName)
    );

    // ✅ नया: Application Admin Groups चेक
    if (!authorized && !isGlobalAdmin && request.payload?.applicationId) {
      const app = await db.Application.findByPk(request.payload.applicationId, {
        include: [{ model: db.Group, as: "adminGroups", attributes: ["id"] }]
      });
      if (app && app.adminGroups) {
        const appAdminGroupIds = app.adminGroups.map(g => g.id);
        const userGroupIds = user.groups.map(g => g.id);
        authorized = userGroupIds.some(id => appAdminGroupIds.includes(id));
      }
    }

    if (!authorized && !isGlobalAdmin)
      return res.status(403).send({ message: "Not authorized for this step" });

    await WorkflowHistory.create({
      requestId: request.id,
      version: request.version,
      stepNo: step.step,
      stepName: step.name,
      action: "APPROVED",
      actionBy: req.userId,
      comments: comments || ""
    });

    const nextStep = currentStepIdx + 1;
    if (nextStep < steps.length) {
      await request.update({ currentStep: nextStep + 1, status: "IN_PROGRESS" });
    } else {
      await request.update({ status: "APPROVED", currentStep: steps.length + 1 });
    }

    await auditHelper("REQUEST", request.id, "STEP_APPROVED", { Status: request.status }, { Status: request.status }, req.userId, req.ip, `Step ${step.step} approved`);
    await sendRequestNotification(request.id, "APPROVED", req.userId, comments);

    res.send({ message: "Step approved" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ==================== RETURN REQUEST ====================
exports.returnRequest = async (req, res) => {
  try {
    const { comments } = req.body;
    const request = await Request.findByPk(req.params.id);
    if (!request) return res.status(404).send({ message: "Request not found" });
    if (request.status !== "SUBMITTED" && request.status !== "IN_PROGRESS")
      return res.status(400).send({ message: "Invalid state" });

    await request.update({ status: "RETURNED" });

    const steps = request.workflowSteps;
    const currentStepIdx = request.currentStep - 1;
    const step = steps[currentStepIdx] || { step: request.currentStep, name: "Unknown" };

    await WorkflowHistory.create({
      requestId: request.id,
      version: request.version,
      stepNo: step.step,
      stepName: step.name,
      action: "RETURNED",
      actionBy: req.userId,
      comments: comments || ""
    });

    await auditHelper("REQUEST", request.id, "RETURNED", { Status: request.status }, { Status: "RETURNED", Comments: comments }, req.userId, req.ip, "Request returned to requester");
    await sendRequestNotification(request.id, "RETURNED", req.userId, comments);

    res.send({ message: "Request returned to requester" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ==================== RESUBMIT ====================
exports.resubmit = async (req, res) => {
  try {
    const original = await Request.findByPk(req.params.id);
    if (!original) return res.status(404).send({ message: "Request not found" });
    if (original.status !== "RETURNED")
      return res.status(400).send({ message: "Only returned requests can be resubmitted" });

    const newVersion = original.version + 1;
    const newRequestNo = original.requestNo.replace(/-R\d+$/, "") + `-R${newVersion}`;

    const newRequest = await Request.create({
      requestNo: newRequestNo,
      type: original.type,
      requesterId: original.requesterId,
      targetUserId: original.targetUserId,
      payload: { ...original.payload, ...req.body.payload },
      status: "DRAFT",
      parentRequestId: original.id,
      version: newVersion,
      createdBy: req.userId
    });

    await auditHelper("REQUEST", newRequest.id, "RESUBMIT_CREATED", null, { "Original Request": original.requestNo }, req.userId, req.ip, "Request resubmitted as new version");
    await sendRequestNotification(newRequest.id, "RESUBMIT_CREATED", req.userId);

    res.status(201).send(newRequest);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ==================== REJECT REQUEST ====================
exports.rejectRequest = async (req, res) => {
  try {
    const request = await Request.findByPk(req.params.id);
    if (!request) return res.status(404).send({ message: "Request not found" });
    if (request.status !== "SUBMITTED" && request.status !== "IN_PROGRESS")
      return res.status(400).send({ message: "Invalid state" });

    await request.update({ status: "REJECTED" });
    await WorkflowHistory.create({
      requestId: request.id,
      version: request.version,
      stepNo: request.currentStep,
      stepName: "Rejection",
      action: "REJECTED",
      actionBy: req.userId,
      comments: req.body.comments || ""
    });
    await auditHelper("REQUEST", request.id, "REJECTED", { Status: request.status }, { Status: "REJECTED", Comments: req.body.comments || "" }, req.userId, req.ip, "Request rejected");
    await sendRequestNotification(request.id, "REJECTED", req.userId, req.body.comments);

    res.send({ message: "Request rejected" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ==================== UPLOAD DOCUMENT ====================
exports.uploadDocument = async (req, res) => {
  try {
    const requestId = req.params.id;
    if (!req.file) return res.status(400).send({ message: "No file" });

    const doc = await RequestDocument.create({
      requestId,
      filePath: req.file.path,
      originalName: req.file.originalname
    });
    await auditHelper("REQUEST", requestId, "DOCUMENT_UPLOADED", null, { File: req.file.originalname }, req.userId, req.ip, "Document uploaded");
    res.send(doc);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ==================== FIND ALL ====================
exports.findAll = async (req, res) => {
  try {
    const { status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    // Permission check
    const user = await User.findByPk(req.userId, {
      include: [{ model: Role, as: "roles", include: [db.Permission] }]
    });
    const hasPermission = user.roles.some(role =>
      role.permissions?.some(p => p.permissionName === "VIEW_REQUEST")
    );

    if (!hasPermission) {
      where.requesterId = req.userId;
    }

    // ✅ Build base query
    let query = {
      where,
      include: [
        { model: User, as: "requester", attributes: ["id", "username", "fullName"] },
        { model: User, as: "targetUser", attributes: ["id", "username", "fullName"] }
      ],
      order: [["createdAt", "DESC"]]
    };

    // ✅ Apply facility filter – uses req.userId and optional x-facility-id header
    // Request model में facilityId column है (जो हमने associations में add किया था)
    query = await applyFacilityFilter(
      query,
      req.userId,
      "facilityId",
      req.headers['x-facility-id']
    );

    const requests = await Request.findAll(query);
    res.send(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).send({ message: error.message });
  }
};

// ==================== FIND ONE ====================
exports.findOne = async (req, res) => {
  try {
    const request = await Request.findByPk(req.params.id, {
      include: [
        { model: User, as: "requester", attributes: ["id", "username", "fullName", "department", "departmentId", "email"] },
        { model: User, as: "targetUser", attributes: ["id", "username", "fullName", "department", "departmentId", "email"] },
        { model: RequestDocument, as: "documents" },
        {
          model: WorkflowHistory,
          as: "workflowHistories",
          separate: true,
          order: [["actionDate", "ASC"]],
          include: [
            { model: User, as: "actionByUser", attributes: ["id", "username", "fullName"] }
          ]
        },
        // ✅ parent request
        { model: Request, as: "parentRequest", attributes: ["id", "requestNo", "version", "status"] },
        // ✅ child requests (versions)
        { model: Request, as: "childRequests", attributes: ["id", "requestNo", "version", "status"] },
      ],
    });
    if (!request) return res.status(404).send({ message: "Request not found" });

    // ✅ Application name from payload.applicationId (if exists)
    let applicationName = null;
    if (request.payload?.applicationId) {
      const app = await db.Application.findByPk(request.payload.applicationId, {
        attributes: ["id", "name"],
      });
      applicationName = app ? app.name : null;
    }

    res.send({
      ...request.toJSON(),
      applicationName,
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ==================== COMPLETE WITH PASSWORD ====================
exports.completeWithPassword = async (req, res) => {
  try {
    const requestId = req.params.id;
    const request = await Request.findByPk(requestId);
    if (!request) return res.status(404).send({ message: "Request not found" });

    const { itAdminUsername, itAdminPassword, newUserId, newPassword } = req.body;

    // IT Admin authentication
    const admin = await User.findOne({ where: { username: itAdminUsername } });
    if (!admin || !bcrypt.compareSync(itAdminPassword, admin.passwordHash)) {
      return res.status(401).send({ message: "Invalid IT Admin credentials" });
    }

    const targetUser = await User.findByPk(request.targetUserId || request.requesterId);
    if (!targetUser) return res.status(400).send({ message: "Target user not found" });

    const appId = request.payload?.applicationId;
    const application = appId ? await db.Application.findByPk(appId) : null;

    // ✅ Payload में credentials (application-specific) store करें – UAM password नहीं
    let updatedPayload = { ...request.payload };
    if (newUserId || newPassword) {
      updatedPayload.credentials = { userId: newUserId, password: newPassword };
    }

    // ---------- 1. NEW_USER ----------
    if (request.type === "NEW_USER") {
      if (!newUserId || !newPassword) {
        return res.status(400).send({ message: "New User ID and Password are required" });
      }
      if (!appId) return res.status(400).send({ message: "Application ID missing" });

      // ActiveUserList entry बनाएं
      const existing = await db.ActiveUserList.findOne({
        where: { userId: targetUser.id, applicationId: appId },
      });
      if (!existing) {
        await db.ActiveUserList.create({
          userId: targetUser.id,
          applicationId: appId,
          username: newUserId,               // ✅ application-specific user ID
          passwordLastSet: new Date(),
          status: "Active",
          approvedBy: req.userId,
        });
      }

      // Application Role assign करें (यदि requestedRole हो)
      if (request.payload?.requestedRole) {
        const appRole = await db.ApplicationRole.findOne({
          where: { applicationId: appId, roleName: request.payload.requestedRole }
        });
        if (appRole) {
          const existingRole = await db.UserApplicationRole.findOne({
            where: { userId: targetUser.id, applicationRoleId: appRole.id }
          });
          if (!existingRole) {
            await db.UserApplicationRole.create({
              userId: targetUser.id,
              applicationRoleId: appRole.id
            });
          }
        }
      }

      // Email भेजें – credentials request details में देखें
      if (targetUser.email) {
        await sendEmail(
          targetUser.email,
          `Request ${request.requestNo} completed`,
          `<p>Your application credentials are ready. Please login and view the request details.</p>`
        );
      }
    }

    // ---------- 2. ROLE_CHANGE ----------
    else if (request.type === "ROLE_CHANGE") {
      if (!appId || !request.payload?.requestedRole) {
        return res.status(400).send({ message: "Role change requires applicationId and requestedRole" });
      }

      // पुरानी role मैपिंग हटाओ
      const oldRoles = await db.UserApplicationRole.findAll({
        where: { userId: targetUser.id },
        include: [{ model: db.ApplicationRole, where: { applicationId: appId } }]
      });
      for (const old of oldRoles) await old.destroy();

      // नई role जोड़ो
      const newAppRole = await db.ApplicationRole.findOne({
        where: { applicationId: appId, roleName: request.payload.requestedRole }
      });
      if (newAppRole) {
        await db.UserApplicationRole.create({
          userId: targetUser.id,
          applicationRoleId: newAppRole.id
        });
      }

      if (targetUser.email) {
        await sendEmail(targetUser.email, `Request ${request.requestNo} completed`,
          `<p>Your role has been updated.</p>`);
      }
    }

    // ---------- 3. DEACTIVATE ----------
    else if (request.type === "DEACTIVATE") {
      if (!appId) return res.status(400).send({ message: "Deactivation requires applicationId" });

      // सिर्फ ActiveUserList का status Inactive करें, role न हटाएं
      const activeEntry = await db.ActiveUserList.findOne({
        where: { userId: targetUser.id, applicationId: appId }
      });
      if (activeEntry) {
        activeEntry.status = "Inactive";
        await activeEntry.save();
      }

      if (targetUser.email) {
        await sendEmail(targetUser.email, `Request ${request.requestNo} completed`,
          `<p>Your account has been deactivated.</p>`);
      }
    }

    // ---------- 4. PASSWORD_RESET, UNLOCK, REACTIVATE – ticket only ----------
    else {
      // कोई सिस्टम बदलाव नहीं, सिर्फ notification
      if (targetUser.email) {
        await sendEmail(targetUser.email, `Request ${request.requestNo} completed`,
          `<p>Your request has been completed.</p>`);
      }
    }

    // Request completed
    await request.update({
      payload: updatedPayload,
      status: "COMPLETED"
    });

    await auditHelper("REQUEST", request.id, "COMPLETED_WITH_PASSWORD", null, { Status: "COMPLETED" }, req.userId, req.ip, "Request completed");
    res.send({ message: "Request completed successfully" });
  } catch (error) {
    console.error("completeWithPassword error:", error);
    res.status(500).send({ message: error.message });
  }
};

// ==================== COMPLETE FACILITY ACCESS ====================
exports.completeFacilityAccess = async (req, res) => {
  try {
    const requestId = req.params.id;
    const request = await Request.findByPk(requestId);
    if (!request) return res.status(404).send({ message: "Request not found" });

    const { itAdminUsername, itAdminPassword } = req.body;

    // IT Admin authentication
    const admin = await User.findOne({ where: { username: itAdminUsername } });
    if (!admin || !bcrypt.compareSync(itAdminPassword, admin.passwordHash)) {
      return res.status(401).send({ message: "Invalid IT Admin credentials" });
    }

    // Get target user and requested facility from payload
    const targetUser = await User.findByPk(request.targetUserId || request.requesterId);
    const requestedFacilityId = request.payload?.requestedFacilityId;

    if (!targetUser || !requestedFacilityId) {
      return res.status(400).send({ message: "Target user or facility not found in request" });
    }

    // Assign the new facility to the user (add, don't replace)
    const facility = await Facility.findByPk(requestedFacilityId);
    if (!facility) return res.status(404).send({ message: "Facility not found" });

    await targetUser.addFacility(facility);   // many-to-many add

    // Update request status
    await request.update({ status: "COMPLETED" });

    // Send email notification
    if (targetUser.email) {
      try {
        await sendEmail(
          targetUser.email,
          `Facility Access Granted – ${facility.name}`,
          `<p>Dear ${targetUser.fullName},</p>
           <p>Your request for access to <strong>${facility.name}</strong> has been approved.</p>
           <p>You can now login and select this facility from the dropdown.</p>`
        );
      } catch (e) { console.error("Facility access email failed", e); }
    }

    await auditHelper("REQUEST", request.id, "FACILITY_ACCESS_COMPLETED", null, {
      TargetUser: targetUser.username,
      Facility: facility.name
    }, req.userId, req.ip, "Facility access granted");

    res.send({ message: "Facility access granted" });
  } catch (error) {
    console.error("completeFacilityAccess error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.generateRequestNo = generateRequestNo;