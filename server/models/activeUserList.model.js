module.exports = (sequelize, DataTypes) => {
  const ActiveUserList = sequelize.define("activeUserList", {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    applicationId: { type: DataTypes.INTEGER, allowNull: false },
    username: { type: DataTypes.STRING, allowNull: false },
    passwordLastSet: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.STRING, defaultValue: "Active" },
    approvedBy: DataTypes.INTEGER,
    reviewedBy: DataTypes.INTEGER,
  }, {
    tableName: "active_users",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["userId", "applicationId"]   // ✅ यूनिक कंस्ट्रेंट
      }
    ]
  });
  return ActiveUserList;
};