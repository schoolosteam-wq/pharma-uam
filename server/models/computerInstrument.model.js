module.exports = (sequelize, DataTypes) => {
  const ComputerInstrument = sequelize.define("computerInstrument", {
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
    instrumentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "instruments", key: "id" }
    }
  }, {
    tableName: "computer_instruments",
    timestamps: false
  });
  return ComputerInstrument;
};