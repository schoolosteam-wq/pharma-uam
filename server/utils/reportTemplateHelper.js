// server/utils/reportTemplateHelper.js
const db = require("../models");

const defaultTemplate = {
  logoPath: null,
  logoAlignment: "LEFT",
  logoWidth: 50,
  logoHeight: 50,
  companyName: null,
  reportTitle: "Active User Report",
  footerText: "This report is system generated and does not require signature",
  showPageNumber: true,
  showPreparedBy: false,
  showReviewedBy: false,
  showApprovedBy: false,
  preparedByLabel: "Prepared By",
  reviewedByLabel: "Reviewed By",
  approvedByLabel: "Approved By",
  headerFontFamily: "Arial",
  headerFontSize: 20,
  headerFontColor: "#000000",
  headerFontWeight: "bold",
  headerBackgroundColor: "#ffffff",
  headerBorderColor: "#3498db",
  headerPadding: 10,
  bodyFontFamily: "Arial",
  bodyFontSize: 12,
  bodyFontColor: "#000000",
  bodyFontWeight: "normal",
  footerFontFamily: "Arial",
  footerFontSize: 12,
  footerFontColor: "#7f8c8d",
  footerFontWeight: "normal",
  footerTextAlignment: "LEFT",
  footerBackgroundColor: "#ffffff",
  footerBorderColor: "#dddddd",
  footerPadding: 10,
  tableHeaderBackgroundColor: "#3498db",
  tableHeaderTextColor: "#ffffff",
  tableBorderColor: "#dddddd",
  tableColumns: ["srNo", "fullName", "employeeId", "roles", "status"],
  orientation: "PORTRAIT",
  headerTemplateHtml: null,
  footerTemplateHtml: null,
  headerLayout: [
    { key: "companyName", alignment: "LEFT", order: 1 },
    { key: "reportTitle", alignment: "LEFT", order: 2 },
    { key: "logo", alignment: "RIGHT", order: 3 },
  ],
  footerLayout: [
    { key: "footerText", alignment: "LEFT", order: 1 },
    { key: "printedBy", alignment: "LEFT", order: 2 },
    { key: "printedDateTime", alignment: "LEFT", order: 3 },
    { key: "pageNumber", alignment: "RIGHT", order: 4 },
  ],
};

async function getEffectiveTemplate(facilityId, reportType = "activeUsers") {
  let template = null;
  if (facilityId) {
    template = await db.ReportTemplate.findOne({ where: { facilityId, reportType } });
  }
  if (!template) {
    template = await db.ReportTemplate.findOne({ where: { facilityId: null, reportType } });
  }
  if (!template) {
    // fallback default with reportType-specific defaults
    let defaultCols = defaultTemplate.tableColumns;
    if (reportType === "application") defaultCols = ["name", "manufacturer", "versionNo", "status", "facilityName"];
    if (reportType === "instrument") defaultCols = ["make", "model", "serialNumber", "status", "applicationName"];
    if (reportType === "computer") defaultCols = ["computerMakeModel", "serialNumber", "ipAddress", "status"];
    if (reportType === "audit") defaultCols = ["entityType", "action", "changedBy", "ipAddress", "changedAt"];
    return { ...defaultTemplate, reportType, tableColumns: defaultCols, reportTitle: reportType.charAt(0).toUpperCase() + reportType.slice(1) + " Report" };
  }
  const data = template.toJSON();
  if (!Array.isArray(data.tableColumns) || data.tableColumns.length === 0) {
    // fallback based on reportType
    if (reportType === "application") data.tableColumns = ["name", "manufacturer", "versionNo", "status", "facilityName"];
    else if (reportType === "instrument") data.tableColumns = ["make", "model", "serialNumber", "status", "applicationName"];
    else if (reportType === "computer") data.tableColumns = ["computerMakeModel", "serialNumber", "ipAddress", "status"];
    else if (reportType === "audit") data.tableColumns = ["entityType", "action", "changedBy", "ipAddress", "changedAt"];
    else data.tableColumns = defaultTemplate.tableColumns;
  }
  return { ...defaultTemplate, ...data };
}

module.exports = { getEffectiveTemplate, defaultTemplate };