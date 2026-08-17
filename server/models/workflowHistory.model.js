// server/models/workflowHistory.model.js – updated with association
module.exports = (sequelize, DataTypes) => {
  const WorkflowHistory = sequelize.define("workflowHistory", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    requestId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    version: DataTypes.INTEGER,
    stepNo: DataTypes.INTEGER,
    stepName: DataTypes.STRING(150),
    assignedTo: DataTypes.INTEGER,   // user id who performed action
    action: {
      type: DataTypes.ENUM("SUBMITTED", "APPROVED", "REJECTED", "RETURNED", "COMMENTED"),
      allowNull: false
    },
    comments: DataTypes.TEXT,
    actionBy: DataTypes.INTEGER,
    actionDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: "workflow_history",
    timestamps: false
  });

  // Add the association inside a class method or directly after definition
  WorkflowHistory.associate = (models) => {
    WorkflowHistory.belongsTo(models.User, { as: "actionByUser", foreignKey: "actionBy" });
  };

  return WorkflowHistory;
};