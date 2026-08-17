require("dotenv").config();
const app = require("./app");
const db = require("./models");
const { startScheduler } = require("./cron/scheduler");


const PORT = process.env.PORT || 5000;

// Sync database and seed
db.sequelize.sync({ force: false }).then(async () => {
  console.log("Database synced.");

  // Seed default roles
  const defaultRoles = require("./seeds/defaultRoles");
  for (let r of defaultRoles) {
    await db.Role.findOrCreate({ where: { roleName: r.roleName }, defaults: r });
  }

  // Seed default admin if not exists
  const adminExists = await db.User.findOne({ where: { username: "admin" } });
  if (!adminExists) {
    const seedAdmin = require("./seeds/defaultAdmin");
    await seedAdmin(db);
    console.log("Default admin created (admin / Admin@123)");
  }

  // Seed default master activities (request types)
  const seedMasterActivities = require("./seeds/seedMasterActivities");
  await seedMasterActivities(db);

  // Seed default permissions ONLY if permission table is empty (first run)
  const permCount = await db.Permission.count();
  if (permCount === 0) {
    const seedPerms = require("./seeds/defaultPermissions");
    await seedPerms(db);
    console.log("Default permissions seeded.");
  } else {
    console.log("Permissions already exist, skipping default seed.");
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });

  startScheduler();
  console.log("Scheduler started.");

}).catch(err => {
  console.error("Unable to sync database:", err);
});