module.exports = (sequelize, DataTypes) => {
  const ApplicationRole = sequelize.define("applicationRole", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    roleName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "applications", key: "id" }
    }
  }, {
    tableName: "application_roles",
    timestamps: false
  });
  return ApplicationRole;
};