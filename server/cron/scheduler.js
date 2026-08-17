const cron = require("node-cron");
const { syncADUsers } = require("../utils/adHelper");

function startScheduler() {
  // Every day at midnight (can be adjusted)
  cron.schedule("0 0 * * *", async () => {
    console.log("Running scheduled AD sync...");
    const result = await syncADUsers();
    console.log("AD Sync result:", result);
  });
}

module.exports = { startScheduler };