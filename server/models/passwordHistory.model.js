module.exports = (sequelize, DataTypes) => {
  const PasswordHistory = sequelize.define("passwordHistory", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: "password_history",
    timestamps: false
  });
  return PasswordHistory;
};