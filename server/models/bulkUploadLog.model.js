// server/models/bulkUploadLog.model.js
module.exports = (sequelize, DataTypes) => {
  const BulkUploadLog = sequelize.define(
    "bulkUploadLog",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      module: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      filename: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      uploadedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      totalRows: DataTypes.INTEGER,
      successRows: DataTypes.INTEGER,
      skippedRows: DataTypes.INTEGER,
      errorRows: DataTypes.INTEGER,
    },
    {
      tableName: "bulk_upload_logs",
      timestamps: true,
    }
  );
  return BulkUploadLog;
};