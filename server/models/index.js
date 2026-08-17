const { Sequelize } = require("sequelize");
const dbConfig = require("../config/db.config");

const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  port: dbConfig.PORT,
  dialect: dbConfig.dialect,
  pool: dbConfig.pool,
  logging: false
});

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// ---------- Models ----------
db.Setting = require("./setting.model")(sequelize, Sequelize);
db.Facility = require("./facility.model")(sequelize, Sequelize);
db.User = require("./user.model")(sequelize, Sequelize);
db.Role = require("./role.model")(sequelize, Sequelize);
db.Group = require("./group.model")(sequelize, Sequelize);
db.Permission = require("./permission.model")(sequelize, Sequelize);
db.UserRole = require("./userRole.model")(sequelize, Sequelize);
db.UserGroup = require("./userGroup.model")(sequelize, Sequelize);
db.AuditTrail = require("./auditTrail.model")(sequelize, Sequelize);
db.Application = require("./application.model")(sequelize, Sequelize);
db.ApplicationRole = require("./applicationRole.model")(sequelize, Sequelize);
db.ApplicationGroup = require("./applicationGroup.model")(sequelize, Sequelize);
db.Instrument = require("./instrument.model")(sequelize, Sequelize);
db.Computer = require("./computer.model")(sequelize, Sequelize);
db.ComputerInstrument = require("./computerInstrument.model")(sequelize, Sequelize);
db.ComputerApplication = require("./computerApplication.model")(sequelize, Sequelize);
db.Request = require("./request.model")(sequelize, Sequelize);
db.RequestDocument = require("./requestDocument.model")(sequelize, Sequelize);
db.WorkflowDefinition = require("./workflowDefinition.model")(sequelize, Sequelize);
db.MasterActivity = require("./masterActivity.model")(sequelize, Sequelize);
db.ActivityWorkflowDefinition = require("./activityWorkflowDefinition.model")(sequelize, Sequelize);
db.ApplicationActivity = require("./applicationActivity.model")(sequelize, Sequelize);
db.WorkflowHistory = require("./workflowHistory.model")(sequelize, Sequelize);
db.UserFacility = require("./userFacility.model")(sequelize, Sequelize);
db.UserApplicationRole = require("./userApplicationRole.model")(sequelize, Sequelize);
db.UserApplicationGroup = require("./userApplicationGroup.model")(sequelize, Sequelize);

// ✅ New model: ApplicationAdminGroup
db.ApplicationAdminGroup = require("./applicationAdminGroup.model")(sequelize, Sequelize);

// नीचे दो लाइनें अभी ज़रूरी नहीं, Phase 4 में आएँगी – कमेंट कर दें
db.ActiveUserList = require("./activeUserList.model")(sequelize, Sequelize);
// db.LogoSetting = require("./logoSetting.model")(sequelize, Sequelize);

// ---------- Associations ----------

// Facility self‑reference (parent‑child)
db.Facility.hasMany(db.Facility, { as: "children", foreignKey: "parentId" });
db.Facility.belongsTo(db.Facility, { as: "parent", foreignKey: "parentId" });

// User ↔ Facility (many‑to‑many)
db.User.belongsToMany(db.Facility, { through: db.UserFacility, foreignKey: "userId", as: "facilities" });
db.Facility.belongsToMany(db.User, { through: db.UserFacility, foreignKey: "facilityId", as: "users" });

// Legacy column (not used actively)
db.User.belongsTo(db.Facility, { foreignKey: "facilityId", as: "primaryFacility" });

// User ↔ Role
db.User.belongsToMany(db.Role, { through: db.UserRole, foreignKey: "userId" });
db.Role.belongsToMany(db.User, { through: db.UserRole, foreignKey: "roleId" });

// User ↔ Group
db.User.belongsToMany(db.Group, { through: db.UserGroup, foreignKey: "userId" });
db.Group.belongsToMany(db.User, { through: db.UserGroup, foreignKey: "groupId" });

// Role ↔ Permission
db.Role.hasMany(db.Permission, { foreignKey: "roleId" });
db.Permission.belongsTo(db.Role, { foreignKey: "roleId" });

// AuditTrail ↔ User
db.AuditTrail.belongsTo(db.User, { foreignKey: "changedBy", as: "changedByUser" });

// Application, Instrument, Computer ↔ Facility
db.Application.belongsTo(db.Facility, { foreignKey: "facilityId", as: "facility" });
db.Instrument.belongsTo(db.Facility, { foreignKey: "facilityId", as: "facility" });
db.Computer.belongsTo(db.Facility, { foreignKey: "facilityId", as: "facility" });
db.Request.belongsTo(db.Facility, { foreignKey: "facilityId", as: "facility" });

// Instrument ↔ Application
db.Instrument.belongsTo(db.Application, { foreignKey: "applicationId", as: "application" });
db.Application.hasMany(db.Instrument, { foreignKey: "applicationId" });

// Computer ↔ Instrument (many‑to‑many)
db.Computer.belongsToMany(db.Instrument, { through: db.ComputerInstrument, foreignKey: "computerId" });
db.Instrument.belongsToMany(db.Computer, { through: db.ComputerInstrument, foreignKey: "instrumentId" });

// Computer ↔ Application (many‑to‑many)
db.Computer.belongsToMany(db.Application, { through: db.ComputerApplication, foreignKey: "computerId" });
db.Application.belongsToMany(db.Computer, { through: db.ComputerApplication, foreignKey: "applicationId" });

// Request associations
db.Request.belongsTo(db.User, { as: "requester", foreignKey: "requesterId" });
db.Request.belongsTo(db.User, { as: "targetUser", foreignKey: "targetUserId" });
db.Request.hasMany(db.RequestDocument, { foreignKey: "requestId", as: "documents" });
db.Request.hasMany(db.WorkflowHistory, { foreignKey: "requestId", as: "workflowHistories" });
db.Request.belongsTo(db.Request, { as: "parentRequest", foreignKey: "parentRequestId" });

// ---------- नए Associations (Application‑specific Roles/Groups) ----------
db.Application.hasMany(db.ApplicationRole, { foreignKey: "applicationId", as: "applicationRoles" });
db.ApplicationRole.belongsTo(db.Application, { foreignKey: "applicationId" });

db.Application.hasMany(db.ApplicationGroup, { foreignKey: "applicationId", as: "applicationGroups" });
db.ApplicationGroup.belongsTo(db.Application, { foreignKey: "applicationId" });
// ---------- User ↔ ApplicationRole/Group (many‑to‑many) ----------
db.User.belongsToMany(db.ApplicationRole, {
  through: db.UserApplicationRole,
  foreignKey: "userId",
  as: "applicationRoles"
});
db.ApplicationRole.belongsToMany(db.User, {
  through: db.UserApplicationRole,
  foreignKey: "applicationRoleId",
  as: "users"
});

db.User.belongsToMany(db.ApplicationGroup, {
  through: db.UserApplicationGroup,
  foreignKey: "userId",
  as: "applicationGroups"
});
db.ApplicationGroup.belongsToMany(db.User, {
  through: db.UserApplicationGroup,
  foreignKey: "applicationGroupId",
  as: "users"
});

// ---------- Direct belongsTo for query includes ----------
db.UserApplicationRole.belongsTo(db.ApplicationRole, { foreignKey: "applicationRoleId" });
db.UserApplicationGroup.belongsTo(db.ApplicationGroup, { foreignKey: "applicationGroupId" });

// ✅ Application ↔ Group (many‑to‑many) for admin
db.Application.belongsToMany(db.Group, {
  through: db.ApplicationAdminGroup,
  foreignKey: "applicationId",
  otherKey: "groupId",
  as: "adminGroups"
});
db.Group.belongsToMany(db.Application, {
  through: db.ApplicationAdminGroup,
  foreignKey: "groupId",
  otherKey: "applicationId",
  as: "adminApplications"
});

db.ActiveUserList.belongsTo(db.User, { foreignKey: "userId" });
db.WorkflowHistory.belongsTo(db.User, { as: "actionByUser", foreignKey: "actionBy" });

db.PasswordHistory = require("./passwordHistory.model")(sequelize, Sequelize);
db.PasswordHistory.belongsTo(db.User, { foreignKey: "userId" });
db.User.hasMany(db.PasswordHistory, { foreignKey: "userId" });

// Association
db.Application.hasMany(db.ApplicationActivity, { foreignKey: "applicationId", as: "applicationActivities" });
db.ApplicationActivity.belongsTo(db.Application, { foreignKey: "applicationId" });

// ApplicationAdminGroup direct associations
db.ApplicationAdminGroup.belongsTo(db.Group, { foreignKey: "groupId" });
db.ApplicationAdminGroup.belongsTo(db.Application, { foreignKey: "applicationId" });

module.exports = db;