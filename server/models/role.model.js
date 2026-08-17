module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define("role", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    roleName: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false
    },
    description: DataTypes.STRING(255),
    isSystem: {
      type: DataTypes.BOOLEAN,
      defaultValue: false   // true for pre-defined roles like Default Admin
    }
  }, {
    tableName: "roles",
    timestamps: true
  });
  return Role;
};