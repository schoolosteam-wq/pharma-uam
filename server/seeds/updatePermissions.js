// server/seeds/updatePermissions.js
const db = require("../models");

const NEW_PERMISSIONS = {
  "Default Administrator": [
    "MANAGE_APPLICATION_BULK_UPLOAD",
    "MANAGE_INSTRUMENT_BULK_UPLOAD",
    "MANAGE_COMPUTER_BULK_UPLOAD",
    "MANAGE_ACTIVE_USER_BULK_UPLOAD"
  ],
  "Administrator": [
    "MANAGE_APPLICATION_BULK_UPLOAD",
    "MANAGE_INSTRUMENT_BULK_UPLOAD",
    "MANAGE_COMPUTER_BULK_UPLOAD",
    "MANAGE_ACTIVE_USER_BULK_UPLOAD"
  ]
};

async function updatePermissions() {
  try {
    for (const [roleName, permissions] of Object.entries(NEW_PERMISSIONS)) {
      const role = await db.Role.findOne({ where: { roleName } });
      if (!role) {
        console.log(`Role ${roleName} not found, skipping`);
        continue;
      }
      for (const permName of permissions) {
        await db.Permission.findOrCreate({
          where: { permissionName: permName, roleId: role.id },
          defaults: { permissionName: permName, roleId: role.id }
        });
      }
      console.log(`Updated permissions for ${roleName}`);
    }
    console.log("Permission update completed.");
    process.exit(0);
  } catch (err) {
    console.error("Error updating permissions:", err);
    process.exit(1);
  }
}

updatePermissions();