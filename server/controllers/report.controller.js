// server/controllers/report.controller.js – Full with template & font settings
const puppeteer = require("puppeteer");
const db = require("../models");
const path = require("path");
const fs = require("fs");
const { getUserFacilities } = require("../utils/facilityFilter");
const { getEffectiveTemplate } = require("../utils/reportTemplateHelper");

exports.activeUserListPDF = async (req, res) => {
  let browser;
  try {
    const { applicationId, status } = req.query;
    const selectedFacilityId = req.headers["x-facility-id"];

    if (!applicationId) {
      return res.status(400).send({ message: "applicationId is required" });
    }

    const application = await db.Application.findByPk(applicationId, {
      attributes: ["id", "name", "facilityId"],
    });
    const applicationName = application ? application.name : applicationId;

    const template = await getEffectiveTemplate(application?.facilityId);

    const currentUser = await db.User.findByPk(req.userId, {
      attributes: ["id", "fullName", "username"],
    });

    const whereActive = { applicationId };
    if (status && status !== "All") whereActive.status = status;

    const allowedFacilityIds = await getUserFacilities(req.userId, selectedFacilityId);
    if (allowedFacilityIds !== null) {
      if (allowedFacilityIds.length === 0) {
        whereActive.id = -1;
      } else {
        const userFacilityRecords = await db.UserFacility.findAll({
          where: { facilityId: { [db.Sequelize.Op.in]: allowedFacilityIds } },
          attributes: ["userId"],
          raw: true,
        });
        const allowedUserIds = userFacilityRecords.map((u) => u.userId);
        whereActive.userId = { [db.Sequelize.Op.in]: allowedUserIds };
      }
    }

    const activeUsers = await db.ActiveUserList.findAll({
      where: whereActive,
      attributes: ["id", "userId", "applicationId", "username", "status", "createdAt"],
      order: [["id", "ASC"]],
    });

    const rows = [];
    for (let i = 0; i < activeUsers.length; i++) {
      const au = activeUsers[i];

      const user = await db.User.findByPk(au.userId, {
        attributes: ["id", "fullName", "username", "email", "employeeId"],
      });
      if (!user) continue;

      const userRoles = await db.UserApplicationRole.findAll({
        where: { userId: user.id },
        include: [{ model: db.ApplicationRole, where: { applicationId }, attributes: ["roleName"] }],
      });
      const roleNames = userRoles.map((ur) => ur.applicationRole?.roleName).filter(Boolean);

      const userGroups = await db.UserApplicationGroup.findAll({
        where: { userId: user.id },
        include: [{ model: db.ApplicationGroup, where: { applicationId }, attributes: ["groupName"] }],
      });
      const groupNames = userGroups.map((ug) => ug.applicationGroup?.groupName).filter(Boolean);

      const roles = [...roleNames, ...groupNames].join(", ") || "—";

      rows.push({
        srNo: i + 1,
        fullName: user.fullName,
        employeeId: user.employeeId || "",
        roles: roles,
        status: au.status,
      });
    }

    // Logo handling
    const logoPath = template.logoPath
      ? path.join(__dirname, "..", template.logoPath.replace(/^\/uploads\//, "uploads/"))
      : null;
    let logoBase64 = "";
    if (logoPath && fs.existsSync(logoPath)) {
      logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });
    }
    const logoHtml = logoBase64
      ? `<img src="data:image/png;base64,${logoBase64}" style="height:50px;" />`
      : "";

    const headerStyle = `font-family:${template.headerFontFamily};font-size:${template.headerFontSize}px;color:${template.headerFontColor};font-weight:${template.headerFontWeight};`;
    const bodyStyle = `font-family:${template.bodyFontFamily};font-size:${template.bodyFontSize}px;color:${template.bodyFontColor};font-weight:${template.bodyFontWeight};`;
    const footerStyle = `font-family:${template.footerFontFamily};font-size:${template.footerFontSize}px;color:${template.footerFontColor};font-weight:${template.footerFontWeight};`;
    const tableHeaderStyle = `background:${template.tableHeaderBackgroundColor};color:${template.tableHeaderTextColor};`;
    const tableBorderColor = template.tableBorderColor;

    const headerHtml = `
      <div class="header" style="${headerStyle}">
        <div style="display:flex; align-items:center; gap:15px; ${template.logoAlignment === 'RIGHT' ? 'justify-content:space-between; width:100%;' : ''}">
          ${template.logoAlignment === 'LEFT' ? logoHtml : ''}
          <div>
            <div style="font-size:${template.headerFontSize}px; font-weight:${template.headerFontWeight};">${template.companyName || applicationName}</div>
            <div style="font-size:${Math.max(template.headerFontSize - 4, 10)}px;">${template.reportTitle}</div>
            <div style="font-size:${Math.max(template.headerFontSize - 8, 9)}px;">${template.customHeaderText || ''}</div>
          </div>
          ${template.logoAlignment === 'RIGHT' ? logoHtml : ''}
        </div>
      </div>`;

    const printedBy = currentUser?.fullName || currentUser?.username || "System";
    const printedDateTime = new Date().toLocaleString();

    const footerHtml = `
      <div class="footer" style="${footerStyle}">
        <span>${template.footerText}</span>
        <span>Printed By: ${printedBy}</span>
        <span>${printedDateTime}</span>
        ${template.showPageNumber ? '<span>Page 1 of 1</span>' : ''}
        <span style="display:flex; gap:20px;">
          ${template.showPreparedBy ? `<span>${template.preparedByLabel}: _________________</span>` : ''}
          ${template.showReviewedBy ? `<span>${template.reviewedByLabel}: _________________</span>` : ''}
          ${template.showApprovedBy ? `<span>${template.approvedByLabel}: _________________</span>` : ''}
        </span>
      </div>`;

    const rowsHtml = rows.map(
      (r) => `<tr>
        <td>${r.srNo}</td>
        <td>${r.fullName}</td>
        <td>${r.employeeId}</td>
        <td>${r.roles}</td>
        <td>${r.status}</td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${template.reportTitle}</title>
<style>
  body { font-family:${template.bodyFontFamily}; font-size:${template.bodyFontSize}px; color:${template.bodyFontColor}; margin:0; padding:0; }
  .header { width:100%; padding:10px 30px; border-bottom:2px solid ${template.tableBorderColor}; display:flex; justify-content:space-between; align-items:center; ${headerStyle} }
  .content { padding:20px 30px; }
  table { width:100%; border-collapse:collapse; margin-top:15px; }
  th { ${tableHeaderStyle} padding:10px; text-align:left; }
  td { padding:8px 10px; border-bottom:1px solid ${tableBorderColor}; }
  .footer { position:fixed; bottom:0; left:0; width:100%; padding:10px 30px; border-top:1px solid ${tableBorderColor}; display:flex; justify-content:space-between; ${footerStyle} }
</style>
</head>
<body>
  ${headerHtml}
  <div class="content">
    <p>Application: <strong>${applicationName}</strong> | Status: <strong>${status || "All"}</strong></p>
    <table>
      <thead><tr><th>Sr. No.</th><th>User Name</th><th>Emp Code</th><th>Roles/Groups</th><th>Status</th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="5" style="text-align:center;">No data found</td></tr>'}</tbody>
    </table>
  </div>
  ${footerHtml}
</body>
</html>`;

    let pdfBuffer;
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
    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "80px", bottom: "80px", right: "20px", left: "20px" },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=active_users_${applicationId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).send({ message: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};