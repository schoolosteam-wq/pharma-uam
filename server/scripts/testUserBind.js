require("dotenv").config();
const ldap = require("ldapjs");
const db = require("../models");

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error("Usage: node testUserBind.js <username> <password>");
    process.exit(1);
  }

  // Fetch AD config from DB
  const settings = await db.Setting.findAll({
    where: { key: ["ad_enabled", "ad_url", "ad_domain"] }
  });
  const config = {};
  settings.forEach(s => { config[s.key] = s.value; });

  const possibleBindStrings = [
    `${username}@${config.ad_domain}`,
    username,
    `${config.ad_domain}\\${username}`,
  ];

  for (const bindStr of possibleBindStrings) {
    console.log(`Trying bind: ${bindStr}`);
    try {
      const client = ldap.createClient({ url: config.ad_url });
      await new Promise((resolve, reject) => {
        let settled = false;
        const handleError = (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
          client.destroy();
        };
        client.on("error", handleError);
        client.bind(bindStr, password, (err) => {
          if (err) {
            handleError(err);
          } else {
            settled = true;
            client.destroy();
            resolve();
          }
        });
      });
      console.log(`✅ SUCCESS: ${bindStr}`);
      process.exit(0);
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
    }
  }
  console.log("All attempts failed.");
  process.exit(1);
}

main();