module.exports = (sequelize, DataTypes) => {
  const ActivityWorkflowDefinition = sequelize.define("activityWorkflowDefinition", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    activityName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true
    },
    steps: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: "activity_workflow_definitions",
    timestamps: true
  });
  return ActivityWorkflowDefinition;
};