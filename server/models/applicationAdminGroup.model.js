module.exports = (sequelize, DataTypes) => {
  const ApplicationAdminGroup = sequelize.define("applicationAdminGroup", {
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
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "groups", key: "id" }
    }
  }, {
    tableName: "application_admin_groups",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["applicationId", "groupId"] }
    ]
  });
  return ApplicationAdminGroup;
};