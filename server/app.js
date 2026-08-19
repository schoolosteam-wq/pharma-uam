const express = require("express");
const cors = require("cors");
const app = express();
app.set('trust proxy', true);

// CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Routes
const authRoutes = require("./routes/auth.routes");
const facilityRoutes = require("./routes/facility.routes");
const userRoutes = require("./routes/user.routes");
const applicationRoutes = require("./routes/application.routes");
const applicationActivityRoutes = require("./routes/applicationActivity.routes");   // ✅ new
const instrumentRoutes = require("./routes/instrument.routes");
const computerRoutes = require("./routes/computer.routes");
const csvRoutes = require("./routes/csv.routes");
const auditRoutes = require("./routes/audit.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const settingRoutes = require("./routes/setting.routes");
const reportRoutes = require("./routes/report.routes");
const activeUserRoutes = require("./routes/activeUser.routes"); 

// ===== NEW ROUTES =====
const requestRoutes = require("./routes/request.routes");
const workflowRoutes = require("./routes/workflow.routes");
const masterActivityRoutes = require("./routes/masterActivity.routes");
const activityWorkflowRoutes = require("./routes/activityWorkflow.routes");
const applicationAdminGroupRoutes = require("./routes/applicationAdminGroup.routes");
const roleRoutes = require("./routes/role.routes");
const groupRoutes = require("./routes/group.routes");
const reportTemplateRoutes = require("./routes/reportTemplate.routes");
const bulkUploadLogRoutes = require("./routes/bulkUploadLog.routes");

app.use("/api/auth", authRoutes);
app.use("/api/facilities", facilityRoutes);
app.use("/api/users", userRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/applications", applicationActivityRoutes);   // ✅ new (same base)
app.use("/api/instruments", instrumentRoutes);
app.use("/api/computers", computerRoutes);
app.use("/api/csv", csvRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/active-users", activeUserRoutes);

// ===== NEW ROUTE USAGE =====
app.use("/api/requests", requestRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/master-activities", masterActivityRoutes);
app.use("/api/activity-workflows", activityWorkflowRoutes);
app.use("/api/applications", applicationAdminGroupRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/report-templates", reportTemplateRoutes);
app.use("/api/bulk-upload-logs", bulkUploadLogRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Pharma User Management API" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: "Something went wrong!" });
});

module.exports = app;