module.exports = (sequelize, DataTypes) => {
  const RequestDocument = sequelize.define("requestDocument", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    requestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "requests", key: "id" }
    },
    filePath: DataTypes.STRING(500),
    originalName: DataTypes.STRING(255),
    uploadedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: "request_documents",
    timestamps: false
  });
  return RequestDocument;
};