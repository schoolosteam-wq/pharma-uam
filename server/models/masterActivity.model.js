module.exports = (sequelize, DataTypes) => {
  const MasterActivity = sequelize.define("masterActivity", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    description: DataTypes.STRING(255),
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    createdBy: DataTypes.INTEGER,
    updatedBy: DataTypes.INTEGER
  }, {
    tableName: "master_activities",
    timestamps: true
  });
  return MasterActivity;
};