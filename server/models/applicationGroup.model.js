module.exports = (sequelize, DataTypes) => {
  const ApplicationGroup = sequelize.define("applicationGroup", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    groupName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "applications", key: "id" }
    }
  }, {
    tableName: "application_groups",
    timestamps: false
  });
  return ApplicationGroup;
};