module.exports = (sequelize, DataTypes) => {
  const WorkflowDefinition = sequelize.define("workflowDefinition", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    moduleType: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    steps: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [] // Array of { step, name, approverRole, approverGroup, canReturn }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    facilityId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: "workflow_definitions",
    timestamps: true
  });
  return WorkflowDefinition;
};