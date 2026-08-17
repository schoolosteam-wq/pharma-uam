// server/controllers/report.controller.js – Fix 4 (complete)
const puppeteer = require("puppeteer");
const db = require("../models");
const path = require("path");
const fs = require("fs");
const { getUserFacilities } = require("../utils/facilityFilter");

exports.activeUserListPDF = async (req, res) => {
  try {
    const { applicationId, status } = req.query;
    const selectedFacilityId = req.headers['x-facility-id'];

    const whereActive = { applicationId };
    if (status && status !== "All") whereActive.status = status;

    // ✅ Get allowed facility IDs for the user (with optional header)
    const allowedFacilityIds = await getUserFacilities(req.userId, selectedFacilityId);

    // If not admin (allowedFacilityIds is not null), filter ActiveUserList
    if (allowedFacilityIds !== null) {
      if (allowedFacilityIds.length > 0) {
        // Filter userIds that belong to the allowed facilities
        whereActive.userId = {
          [db.Sequelize.Op.in]: db.sequelize.literal(
            `(SELECT "userId" FROM "user_facilities" WHERE "facilityId" IN (${allowedFacilityIds.join(',')}))`
          )
        };
      } else {
        // No facilities assigned – force empty result
        whereActive.id = -1;
      }
    }

    const activeUsers = await db.ActiveUserList.findAll({
      where: whereActive,
      include: [
        {
          model: db.User,
          attributes: ["id", "fullName", "username", "email"],
          include: [
            {
              model: db.ApplicationRole,
              as: "applicationRoles",
              through: { attributes: [] },
              where: { applicationId },
              required: false,
            },
          ],
        },
      ],
      order: [[db.User, "fullName", "ASC"]],
    });

    // Logo handling
    const logoPath = path.join(__dirname, "..", "uploads", "company_logo.png");
    let logoBase64 = "";
    if (fs.existsSync(logoPath)) {
      logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });
    }

    let rows = "";
    activeUsers.forEach((au, idx) => {
      const user = au.User;
      const roles = user?.applicationRoles?.map(r => r.roleName).join(", ") || "—";
      rows += `<tr>
        <td>${idx + 1}</td>
        <td>${user?.fullName || au.username}</td>
        <td>${roles}</td>
        <td>${au.status}</td>
      </tr>`;
    });

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Active User Report</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; }
  .header { width: 100%; padding: 10px 30px; border-bottom: 2px solid #3498db; display: flex; justify-content: space-between; align-items: center; }
  .header .left { font-size: 20px; font-weight: bold; color: #2c3e50; display: flex; align-items: center; gap: 15px; }
  .header img { height: 50px; }
  .content { padding: 20px 30px; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th { background: #3498db; color: white; padding: 10px; text-align: left; }
  td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
  .footer { position: fixed; bottom: 0; left: 0; width: 100%; padding: 10px 30px; border-top: 1px solid #ddd; font-size: 12px; color: #7f8c8d; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="header">
    <div class="left">
      ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" />` : ''}
      <span>Active User Report</span>
    </div>
    <div style="font-size:12px;">Generated: ${new Date().toLocaleDateString()}</div>
  </div>
  <div class="content">
    <p>Application: <strong>${applicationId}</strong> | Status: <strong>${status || 'All'}</strong></p>
    <table>
      <thead><tr><th>Sr. No.</th><th>User Name</th><th>Roles/Groups</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="footer">
    <span>Prepared By: _________________</span>
    <span>Reviewed By: _________________</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>`;

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '70px', bottom: '60px', right: '20px', left: '20px' }
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=active_users_${applicationId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).send({ message: error.message });
  }
};