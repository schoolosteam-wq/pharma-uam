module.exports = (sequelize, DataTypes) => {
  const UserApplicationRole = sequelize.define("userApplicationRole", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" }
    },
    applicationRoleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "application_roles", key: "id" }
    }
  }, {
    tableName: "user_application_roles",
    timestamps: false
  });
  return UserApplicationRole;
};