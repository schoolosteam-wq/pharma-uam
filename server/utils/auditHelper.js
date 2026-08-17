const db = require("../models");
const AuditTrail = db.AuditTrail;
const { normalizeIp } = require("./ipHelper");

/**
 * oldVal और newVal से changed fields निकालें
 */
function getChangedFields(oldVal, newVal) {
  if (!oldVal || !newVal) return null;
  const changes = {};
  for (const key of Object.keys(newVal)) {
    if (JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key])) {
      changes[key] = { old: oldVal[key], new: newVal[key] };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

exports.auditHelper = async (entityType, entityId, action, oldValue, newValue, changedBy, ipAddress, comments = null) => {
  const ip = normalizeIp(ipAddress);
  console.log(`[AUDIT] ${entityType}#${entityId} ${action} by user ${changedBy} from ${ip}`);

  try {
    // 21 CFR Part 11 के लिए पूरी old/new values स्टोर करें
    await AuditTrail.create({
      entityType,
      entityId: String(entityId),
      action,
      oldValue: oldValue || null,
      newValue: newValue || null,
      changedBy: changedBy || null,
      ipAddress: ip,
      comments: comments || null,
    });
  } catch (err) {
    console.error(`[AUDIT FAIL] ${entityType} ${action} – ${err.message}`);
  }
};