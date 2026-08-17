module.exports = (sequelize, DataTypes) => {
  const Setting = sequelize.define("setting", {
    key: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: "settings",
    timestamps: true
  });
  return Setting;
};