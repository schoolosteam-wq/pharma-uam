// List of association keys that must never be set directly
// DO NOT include timestamp or primary key fields.
const forbiddenKeys = [
  // Association keys (belongsTo, hasMany, belongsToMany)
  "application", "instruments", "computers",
  "parent", "children", "facility",
  "roles", "groups", "permissions",
  "requester", "targetUser",
  "documents", "workflowHistories",
  "applications",  // many-to-many computer↔application
  "computerInstruments", "computerApplications"
];

/**
 * Remove all forbidden (association) keys from the instance dataValues
 * before creating or updating a record.
 * Timestamps (createdAt, updatedAt) and primary key (id) are left untouched.
 */
function cleanInstance(instance) {
  forbiddenKeys.forEach(key => {
    if (instance.dataValues[key] !== undefined) {
      delete instance.dataValues[key];
    }
  });
}

/**
 * Apply global hooks to all models.
 */
function applyGlobalHooks(sequelize) {
  const models = sequelize.models;
  Object.keys(models).forEach(modelName => {
    const model = models[modelName];
    model.addHook("beforeCreate", "stripAssociations", cleanInstance);
    model.addHook("beforeUpdate", "stripAssociations", cleanInstance);
    model.addHook("beforeBulkCreate", "stripAssociations", (instances) => {
      instances.forEach(cleanInstance);
    });
  });
}

module.exports = { applyGlobalHooks };