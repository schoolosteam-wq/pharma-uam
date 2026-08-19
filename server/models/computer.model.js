module.exports = (sequelize, DataTypes) => {
  const Computer = sequelize.define(
    "computer",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      hostname: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      computerMakeModel: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      serialNumber: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false,
      },
      assetCode: DataTypes.STRING(100),
      osVersion: DataTypes.STRING(100),
      antivirusStatus: {
        type: DataTypes.ENUM("Installed", "Not Installed"),
        defaultValue: "Not Installed",
      },
      domainStatus: {
        type: DataTypes.ENUM("Workgroup", "AD Joined"),
        defaultValue: "Workgroup",
      },
      systemOwner: DataTypes.STRING(200),
      csvDone: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      location: DataTypes.STRING(255),
      ipAddress: DataTypes.STRING(45),
      status: {
        type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
        defaultValue: "ACTIVE",
      },
      departmentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "facilities", key: "id" },
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
      tableName: "computers",
      timestamps: true,
    }
  );
  return Computer;
};