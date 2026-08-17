module.exports = (sequelize, DataTypes) => {
  const Computer = sequelize.define("computer", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    computerMakeModel: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    serialNumber: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false
    },
    ipAddress: DataTypes.STRING(45),
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      defaultValue: "ACTIVE"
    },
    createdBy: DataTypes.INTEGER,
    updatedBy: DataTypes.INTEGER
  }, {
    tableName: "computers",
    timestamps: true
  });
  return Computer;
};