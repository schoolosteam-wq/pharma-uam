module.exports = (sequelize, DataTypes) => {
  const UserApplicationGroup = sequelize.define("userApplicationGroup", {
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
    applicationGroupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "application_groups", key: "id" }
    }
  }, {
    tableName: "user_application_groups",
    timestamps: false
  });
  return UserApplicationGroup;
};