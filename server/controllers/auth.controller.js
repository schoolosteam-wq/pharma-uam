const db = require("../models");
const User = db.User;
const AuditTrail = db.AuditTrail;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/auth.config");
const { normalizeIp } = require("../utils/ipHelper");
const ldap = require("ldapjs");
const { getADConfig } = require("../utils/adHelper");
const { sendEmail } = require("../utils/emailHelper");
const { auditHelper } = require("../utils/auditHelper");
const { Op } = require("sequelize");

const { generateRequestNo } = require("./request.controller");

// ---------- LDAP Authentication Helper (Safe & Robust) ----------
async function authenticateAD(user, password, adConfig) {
  if (!adConfig.ad_enabled || adConfig.ad_enabled !== "true") {
    throw new Error("AD authentication not enabled");
  }

  const domain = adConfig.ad_domain || "company.com";
  const netbiosCandidates = ["BVLDOMAIN", "BVL", domain.toUpperCase().split('.')[0]];

  const possibleUpns = new Set();

  if (user.domainUserId) {
    if (user.domainUserId.includes("@")) possibleUpns.add(user.domainUserId);
    else possibleUpns.add(`${user.domainUserId}@${domain}`);
  }
  if (user.username) {
    possibleUpns.add(`${user.username}@${domain}`);
    possibleUpns.add(user.username);
  }
  possibleUpns.add(`${domain}\\${user.domainUserId || user.username}`);
  for (const nb of netbiosCandidates) {
    possibleUpns.add(`${nb}\\${user.domainUserId || user.username}`);
  }

  // Search user details via admin bind
  try {
    const adminClient = ldap.createClient({ url: adConfig.ad_url });
    await new Promise((resolve, reject) => {
      adminClient.on("error", reject);
      adminClient.bind(adConfig.ad_username, adConfig.ad_password, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const searchOpts = {
      filter: `(sAMAccountName=${user.domainUserId || user.username})`,
      scope: "sub",
      attributes: ["userPrincipalName", "distinguishedName", "sAMAccountName", "userAccountControl", "lockoutTime"],
    };
    const searchResult = await new Promise((resolve, reject) => {
      const entries = [];
      adminClient.search(adConfig.ad_baseDN, searchOpts, (err, res) => {
        if (err) reject(err);
        res.on("searchEntry", (entry) => {
          const attrs = {};
          entry.attributes.forEach((attr) => {
            attrs[attr.type] = attr.values[0];
          });
          entries.push(attrs);
        });
        res.on("end", () => resolve(entries));
        res.on("error", reject);
      });
    });
    adminClient.destroy();

    if (searchResult.length > 0) {
      const attrs = searchResult[0];
      console.log(`[AD SEARCH] User ${user.username}:`, JSON.stringify(attrs, null, 2));
      if (attrs.userPrincipalName && attrs.userPrincipalName !== "") {
        possibleUpns.add(attrs.userPrincipalName);
      }
      if (attrs.distinguishedName && attrs.distinguishedName !== "") {
        possibleUpns.add(attrs.distinguishedName);
      }
    } else {
      console.error(`[AD SEARCH] No user found for ${user.username}`);
    }
  } catch (searchErr) {
    console.error(`[AD SEARCH] Failed for ${user.username}:`, searchErr.message);
  }

  let lastError = null;
  for (const upn of possibleUpns) {
    console.log(`[LDAP DEBUG] Trying bind for ${user.username}: ${upn}`);
    try {
      const client = ldap.createClient({ url: adConfig.ad_url });
      await new Promise((resolve, reject) => {
        let settled = false;
        const handleError = (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
          client.destroy();
        };
        client.on("error", handleError);
        client.on("connectTimeout", () => handleError(new Error("LDAP connection timeout")));
        client.bind(upn, password, (err) => {
          if (err) {
            handleError(err);
          } else {
            settled = true;
            client.destroy();
            resolve();
          }
        });
      });
      return true;
    } catch (err) {
      lastError = err;
      console.error(`[LDAP DEBUG] Bind failed for ${upn}:`, err.message);
      // Log full error properties if available
      if (err.code) console.error(`[LDAP DEBUG] Error code: ${err.code}`);
      if (err.dn) console.error(`[LDAP DEBUG] Error DN: ${err.dn}`);
    }
  }

  throw lastError || new Error("LDAP authentication failed");
}

// ---------- Precheck: बिना token/audit के credentials वेरिफाई करके facilities लौटाए ----------
exports.precheck = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({
      where: { username: { [Op.iLike]: username } },
      include: [{ model: db.Role, as: "roles" }]
    });

    if (!user) {
      return res.status(401).send({ message: "Invalid credentials" });
    }

    if (user.isActive === false) {
      return res.status(401).send({ message: "Account is inactive. Contact administrator." });
    }

    let passwordValid = false;
    if (!user.passwordHash) {
      try {
        const adConfig = await getADConfig();
        if (adConfig.ad_enabled !== "true") {
          return res.status(401).send({ message: "AD not enabled" });
        }
        const upn = `${user.domainUserId || user.username}@${adConfig.ad_domain || "company.com"}`;
        await authenticateAD(user, password, adConfig);   // ✅ Updated
        passwordValid = true;
      } catch (ldapErr) {
        console.error(`LDAP precheck failed for ${user.username}:`, ldapErr.message);
        passwordValid = false;
      }
    } else {
      passwordValid = bcrypt.compareSync(password, user.passwordHash);
      if (passwordValid && user.passwordExpiryDate && new Date(user.passwordExpiryDate) < new Date()) {
        return res.status(401).send({ message: "Password expired. Please contact IT support." });
      }
    }

    if (!passwordValid) {
      return res.status(401).send({ message: "Invalid credentials" });
    }

    // केवल फैक्ट्री सुविधाएँ लौटाएँ
    const allFacilities = await user.getFacilities({ attributes: ["id", "name", "code", "type"] });
    const facilities = allFacilities
      .filter(f => f.type === "FACTORY")
      .map(f => ({ id: f.id, name: f.name, code: f.code, type: f.type }));

    res.send({
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles.map(r => "ROLE_" + r.roleName.toUpperCase()),
      facilities,
    });
  } catch (error) {
    console.error("Precheck error:", error);
    res.status(500).send({ message: error.message });
  }
};

// ---------- Signin: facilityId के साथ, LOGIN audit में चयनित फैसिलिटी ----------
exports.signin = async (req, res) => {
  try {
    const { username, password, facilityId } = req.body;

    const user = await User.findOne({
      where: { username: { [Op.iLike]: username } },
      include: [{ model: db.Role, as: "roles" }]
    });

    if (!user) {
      return res.status(401).send({ message: "Invalid credentials" });
    }
    if (!user.isActive) {
      await AuditTrail.create({
        entityType: "USER",
        entityId: String(user.id),
        action: "LOGIN_FAILED",
        newValue: { Username: username },
        changedBy: user.id,
        ipAddress: normalizeIp(req.ip),
        comments: "Login failed – account inactive"
      });
      return res.status(401).send({ message: "Account is inactive. Contact administrator." });
    }

    let passwordValid = false;
    if (!user.passwordHash) {
      try {
        const adConfig = await getADConfig();
        if (adConfig.ad_enabled !== "true") {
          await AuditTrail.create({
            entityType: "USER",
            entityId: String(user.id),
            action: "LOGIN_FAILED",
            newValue: { Username: user.username },
            changedBy: user.id,
            ipAddress: normalizeIp(req.ip),
            comments: "Login failed – AD not enabled"
          });
          return res.status(401).send({ message: "AD authentication not enabled." });
        }
        const upn = `${user.domainUserId || user.username}@${adConfig.ad_domain || "company.com"}`;
        await authenticateAD(user, password, adConfig);   // ✅ Updated
        passwordValid = true;
      } catch (ldapErr) {
        console.error(`LDAP signin failed for ${user.username}:`, ldapErr.message);
        passwordValid = false;
      }
    } else {
      passwordValid = bcrypt.compareSync(password, user.passwordHash);
      if (passwordValid && user.passwordExpiryDate && new Date(user.passwordExpiryDate) < new Date()) {
        await AuditTrail.create({
          entityType: "USER",
          entityId: String(user.id),
          action: "LOGIN_FAILED",
          newValue: { Username: user.username },
          changedBy: user.id,
          ipAddress: normalizeIp(req.ip),
          comments: "Login failed – password expired"
        });
        return res.status(401).send({ message: "Password expired. Please contact IT support." });
      }
    }

    if (!passwordValid) {
      await AuditTrail.create({
        entityType: "USER",
        entityId: String(user.id),
        action: "LOGIN_FAILED",
        newValue: { Username: user.username },
        changedBy: user.id,
        ipAddress: normalizeIp(req.ip),
        comments: "Login failed – invalid password"
      });
      return res.status(401).send({ message: "Invalid credentials" });
    }

    // Token
    const token = jwt.sign({ id: user.id }, config.secret, { expiresIn: config.jwtExpiry });
    const authorities = user.roles.map(r => "ROLE_" + r.roleName.toUpperCase());

    // ✅ चयनित फैसिलिटी का नाम निकालें
    let selectedFacilityName = "All Facilities";
    if (facilityId) {
      const facility = await db.Facility.findByPk(facilityId, { attributes: ["id", "name", "type"] });
      if (facility && facility.type === "FACTORY") {
        selectedFacilityName = facility.name;
      }
    }

    await AuditTrail.create({
      entityType: "USER",
      entityId: String(user.id),
      action: "LOGIN",
      newValue: {
        Username: user.username,
        Facility: selectedFacilityName,
      },
      changedBy: user.id,
      ipAddress: normalizeIp(req.ip),
      comments: "User logged in"
    });

    res.status(200).send({
      id: user.id,
      username: user.username,
      email: user.email,
      roles: authorities,
      accessToken: token,
      facilities: [],   // precheck से मिलेगा, यहाँ खाली छोड़ें
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).send({ message: error.message });
  }
};

// ---------- Facility Switch ----------
exports.facilitySwitch = async (req, res) => {
  try {
    const { oldFacilityId, newFacilityId } = req.body;
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).send({ message: "User not found" });

    let oldFacilityName = "No Facility";
    let newFacilityName = "All Facilities";

    if (oldFacilityId) {
      const oldFac = await db.Facility.findByPk(oldFacilityId, { attributes: ["name"] });
      oldFacilityName = oldFac ? oldFac.name : "Unknown";
    }
    if (newFacilityId) {
      const newFac = await db.Facility.findByPk(newFacilityId, { attributes: ["name"] });
      newFacilityName = newFac ? newFac.name : "Unknown";
    }

    await AuditTrail.create({
      entityType: "USER",
      entityId: String(user.id),
      action: "FACILITY_SWITCH",
      oldValue: { Facility: oldFacilityName },
      newValue: { Username: user.username, Facility: newFacilityName },
      changedBy: user.id,
      ipAddress: normalizeIp(req.ip),
      comments: "Facility switched"
    });

    res.send({ message: "Facility switch recorded" });
  } catch (error) {
    console.error("Facility switch error:", error);
    res.status(500).send({ message: error.message });
  }
};

// ---------- Logout ----------
exports.signout = async (req, res) => {
  try {
    const { facilityId } = req.body;
    const user = await User.findByPk(req.userId);
    const username = user ? user.username : 'Unknown';

    let facilityName = "All Facilities";
    if (facilityId) {
      const facility = await db.Facility.findByPk(facilityId, { attributes: ["name"] });
      facilityName = facility ? facility.name : "All Facilities";
    }

    await AuditTrail.create({
      entityType: "USER",
      entityId: String(req.userId),
      action: "LOGOUT",
      newValue: {
        Username: username,
        Facility: facilityName,
      },
      changedBy: req.userId,
      ipAddress: normalizeIp(req.ip),
      comments: "User logged out"
    });
    res.status(200).send({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// ---------- Forgot Password ----------
exports.forgotPassword = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).send({ message: "Username is required" });

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.send({ message: "If the account exists, a password reset request has been submitted." });
    }

    if (!user.passwordHash) {
      return res.send({ message: "This account uses Active Directory. Please contact IT support for password reset." });
    }

    const Request = db.Request;
    const requestNo = await generateRequestNo();
    const request = await Request.create({
      requestNo,
      type: "PASSWORD_RESET",
      requesterId: user.id,
      targetUserId: user.id,
      payload: { details: "Password reset requested via Forgot Password" },
      status: "DRAFT",
      createdBy: user.id,
    });

    const wfDef = await db.WorkflowDefinition.findOne({
      where: { moduleType: "PASSWORD_RESET", isActive: true }
    });

    if (wfDef) {
      await request.update({
        status: "SUBMITTED",
        workflowSteps: wfDef.steps,
        currentStep: 1,
        version: 1,
      });
      await db.WorkflowHistory.create({
        requestId: request.id,
        version: 1,
        stepNo: 0,
        stepName: "Submission",
        action: "SUBMITTED",
        actionBy: user.id,
        comments: "Password reset requested via Forgot Password",
      });

      try {
        const requestUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/requests/${request.id}`;
        const emailSubject = `Password Reset Request ${request.requestNo}`;
        const emailBody = `<p>Password reset requested by ${user.fullName}.</p><p><a href="${requestUrl}">View Request</a></p>`;
        const steps = wfDef.steps;
        if (steps.length > 0) {
          const firstStep = steps[0];
          if (firstStep.approverRole) {
            const approverRole = await db.Role.findOne({ where: { roleName: firstStep.approverRole } });
            if (approverRole) {
              const approvers = await approverRole.getUsers();
              for (const approver of approvers) {
                if (approver.email) await sendEmail(approver.email, emailSubject, emailBody);
              }
            }
          }
          if (firstStep.approverGroup) {
            const approverGroup = await db.Group.findOne({ where: { groupName: firstStep.approverGroup } });
            if (approverGroup) {
              const approvers = await approverGroup.getUsers();
              for (const approver of approvers) {
                if (approver.email) await sendEmail(approver.email, emailSubject, emailBody);
              }
            }
          }
        }
      } catch (e) { console.error("Forgot password email failed", e); }
    }

    await auditHelper("REQUEST", request.id, "CREATED", null, {
      "Request No": requestNo,
      Type: "PASSWORD_RESET",
      Requester: user.username,
    }, user.id, normalizeIp(req.ip), "Password reset requested via Forgot Password");

    res.send({ message: "If the account exists, a password reset request has been submitted." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).send({ message: error.message });
  }
};