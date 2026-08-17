module.exports = (sequelize, DataTypes) => {
  const UserGroup = sequelize.define("userGroup", {
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
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "groups", key: "id" }
    }
  }, {
    tableName: "user_groups",
    timestamps: false
  });
  return UserGroup;
};