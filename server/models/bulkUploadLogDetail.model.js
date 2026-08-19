// server/models/bulkUploadLogDetail.model.js
module.exports = (sequelize, DataTypes) => {
  const BulkUploadLogDetail = sequelize.define(
    "bulkUploadLogDetail",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      logId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "bulk_upload_logs", key: "id" },
      },
      rowNumber: DataTypes.INTEGER,
      identifier: DataTypes.STRING(255),
      status: DataTypes.STRING(50),
      reason: DataTypes.TEXT,
    },
    {
      tableName: "bulk_upload_log_details",
      timestamps: true,
    }
  );
  return BulkUploadLogDetail;
};