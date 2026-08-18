// server/models/reportTemplate.model.js
module.exports = (sequelize, DataTypes) => {
  const ReportTemplate = sequelize.define(
    "reportTemplate",
    {
      facilityId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "facilities", key: "id" },
      },
      logoPath: DataTypes.STRING(500),
      logoAlignment: {
        type: DataTypes.ENUM("LEFT", "RIGHT"),
        defaultValue: "LEFT",
      },
      logoWidth: {
        type: DataTypes.INTEGER,
        defaultValue: 50,
      },
      logoHeight: {
        type: DataTypes.INTEGER,
        defaultValue: 50,
      },
      companyName: DataTypes.STRING(200),
      reportTitle: DataTypes.STRING(200),
      customHeaderText: DataTypes.TEXT,
      footerText: DataTypes.TEXT,

      showPageNumber: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      showPreparedBy: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      showReviewedBy: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      showApprovedBy: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      preparedByLabel: {
        type: DataTypes.STRING(100),
        defaultValue: "Prepared By",
      },
      reviewedByLabel: {
        type: DataTypes.STRING(100),
        defaultValue: "Reviewed By",
      },
      approvedByLabel: {
        type: DataTypes.STRING(100),
        defaultValue: "Approved By",
      },

      // Header font settings
      headerFontFamily: {
        type: DataTypes.STRING(100),
        defaultValue: "Arial",
      },
      headerFontSize: {
        type: DataTypes.INTEGER,
        defaultValue: 20,
      },
      headerFontColor: {
        type: DataTypes.STRING(20),
        defaultValue: "#000000",
      },
      headerFontWeight: {
        type: DataTypes.STRING(20),
        defaultValue: "bold",
      },
      headerBackgroundColor: {
        type: DataTypes.STRING(20),
        defaultValue: "#ffffff",
      },
      headerBorderColor: {
        type: DataTypes.STRING(20),
        defaultValue: "#3498db",
      },
      headerPadding: {
        type: DataTypes.INTEGER,
        defaultValue: 10,
      },

      // Body font settings
      bodyFontFamily: {
        type: DataTypes.STRING(100),
        defaultValue: "Arial",
      },
      bodyFontSize: {
        type: DataTypes.INTEGER,
        defaultValue: 12,
      },
      bodyFontColor: {
        type: DataTypes.STRING(20),
        defaultValue: "#000000",
      },
      bodyFontWeight: {
        type: DataTypes.STRING(20),
        defaultValue: "normal",
      },

      // Footer font settings
      footerFontFamily: {
        type: DataTypes.STRING(100),
        defaultValue: "Arial",
      },
      footerFontSize: {
        type: DataTypes.INTEGER,
        defaultValue: 12,
      },
      footerFontColor: {
        type: DataTypes.STRING(20),
        defaultValue: "#7f8c8d",
      },
      footerFontWeight: {
        type: DataTypes.STRING(20),
        defaultValue: "normal",
      },
      footerTextAlignment: {
        type: DataTypes.ENUM("LEFT", "CENTER", "RIGHT"),
        defaultValue: "LEFT",
      },
      footerBackgroundColor: {
        type: DataTypes.STRING(20),
        defaultValue: "#ffffff",
      },
      footerBorderColor: {
        type: DataTypes.STRING(20),
        defaultValue: "#dddddd",
      },
      footerPadding: {
        type: DataTypes.INTEGER,
        defaultValue: 10,
      },

      // Table styles
      tableHeaderBackgroundColor: {
        type: DataTypes.STRING(20),
        defaultValue: "#3498db",
      },
      tableHeaderTextColor: {
        type: DataTypes.STRING(20),
        defaultValue: "#ffffff",
      },
      tableBorderColor: {
        type: DataTypes.STRING(20),
        defaultValue: "#dddddd",
      },
      tableColumns: {
        type: DataTypes.JSONB,
        defaultValue: ["srNo", "fullName", "employeeId", "roles", "status"],
      },
    },
    {
      tableName: "report_templates",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["facilityId"],
        },
      ],
    }
  );

  return ReportTemplate;
};