module.exports = (sequelize, DataTypes) => {
  const Instrument = sequelize.define("instrument", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    make: DataTypes.STRING(150),
    model: DataTypes.STRING(150),
    oemDetails: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    serialNumber: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "RETIRED", "TRANSFERRED"),
      defaultValue: "ACTIVE"
    },
    currentLocation: DataTypes.STRING(255),
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "applications", key: "id" }
    },
    createdBy: DataTypes.INTEGER,
    updatedBy: DataTypes.INTEGER
  }, {
    tableName: "instruments",
    timestamps: true
  });
  return Instrument;
};