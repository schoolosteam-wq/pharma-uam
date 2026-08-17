module.exports = (sequelize, DataTypes) => {
  const Application = sequelize.define("application", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    manufacturer: DataTypes.STRING(200),
    versionNo: DataTypes.STRING(50),
    oemContact: DataTypes.TEXT,
    status: {
      type: DataTypes.ENUM("ACTIVE", "RETIRED"),
      defaultValue: "ACTIVE"
    },
    createdBy: DataTypes.INTEGER,
    updatedBy: DataTypes.INTEGER,
    
    facilityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "facilities", key: "id" }
    },
  }, {
    tableName: "applications",
    timestamps: true
  });
  return Application;
};