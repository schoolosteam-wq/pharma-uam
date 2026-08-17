module.exports = (sequelize, DataTypes) => {
  const Request = sequelize.define("request", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    requestNo: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM("DRAFT", "SUBMITTED", "IN_PROGRESS", "APPROVED", "REJECTED", "RETURNED", "COMPLETED"),
      defaultValue: "DRAFT"
    },
    requesterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" }
    },
    targetUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" }
    },
    payload: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    currentStep: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    workflowSteps: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    parentRequestId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "requests", key: "id" }
    },
    createdBy: DataTypes.INTEGER,
    updatedBy: DataTypes.INTEGER,

    facilityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "facilities", key: "id" }
    },
  }, {
    tableName: "requests",
    timestamps: true
  });
  return Request;
};