module.exports = (sequelize, DataTypes) => {
  const AuditTrail = sequelize.define("auditTrail", {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    entityType: DataTypes.STRING(50),
    entityId: DataTypes.STRING(50),
    action: DataTypes.STRING(50),
    oldValue: DataTypes.JSONB,
    newValue: DataTypes.JSONB,
    changedBy: DataTypes.INTEGER,
    changedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    ipAddress: DataTypes.STRING(45),
    comments: DataTypes.TEXT
  }, {
    tableName: "audit_trail",
    timestamps: false
  });
  return AuditTrail;
};