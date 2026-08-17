module.exports = (sequelize, DataTypes) => {
  const Group = sequelize.define("group", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    groupName: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false
    },
    description: DataTypes.STRING(255)
  }, {
    tableName: "groups",
    timestamps: true
  });
  return Group;
};