module.exports = (sequelize, DataTypes) => {
  const ComputerApplication = sequelize.define("computerApplication", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    computerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "computers", key: "id" }
    },
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "applications", key: "id" }
    }
  }, {
    tableName: "computer_applications",
    timestamps: false
  });
  return ComputerApplication;
};