// server/controllers/report.controller.js – Complete with multi-report support
const puppeteer = require("puppeteer");
const db = require("../models");
const path = require("path");
const fs = require("fs");
const { getUserFacilities } = require("../utils/facilityFilter");
const { getEffectiveTemplate } = require("../utils/reportTemplateHelper");

// Helper function to generate PDF from HTML
async function generatePDF(html, orientation, res, filename) {
  let browser;
  try {
    const format = orientation === "LANDSCAPE" ? "A4" : "A4"; // A4 for both, but landscape we use landscape flag
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      userDataDir: require("path").join(
        require("os").tmpdir(),
        `puppeteer_${Date.now()}_${Math.random().toString(36).slice(2)}`
      ),
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: orientation === "LANDSCAPE",
      printBackground: true,
      margin: { top: "80px", bottom: "80px", right: "20px", left: "20px" },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).send({ message: error.message });
  } finally {
    if (browser) await browser.close();
  }
}

// Common function to build HTML with template
function buildReportHTML({
  template,
  currentUser,
  applicationName,
  statusText,
  rows,
  columnsMap,
  selectedColumns,
}) {
  // --------------------------------------------
  // 1. Helper: Replace placeholders in HTML
  // --------------------------------------------
  const replacePlaceholders = (html, placeholders) => {
    if (!html) return "";
    let result = html;
    Object.entries(placeholders).forEach(([key, value]) => {
      result = result.replaceAll(`{{${key}}}`, value !== undefined && value !== null ? value : "");
    });
    return result;
  };

  // --------------------------------------------
  // 2. Logo & common variables
  // --------------------------------------------
  const logoPath = template.logoPath
    ? path.join(__dirname, "..", template.logoPath.replace(/^\/uploads\//, "uploads/"))
    : null;
  let logoBase64 = "";
  if (logoPath && fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });
  }
  const logoStyle = `height:${template.logoHeight}px;width:${template.logoWidth}px;object-fit:contain;`;
  const logoHtml = logoBase64
    ? `<img src="data:image/png;base64,${logoBase64}" style="${logoStyle}" />`
    : "";

  const printedBy = currentUser?.fullName || currentUser?.username || "System";
  const printedDateTime = new Date().toLocaleString();

  // --------------------------------------------
  // 3. Render element for layout-based items
  // --------------------------------------------
  const renderElement = (key, item) => {
    switch (key) {
      case "companyName":
        return template.companyName || applicationName || "Pharma UAM";
      case "reportTitle":
        return template.reportTitle || "Report";
      case "logo":
        return logoHtml;
      case "footerText":
        return template.footerText || "";
      case "printedBy":
        return `Printed By: ${printedBy}`;
      case "printedDateTime":
        return printedDateTime;
      case "pageNumber":
        return template.showPageNumber !== false ? "Page 1 of 1" : "";
      case "preparedBy":
        return template.showPreparedBy ? `${template.preparedByLabel || "Prepared By"}: _________________` : "";
      case "reviewedBy":
        return template.showReviewedBy ? `${template.reviewedByLabel || "Reviewed By"}: _________________` : "";
      case "approvedBy":
        return template.showApprovedBy ? `${template.approvedByLabel || "Approved By"}: _________________` : "";
      default:
        return "";
    }
  };

  // --------------------------------------------
  // 4. Build Header
  // --------------------------------------------
  let headerHtml;
  const headerLayout = template.headerLayout; // expected array: [{ key, alignment, order }]
  if (Array.isArray(headerLayout) && headerLayout.length > 0) {
    const sortedItems = [...headerLayout].sort((a, b) => (a.order || 0) - (b.order || 0));
    const itemsHtml = sortedItems
      .map((item) => {
        const content = renderElement(item.key, item);
        if (!content) return "";
        const align = (item.alignment || "LEFT").toLowerCase();
        return `<div style="text-align:${align}; margin-bottom:5px;">${content}</div>`;
      })
      .join("");
    headerHtml = `<div style="padding:${template.headerPadding || 10}px 30px; background:${template.headerBackgroundColor || '#ffffff'}; border-bottom:2px solid ${template.headerBorderColor || '#3498db'}; font-family:${template.headerFontFamily || 'Arial'}; font-size:${template.headerFontSize || 20}px; color:${template.headerFontColor || '#000000'}; font-weight:${template.headerFontWeight || 'bold'};">${itemsHtml}</div>`;
  } else if (template.headerTemplateHtml) {
    // WYSIWYG HTML template – replace placeholders
    const placeholders = {
      companyName: template.companyName || applicationName || "Pharma UAM",
      reportTitle: template.reportTitle || "Report",
      logo: logoHtml,
      printedBy: printedBy,
      printedDateTime: printedDateTime,
      footerText: template.footerText,
      pageNumber: template.showPageNumber ? "Page 1 of 1" : "",
      preparedByLabel: template.preparedByLabel || "Prepared By",
      reviewedByLabel: template.reviewedByLabel || "Reviewed By",
      approvedByLabel: template.approvedByLabel || "Approved By",
    };
    headerHtml = replacePlaceholders(template.headerTemplateHtml, placeholders);
  } else {
    // Fallback: original table-based header (companyName left, reportTitle below, logo right)
    headerHtml = `
      <table style="width:100%; border-collapse:collapse; background:${template.headerBackgroundColor || '#ffffff'}; padding:${template.headerPadding || 10}px 30px; border-bottom:2px solid ${template.headerBorderColor || '#3498db'};">
        <tr>
          <td style="vertical-align:top; text-align:left; padding:${template.headerPadding || 10}px;">
            <div style="font-size:${template.headerFontSize || 20}px; font-weight:${template.headerFontWeight || 'bold'}; color:${template.headerFontColor || '#000000'}; font-family:${template.headerFontFamily || 'Arial'}; margin-bottom:5px;">
              ${template.companyName || applicationName || "Pharma UAM"}
            </div>
            ${template.reportTitle ? `<div style="font-size:${Math.max(template.headerFontSize - 4, 10)}px; font-weight:${template.headerFontWeight || 'bold'}; color:${template.headerFontColor || '#000000'}; font-family:${template.headerFontFamily || 'Arial'};">${template.reportTitle}</div>` : ""}
          </td>
          <td style="vertical-align:middle; text-align:${(template.logoAlignment || 'RIGHT').toLowerCase()}; padding:${template.headerPadding || 10}px;">
            ${logoHtml}
          </td>
        </tr>
      </table>`;
  }

  // --------------------------------------------
  // 5. Build Footer
  // --------------------------------------------
  let footerHtml;
  const footerLayout = template.footerLayout;
  if (Array.isArray(footerLayout) && footerLayout.length > 0) {
    const sortedItems = [...footerLayout].sort((a, b) => (a.order || 0) - (b.order || 0));
    const itemsHtml = sortedItems
      .map((item) => {
        const content = renderElement(item.key, item);
        if (!content) return "";
        const align = (item.alignment || "LEFT").toLowerCase();
        return `<div style="text-align:${align}; margin-bottom:5px;">${content}</div>`;
      })
      .join("");
    footerHtml = `<div style="padding:${template.footerPadding || 10}px 30px; background:${template.footerBackgroundColor || '#ffffff'}; border-top:1px solid ${template.footerBorderColor || '#dddddd'}; font-family:${template.footerFontFamily || 'Arial'}; font-size:${template.footerFontSize || 12}px; color:${template.footerFontColor || '#7f8c8d'}; font-weight:${template.footerFontWeight || 'normal'};">${itemsHtml}</div>`;
  } else if (template.footerTemplateHtml) {
    const placeholders = {
      companyName: template.companyName || applicationName || "Pharma UAM",
      reportTitle: template.reportTitle || "Report",
      logo: logoHtml,
      printedBy: printedBy,
      printedDateTime: printedDateTime,
      footerText: template.footerText,
      pageNumber: template.showPageNumber ? "Page 1 of 1" : "",
      preparedByLabel: template.preparedByLabel || "Prepared By",
      reviewedByLabel: template.reviewedByLabel || "Reviewed By",
      approvedByLabel: template.approvedByLabel || "Approved By",
    };
    footerHtml = replacePlaceholders(template.footerTemplateHtml, placeholders);
  } else {
    // Simplified fallback footer with optional approval table
    const footerSopText = template.footerText || "";
    const printedByLocal = currentUser?.fullName || currentUser?.username || "System";
    const printedDateTimeLocal = new Date().toLocaleString();
    const pageNumberText = template.showPageNumber !== false ? "Page 1 of 1" : "";

    // Approval table (Prepared By, Reviewed By, Approved By) – shown if any enabled
    const approvalItems = [
      { show: template.showPreparedBy, label: template.preparedByLabel || "Prepared By" },
      { show: template.showReviewedBy, label: template.reviewedByLabel || "Reviewed By" },
      { show: template.showApprovedBy, label: template.approvedByLabel || "Approved By" },
    ].filter((item) => item.show);

    let approvalTableHtml = "";
    if (approvalItems.length > 0) {
      const cells = approvalItems
        .map((item) => `<td style="text-align:center; padding:5px; border:1px solid ${template.footerBorderColor || '#dddddd'};">${item.label}: _________________</td>`)
        .join("");
      approvalTableHtml = `
        <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <tr>${cells}</tr>
        </table>`;
    }

    footerHtml = `
      <div style="padding:${template.footerPadding || 10}px 30px; background:${template.footerBackgroundColor || '#ffffff'}; border-top:1px solid ${template.footerBorderColor || '#dddddd'}; font-family:${template.footerFontFamily || 'Arial'}; font-size:${template.footerFontSize || 12}px; color:${template.footerFontColor || '#7f8c8d'};">
        ${approvalTableHtml}
        ${footerSopText ? `<div style="text-align:left; margin-bottom:5px;">${footerSopText}</div>` : ""}
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>Printed By: ${printedByLocal} | ${printedDateTimeLocal}</span>
          ${pageNumberText ? `<span>${pageNumberText}</span>` : ""}
        </div>
        <div style="text-align:center; margin-top:5px;">This report is system generated and does not require signature.</div>
      </div>`;
  }

  // --------------------------------------------
  // 6. Table Generation
  // --------------------------------------------
  const headerCells = selectedColumns
    .map((col) => `<th>${columnsMap[col].label}</th>`)
    .join("");
  const rowsHtml = rows
    .map((r) => {
      const cells = selectedColumns
        .map((col) => `<td>${r[col] ?? ""}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const colspan = selectedColumns.length || 1;
  const bodyStyle = `font-family:${template.bodyFontFamily || 'Arial'}; font-size:${template.bodyFontSize || 12}px; color:${template.bodyFontColor || '#000000'}; font-weight:${template.bodyFontWeight || 'normal'};`;
  const tableHeaderStyle = `background:${template.tableHeaderBackgroundColor || '#3498db'}; color:${template.tableHeaderTextColor || '#ffffff'};`;
  const tableBorderColor = template.tableBorderColor || '#dddddd';

  // --------------------------------------------
  // 7. Final HTML
  // --------------------------------------------
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${template.reportTitle || "Report"}</title>
<style>
  body { ${bodyStyle} margin:0; padding:0; }
  .header { width:100%; }
  .content { padding:20px 30px; }
  table { width:100%; border-collapse:collapse; margin-top:15px; }
  th { ${tableHeaderStyle} padding:10px; text-align:left; }
  td { padding:8px 10px; border-bottom:1px solid ${tableBorderColor}; }
  .footer { position:fixed; bottom:0; left:0; width:100%; display:flex; flex-direction:column; gap:5px; }
</style>
</head>
<body>
  ${headerHtml}
  <div class="content">
    <p>Application: <strong>${applicationName || "-"}</strong> | Status: <strong>${statusText || "All"}</strong></p>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="${colspan}" style="text-align:center;">No data found</td></tr>`}</tbody>
    </table>
  </div>
  ${footerHtml}
</body>
</html>`;

  return html;
}

// ================== 🆕 UPDATED COLUMN DEFINITIONS (from attached file) ==================
const columnDefinitions = {
  activeUsers: {
    srNo: { label: "Sr. No." },
    fullName: { label: "User Name" },
    employeeId: { label: "Emp Code" },
    username: { label: "User ID (Application)" },
    roles: { label: "Roles / Groups" },
    status: { label: "Status" },
  },
  application: {
    name: { label: "Application Name" },
    manufacturer: { label: "Manufacturer" },
    versionNo: { label: "Version" },
    oemContact: { label: "OEM Contact" },
    status: { label: "Status" },
    facilityName: { label: "Facility" },
    departmentName: { label: "Department" },
    applicationOwner: { label: "Application Owner" },
    gampCategory: { label: "GAMP Category" },
    validated: { label: "Validated" },
    eresApplicable: { label: "ERES Applicable" },
    lastPeriodicReviewDate: { label: "Last Periodic Review Date" },
    databaseType: { label: "Database Type" },
    auditTrailEnabled: { label: "Audit Trail Enabled" },
    applicationCriticality: { label: "Application Criticality" },
    roles: { label: "Roles" },
    groups: { label: "Groups" },
    adminGroups: { label: "Admin Groups" },
  },
  instrument: {
    instrumentId: { label: "Instrument ID" },
    assetCode: { label: "Asset Code" },
    instrumentType: { label: "Instrument Type" },
    make: { label: "Make" },
    model: { label: "Model" },
    serialNumber: { label: "Serial Number" },
    oemDetails: { label: "OEM Details" },
    status: { label: "Status" },
    applicationName: { label: "Application" },
    facilityName: { label: "Facility" },
    departmentName: { label: "Department" },
    currentLocation: { label: "Current Location" },
    connectionStatus: { label: "Connection Status" },
    connectedComputers: { label: "Connected Computers" },
  },
  computer: {
    hostname: { label: "Hostname" },
    computerMakeModel: { label: "Make & Model" },
    serialNumber: { label: "Serial Number" },
    assetCode: { label: "Asset Code" },
    osVersion: { label: "OS Version" },
    antivirusStatus: { label: "Antivirus Status" },
    domainStatus: { label: "Domain Status" },
    systemOwner: { label: "System Owner" },
    csvDone: { label: "CSV Done" },
    location: { label: "Location" },
    ipAddress: { label: "IP Address" },
    status: { label: "Status" },
    facilityName: { label: "Facility" },
    departmentName: { label: "Department" },
    connectedApplications: { label: "Connected Applications" },
    connectedInstruments: { label: "Connected Instruments" },
  },
  audit: {
    entityType: { label: "Entity Type" },
    action: { label: "Action" },
    oldValue: { label: "Old Value" },
    newValue: { label: "New Value" },
    changedBy: { label: "Performed By" },
    ipAddress: { label: "IP Address" },
    changedAt: { label: "Date/Time" },
    comments: { label: "Comments" },
  },
};

// ================== Active Users PDF ==================
exports.activeUserListPDF = async (req, res) => {
  try {
    const { applicationId, status } = req.query;
    if (!applicationId) return res.status(400).send({ message: "applicationId is required" });

    const application = await db.Application.findByPk(applicationId, { attributes: ["id", "name", "facilityId"] });
    const applicationName = application ? application.name : applicationId;
    const facilityId = application?.facilityId || null;

    const template = await getEffectiveTemplate(facilityId, "activeUsers");
    const currentUser = await db.User.findByPk(req.userId, { attributes: ["id", "fullName", "username"] });

    const whereActive = { applicationId };
    if (status && status !== "All") whereActive.status = status;

    // Facility filter
    const allowedFacilityIds = await getUserFacilities(req.userId, req.headers["x-facility-id"]);
    if (allowedFacilityIds !== null) {
      if (allowedFacilityIds.length === 0) whereActive.id = -1;
      else {
        const userFacilityRecords = await db.UserFacility.findAll({
          where: { facilityId: { [db.Sequelize.Op.in]: allowedFacilityIds } },
          attributes: ["userId"],
          raw: true,
        });
        const allowedUserIds = userFacilityRecords.map(u => u.userId);
        whereActive.userId = { [db.Sequelize.Op.in]: allowedUserIds };
      }
    }

    const activeUsers = await db.ActiveUserList.findAll({
      where: whereActive,
      attributes: ["id", "userId", "applicationId", "username", "status", "createdAt"],
      order: [["id", "ASC"]],
    });

    const rows = [];
    for (const au of activeUsers) {
      const user = await db.User.findByPk(au.userId, { attributes: ["id", "fullName", "username", "email", "employeeId"] });
      if (!user) continue;
      const userRoles = await db.UserApplicationRole.findAll({
        where: { userId: user.id },
        include: [{ model: db.ApplicationRole, where: { applicationId }, attributes: ["roleName"] }],
      });
      const roleNames = userRoles.map(ur => ur.applicationRole?.roleName).filter(Boolean);
      const userGroups = await db.UserApplicationGroup.findAll({
        where: { userId: user.id },
        include: [{ model: db.ApplicationGroup, where: { applicationId }, attributes: ["groupName"] }],
      });
      const groupNames = userGroups.map(ug => ug.applicationGroup?.groupName).filter(Boolean);
      const roles = [...roleNames, ...groupNames].join(", ") || "—";
      rows.push({ srNo: rows.length + 1, fullName: user.fullName, employeeId: user.employeeId || "", username: au.username, roles, status: au.status });
    }

    const columnsMap = columnDefinitions.activeUsers;
    const selectedColumns = Array.isArray(template.tableColumns) ? template.tableColumns.filter(c => columnsMap[c]) : Object.keys(columnsMap);

    const html = buildReportHTML({
      template,
      currentUser,
      applicationName,
      statusText: status || "All",
      rows,
      columnsMap,
      selectedColumns,
    });

    await generatePDF(html, template.orientation, res, `active_users_${applicationId}.pdf`);
  } catch (error) {
    console.error("Active Users PDF error:", error);
    res.status(500).send({ message: error.message });
  }
};

// ================== 🆕 UPDATED Application PDF ==================
exports.applicationListPDF = async (req, res) => {
  try {
    const { status, facilityId } = req.query;
    const selectedFacilityId = req.headers["x-facility-id"];
    const allowedFacilityIds = await getUserFacilities(req.userId, selectedFacilityId || facilityId);
    const where = {};
    if (status && status !== "All") where.status = status;
    if (allowedFacilityIds !== null) {
      if (allowedFacilityIds.length === 0) where.id = -1;
      else where.facilityId = { [db.Sequelize.Op.in]: allowedFacilityIds };
    } else if (facilityId) {
      where.facilityId = facilityId;
    }

    const applications = await db.Application.findAll({
      where,
      include: [
        { model: db.ApplicationRole, as: "applicationRoles", attributes: ["roleName"] },
        { model: db.ApplicationGroup, as: "applicationGroups", attributes: ["groupName"] },
        { model: db.Facility, as: "facility", attributes: ["name"] },
        { model: db.Facility, as: "department", attributes: ["name"] },
        { model: db.Group, as: "adminGroups", attributes: ["groupName"] },
      ],
      order: [["name", "ASC"]],
    });

    const rows = applications.map(app => ({
      name: app.name,
      manufacturer: app.manufacturer,
      versionNo: app.versionNo,
      oemContact: app.oemContact,
      status: app.status,
      facilityName: app.facility?.name || "",
      departmentName: app.department?.name || "",
      applicationOwner: app.applicationOwner || "",
      gampCategory: app.gampCategory || "",
      validated: app.validated ? "Yes" : "No",
      eresApplicable: app.eresApplicable ? "Yes" : "No",
      lastPeriodicReviewDate: app.lastPeriodicReviewDate || "",
      databaseType: app.databaseType || "",
      auditTrailEnabled: app.auditTrailEnabled ? "Yes" : "No",
      applicationCriticality: app.applicationCriticality || "",
      roles: app.applicationRoles?.map(r => r.roleName).join(", ") || "",
      groups: app.applicationGroups?.map(g => g.groupName).join(", ") || "",
      adminGroups: app.adminGroups?.map(g => g.groupName).join(", ") || "",
    }));

    const effectiveFacilityId = applications.length > 0 ? applications[0].facilityId : null;
    const template = await getEffectiveTemplate(effectiveFacilityId, "application");
    const currentUser = await db.User.findByPk(req.userId, { attributes: ["id", "fullName", "username"] });

    const columnsMap = columnDefinitions.application;
    const selectedColumns = Array.isArray(template.tableColumns) ? template.tableColumns.filter(c => columnsMap[c]) : Object.keys(columnsMap);

    const html = buildReportHTML({
      template,
      currentUser,
      applicationName: "All Applications",
      statusText: status || "All",
      rows,
      columnsMap,
      selectedColumns,
    });

    await generatePDF(html, template.orientation, res, "applications_report.pdf");
  } catch (error) {
    console.error("Application PDF error:", error);
    res.status(500).send({ message: error.message });
  }
};

// ================== 🆕 UPDATED Instrument PDF ==================
exports.instrumentListPDF = async (req, res) => {
  try {
    const { status, applicationId, facilityId } = req.query;
    const selectedFacilityId = req.headers["x-facility-id"];
    const allowedFacilityIds = await getUserFacilities(req.userId, selectedFacilityId || facilityId);
    const where = {};
    if (status && status !== "All") where.status = status;
    if (applicationId) where.applicationId = applicationId;
    if (allowedFacilityIds !== null) {
      if (allowedFacilityIds.length === 0) where.id = -1;
      else where.facilityId = { [db.Sequelize.Op.in]: allowedFacilityIds };
    } else if (facilityId) {
      where.facilityId = facilityId;
    }

    const instruments = await db.Instrument.findAll({
      where,
      include: [
        { model: db.Application, as: "application", attributes: ["name"] },
        { model: db.Facility, as: "facility", attributes: ["name"] },
        { model: db.Facility, as: "department", attributes: ["name"] },
        { model: db.Computer, as: "computers", through: { attributes: [] }, attributes: ["computerMakeModel"] },
      ],
      order: [["instrumentId", "ASC"]],
    });

    const rows = instruments.map(inst => ({
      instrumentId: inst.instrumentId,
      assetCode: inst.assetCode || "",
      instrumentType: inst.instrumentType || "",
      make: inst.make,
      model: inst.model,
      serialNumber: inst.serialNumber,
      oemDetails: inst.oemDetails ? JSON.stringify(inst.oemDetails) : "",
      status: inst.status,
      applicationName: inst.application?.name || "",
      facilityName: inst.facility?.name || "",
      departmentName: inst.department?.name || "",
      currentLocation: inst.currentLocation || "",
      connectionStatus: inst.connectionStatus || "",
      connectedComputers: inst.computers?.map(c => c.computerMakeModel).join(", ") || "",
    }));

    const effectiveFacilityId = instruments.length > 0 ? instruments[0].facilityId : null;
    const template = await getEffectiveTemplate(effectiveFacilityId, "instrument");
    const currentUser = await db.User.findByPk(req.userId, { attributes: ["id", "fullName", "username"] });

    const columnsMap = columnDefinitions.instrument;
    const selectedColumns = Array.isArray(template.tableColumns) ? template.tableColumns.filter(c => columnsMap[c]) : Object.keys(columnsMap);

    const html = buildReportHTML({
      template,
      currentUser,
      applicationName: applicationId ? "Selected Application" : "All Applications",
      statusText: status || "All",
      rows,
      columnsMap,
      selectedColumns,
    });

    await generatePDF(html, template.orientation, res, "instruments_report.pdf");
  } catch (error) {
    console.error("Instrument PDF error:", error);
    res.status(500).send({ message: error.message });
  }
};

// ================== 🆕 UPDATED Computer PDF ==================
exports.computerListPDF = async (req, res) => {
  try {
    const { status, facilityId } = req.query;
    const selectedFacilityId = req.headers["x-facility-id"];
    const allowedFacilityIds = await getUserFacilities(req.userId, selectedFacilityId || facilityId);
    const where = {};
    if (status && status !== "All") where.status = status;
    if (allowedFacilityIds !== null) {
      if (allowedFacilityIds.length === 0) where.id = -1;
      else where.facilityId = { [db.Sequelize.Op.in]: allowedFacilityIds };
    } else if (facilityId) {
      where.facilityId = facilityId;
    }

    const computers = await db.Computer.findAll({
      where,
      include: [
        { model: db.Facility, as: "facility", attributes: ["name"] },
        { model: db.Facility, as: "department", attributes: ["name"] },
        { model: db.Application, as: "applications", through: { attributes: [] }, attributes: ["name"] },
        { model: db.Instrument, as: "instruments", through: { attributes: [] }, attributes: ["make", "model"] },
      ],
      order: [["hostname", "ASC"]],
    });

    const rows = computers.map(comp => ({
      hostname: comp.hostname,
      computerMakeModel: comp.computerMakeModel,
      serialNumber: comp.serialNumber,
      assetCode: comp.assetCode || "",
      osVersion: comp.osVersion || "",
      antivirusStatus: comp.antivirusStatus || "",
      domainStatus: comp.domainStatus || "",
      systemOwner: comp.systemOwner || "",
      csvDone: comp.csvDone ? "Yes" : "No",
      location: comp.location || "",
      ipAddress: comp.ipAddress,
      status: comp.status,
      facilityName: comp.facility?.name || "",
      departmentName: comp.department?.name || "",
      connectedApplications: comp.applications?.map(a => a.name).join(", ") || "",
      connectedInstruments: comp.instruments?.map(i => `${i.make} ${i.model}`).join(", ") || "",
    }));

    const effectiveFacilityId = computers.length > 0 ? computers[0].facilityId : null;
    const template = await getEffectiveTemplate(effectiveFacilityId, "computer");
    const currentUser = await db.User.findByPk(req.userId, { attributes: ["id", "fullName", "username"] });

    const columnsMap = columnDefinitions.computer;
    const selectedColumns = Array.isArray(template.tableColumns) ? template.tableColumns.filter(c => columnsMap[c]) : Object.keys(columnsMap);

    const html = buildReportHTML({
      template,
      currentUser,
      applicationName: "All Computers",
      statusText: status || "All",
      rows,
      columnsMap,
      selectedColumns,
    });

    await generatePDF(html, template.orientation, res, "computers_report.pdf");
  } catch (error) {
    console.error("Computer PDF error:", error);
    res.status(500).send({ message: error.message });
  }
};

// ================== Audit Trail PDF ==================
exports.auditTrailPDF = async (req, res) => {
  try {
    const { entityType, action, startDate, endDate } = req.query;
    const where = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (startDate && endDate) {
      where.changedAt = { [db.Sequelize.Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const logs = await db.AuditTrail.findAll({
      where,
      include: [{ model: db.User, as: "changedByUser", attributes: ["id", "username", "fullName"] }],
      order: [["changedAt", "DESC"]],
      limit: 1000,
    });

    const rows = logs.map(log => ({
      entityType: log.entityType,
      action: log.action,
      oldValue: log.oldValue ? JSON.stringify(log.oldValue) : "",
      newValue: log.newValue ? JSON.stringify(log.newValue) : "",
      changedBy: log.changedByUser?.fullName || log.changedByUser?.username || "",
      ipAddress: log.ipAddress,
      changedAt: log.changedAt ? new Date(log.changedAt).toLocaleString() : "",
      comments: log.comments || "",
    }));

    const template = await getEffectiveTemplate(null, "audit");
    const currentUser = await db.User.findByPk(req.userId, { attributes: ["id", "fullName", "username"] });

    const columnsMap = columnDefinitions.audit;
    const selectedColumns = Array.isArray(template.tableColumns) ? template.tableColumns.filter(c => columnsMap[c]) : Object.keys(columnsMap);

    const html = buildReportHTML({
      template,
      currentUser,
      applicationName: "Audit Trail",
      statusText: `${entityType || "All"} | ${action || "All"}`,
      rows,
      columnsMap,
      selectedColumns,
    });

    await generatePDF(html, template.orientation, res, "audit_trail.pdf");
  } catch (error) {
    console.error("Audit PDF error:", error);
    res.status(500).send({ message: error.message });
  }
};