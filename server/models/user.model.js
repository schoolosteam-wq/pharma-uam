module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("user", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    employeeId: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false
    },
    username: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(150),
      unique: true,
      allowNull: false
    },
    domainUserId: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: "Domain login ID (AD integration)"
    },
    fullName: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    department: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    departmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "facilities", key: "id" },
    },
    designation: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    joiningDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    contactDetails: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: "Phone, mobile, etc."
    },
    reportingManager: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true  // domain users may not need local password
    },
    isLocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    passwordExpiryDate: DataTypes.DATE,
    facilityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "facilities", key: "id" }
    },
    createdBy: DataTypes.INTEGER,
    updatedBy: DataTypes.INTEGER
  }, {
    tableName: "users",
    timestamps: true
  });
  return User;
};