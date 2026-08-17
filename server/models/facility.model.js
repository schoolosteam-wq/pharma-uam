module.exports = (sequelize, DataTypes) => {
  const Facility = sequelize.define("facility", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "facilities", key: "id" }
    },
    type: {
      type: DataTypes.ENUM("COMPANY", "FACTORY", "UNIT", "DEPARTMENT"),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      defaultValue: "ACTIVE"
    },
    location: {                           // ✅ नया फ़ील्ड
      type: DataTypes.STRING(200),
      allowNull: true
    },
    createdBy: DataTypes.INTEGER,
    updatedBy: DataTypes.INTEGER
  }, {
    tableName: "facilities",
    timestamps: true
  });
  return Facility;
};