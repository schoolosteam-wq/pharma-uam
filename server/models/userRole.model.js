module.exports = (sequelize, DataTypes) => {
  const UserRole = sequelize.define("userRole", {
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
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "roles", key: "id" }
    }
  }, {
    tableName: "user_roles",
    timestamps: false
  });
  return UserRole;
};