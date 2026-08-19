module.exports = (sequelize, DataTypes) => {
  const Application = sequelize.define(
    "application",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      manufacturer: DataTypes.STRING(200),
      versionNo: DataTypes.STRING(50),
      oemContact: DataTypes.TEXT,
      status: {
        type: DataTypes.ENUM("ACTIVE", "RETIRED"),
        defaultValue: "ACTIVE",
      },
      // नए fields
      departmentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "facilities", key: "id" },
      },
      applicationOwner: DataTypes.STRING(200),
      gampCategory: DataTypes.STRING(10),
      validated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      eresApplicable: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      lastPeriodicReviewDate: DataTypes.DATEONLY,
      databaseType: {
        type: DataTypes.ENUM("Oracle", "SQL Server", "Local File Base"),
        allowNull: true,
      },
      auditTrailEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      applicationCriticality: {
        type: DataTypes.ENUM("High", "Medium", "Low"),
        allowNull: true,
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
      tableName: "applications",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["name", "versionNo"],
        },
      ],
    }
  );
  return Application;
};