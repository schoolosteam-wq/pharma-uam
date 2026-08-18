// server/utils/reportTemplateHelper.js
const db = require("../models");

const defaultTemplate = {
  logoPath: null,
  logoAlignment: "LEFT",
  logoWidth: 50,
  logoHeight: 50,
  companyName: null,
  reportTitle: "Active User Report",
  customHeaderText: null,
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
};

async function getEffectiveTemplate(facilityId) {
  let template = null;
  if (facilityId) {
    template = await db.ReportTemplate.findOne({ where: { facilityId } });
  }
  if (!template) {
    template = await db.ReportTemplate.findOne({ where: { facilityId: null } });
  }
  if (template) {
    const data = template.toJSON();
    // Ensure tableColumns is array
    if (!Array.isArray(data.tableColumns) || data.tableColumns.length === 0) {
      data.tableColumns = defaultTemplate.tableColumns;
    }
    return { ...defaultTemplate, ...data };
  }
  return defaultTemplate;
}

module.exports = { getEffectiveTemplate, defaultTemplate };