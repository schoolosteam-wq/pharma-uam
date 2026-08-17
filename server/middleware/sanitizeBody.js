// List of all Sequelize association keys that must never be set directly
const forbiddenKeys = [
  "application", "instruments", "computers", // instrument & computer associations
  "parent", "children", "facility",          // facility
  "roles", "groups", "permissions",          // user
  "requester", "targetUser",                 // request
  "documents", "workflowHistories",          // request
  "applications",                            // computer/application many-to-many
  "userRoles", "userGroups",                 // join tables
  "computerInstruments", "computerApplications" // join tables
];

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === "object") {
    forbiddenKeys.forEach((key) => {
      delete req.body[key];
    });
  }
  next();
}

module.exports = sanitizeBody;