module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define("permission", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    permissionName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "roles", key: "id" }
    }
  }, {
    tableName: "permissions",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["permissionName", "roleId"] }
    ]
  });
  return Permission;
};