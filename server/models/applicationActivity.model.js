module.exports = (sequelize, DataTypes) => {
  const ApplicationActivity = sequelize.define("applicationActivity", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "applications", key: "id" }
    },
    activityName: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    isEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: "application_activities",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["applicationId", "activityName"] }
    ]
  });
  return ApplicationActivity;
};