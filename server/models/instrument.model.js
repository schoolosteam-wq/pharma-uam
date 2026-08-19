module.exports = (sequelize, DataTypes) => {
  const Instrument = sequelize.define(
    "instrument",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      instrumentId: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      assetCode: DataTypes.STRING(100),
      instrumentType: DataTypes.STRING(100),
      make: DataTypes.STRING(150),
      model: DataTypes.STRING(150),
      oemDetails: {
        type: DataTypes.JSONB,
        defaultValue: {},
      },
      serialNumber: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "RETIRED", "TRANSFERRED"),
        defaultValue: "ACTIVE",
      },
      currentLocation: DataTypes.STRING(255),
      departmentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "facilities", key: "id" },
      },
      connectionStatus: {
        type: DataTypes.ENUM("Standalone", "Networked"),
        defaultValue: "Standalone",
      },
      applicationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "applications", key: "id" },
      },
      facilityId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "facilities", key: "id" },
      },
      createdBy: DataTypes.INTEGER,
      updatedBy: DataTypes.INTEGER,
    },
    {
      tableName: "instruments",
      timestamps: true,
    }
  );
  return Instrument;
};