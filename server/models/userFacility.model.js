module.exports = (sequelize, DataTypes) => {
  const UserFacility = sequelize.define("userFacility", {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: { model: "users", key: "id" }
    },
    facilityId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: { model: "facilities", key: "id" }
    }
  }, {
    tableName: "user_facilities",
    timestamps: false
  });
  return UserFacility;
};