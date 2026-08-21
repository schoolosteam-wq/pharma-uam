require("dotenv").config();
const ldap = require("ldapjs");
const db = require("../models");

async function main() {
  const settings = await db.Setting.findAll({
    where: { key: ["ad_enabled", "ad_url", "ad_baseDN", "ad_domain", "ad_username", "ad_password"] }
  });
  const config = {};
  settings.forEach(s => { config[s.key] = s.value; });

  const username = process.argv[2]; // pass username as argument
  if (!username) {
    console.error("Usage: node checkADUser.js <username>");
    process.exit(1);
  }

  const client = ldap.createClient({ url: config.ad_url });
  await new Promise((resolve, reject) => {
    client.on("error", reject);
    client.bind(config.ad_username, config.ad_password, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const searchOpts = {
    filter: `(sAMAccountName=${username})`,
    scope: "sub",
    attributes: ["userPrincipalName", "distinguishedName", "sAMAccountName", "userAccountControl", "lockoutTime"],
  };
  const result = await new Promise((resolve, reject) => {
    const entries = [];
    client.search(config.ad_baseDN, searchOpts, (err, res) => {
      if (err) reject(err);
      res.on("searchEntry", (entry) => {
        const attrs = {};
        entry.attributes.forEach((attr) => {
          attrs[attr.type] = attr.values[0];
        });
        entries.push(attrs);
      });
      res.on("end", () => resolve(entries));
      res.on("error", reject);
    });
  });
  client.destroy();

  if (result.length === 0) {
    console.log("User not found.");
  } else {
    const attrs = result[0];
    console.log("User details:", attrs);
    const uac = parseInt(attrs.userAccountControl || "0", 10);
    console.log("Account Disabled:", !!(uac & 0x0002));
    console.log("Account Locked:", !!(uac & 0x0010));
    // lockoutTime may be large integer
    if (attrs.lockoutTime && attrs.lockoutTime !== "0") {
      console.log("Lockout Time (raw):", attrs.lockoutTime);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});