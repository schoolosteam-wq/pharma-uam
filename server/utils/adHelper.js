// server/utils/adHelper.js – Complete with OU‑based facility assignment, disabled handling, manager & audit
const ldap = require("ldapjs");
const db = require("../models");
const Role = db.Role;
const User = db.User;
const Facility = db.Facility;
const { auditHelper } = require("../utils/auditHelper");

async function getADConfig() {
  const Setting = db.Setting;
  const settings = await Setting.findAll({
    where: {
      key: ["ad_enabled", "ad_url", "ad_baseDN", "ad_domain", "ad_username", "ad_password"]
    }
  });
  const config = {};
  settings.forEach(s => { config[s.key] = s.value; });
  return config;
}

function createClient(config) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: config.ad_url });

    const onError = (err) => {
      client.destroy();
      reject(err);
    };
    const onTimeout = () => {
      client.destroy();
      reject(new Error('Connection timeout'));
    };

    client.once('connectTimeout', onTimeout);
    client.once('error', onError);

    client.bind(config.ad_username, config.ad_password, (err) => {
      if (err) {
        client.destroy();
        return reject(err);
      }
      client.removeListener('connectTimeout', onTimeout);
      client.removeListener('error', onError);
      resolve(client);
    });
  });
}

function searchUsers(client, baseDN) {
  return new Promise((resolve, reject) => {
    const opts = {
      filter: "(&(objectClass=user)(objectCategory=person))",
      scope: "sub",
      attributes: [
        "sAMAccountName", "mail", "displayName", "department",
        "title", "employeeID", "distinguishedName", "userAccountControl",
        "manager"   // ✅ ADDED for reportingManager
      ]
    };
    const users = [];
    client.search(baseDN, opts, (err, res) => {
      if (err) return reject(err);
      res.on("searchEntry", (entry) => {
        const attrs = entry.attributes.reduce((acc, attr) => {
          acc[attr.type] = attr.values[0];
          return acc;
        }, {});
        users.push(attrs);
      });
      res.on("end", () => resolve(users));
      res.on("error", reject);
    });
  });
}

async function syncADUsers(adminUserId = null) {
  try {
    const config = await getADConfig();
    if (config.ad_enabled !== "true") return { message: "AD sync disabled", count: 0 };

    const Setting = db.Setting;
    const mappingSetting = await Setting.findOne({ where: { key: "ad_ou_mapping" } });
    const ouMapping = mappingSetting ? JSON.parse(mappingSetting.value) : {};

    const defaultAdminUsers = await User.findAll({
      include: [{ model: Role, as: "roles", where: { roleName: "Default Administrator" } }],
      attributes: ["username"]
    });
    const defaultAdminUsernames = new Set(defaultAdminUsers.map(u => u.username.toLowerCase()));

    let adminFacilities = [];
    if (adminUserId) {
      const adminUser = await User.findByPk(adminUserId, {
        include: [{ model: Facility, as: "facilities" }]
      });
      if (adminUser && adminUser.facilities.length > 0) {
        adminFacilities = adminUser.facilities.filter(f => f.type === "FACTORY");
      }
    }

    const mappedFacilityIds = new Set(Object.values(ouMapping).map(id => Number(id)));

    let client;
    try {
      client = await createClient(config);
    } catch (err) {
      console.error("LDAP connection failed:", err.message);
      return { message: `LDAP connection failed: ${err.message}`, count: 0 };
    }

    let adUsers = [];
    try {
      adUsers = await searchUsers(client, config.ad_baseDN);
    } catch (err) {
      console.error("LDAP search failed:", err.message);
      client.destroy();
      return { message: `LDAP search failed: ${err.message}`, count: 0 };
    }
    client.destroy();

    let count = 0;
    const defaultRole = await Role.findOne({ where: { roleName: "User" } });

    for (const adUser of adUsers) {
      const username = adUser.sAMAccountName;
      if (!username) continue;

      // ✅ Extract manager name from DN
      let managerName = null;
      if (adUser.manager) {
        const cnMatch = adUser.manager.match(/^CN=([^,]+)/i);
        if (cnMatch) {
          managerName = cnMatch[1].trim();
        }
      }

      // ✅ Skip default admin – update with audit
      if (defaultAdminUsernames.has(username.toLowerCase())) {
        try {
          const existingAdmin = await User.findOne({ where: { username } });
          if (existingAdmin) {
            const oldValues = {
              email: existingAdmin.email,
              fullName: existingAdmin.fullName,
              department: existingAdmin.department,
              designation: existingAdmin.designation,
              reportingManager: existingAdmin.reportingManager || "",
            };
            await existingAdmin.update({
              email: adUser.mail || existingAdmin.email,
              fullName: adUser.displayName || existingAdmin.fullName,
              department: adUser.department || existingAdmin.department,
              designation: adUser.title || existingAdmin.designation,
              reportingManager: managerName || existingAdmin.reportingManager || "",
            });
            const newValues = {
              email: existingAdmin.email,
              fullName: existingAdmin.fullName,
              department: existingAdmin.department,
              designation: existingAdmin.designation,
              reportingManager: existingAdmin.reportingManager || "",
            };
            const changedOld = {}, changedNew = {};
            Object.keys(oldValues).forEach(key => {
              if (oldValues[key] !== newValues[key]) {
                changedOld[key] = oldValues[key];
                changedNew[key] = newValues[key];
              }
            });
            if (Object.keys(changedOld).length > 0) {
              changedOld.Username = existingAdmin.username;
              changedNew.Username = existingAdmin.username;
              await auditHelper(
                "USER", existingAdmin.id, "UPDATED_BY_AD_SYNC",
                changedOld, changedNew, null, null,
                "Admin user updated by AD sync"
              );
            }
          }
        } catch (err) {
          console.error(`Admin update failed for ${username}:`, err.message);
        }
        continue;
      }

      const isDisabledInAD = (adUser.userAccountControl & 0x0002) !== 0;

      let ouName = null;
      if (adUser.distinguishedName) {
        const ouMatch = adUser.distinguishedName.match(/OU=([^,]+)/i);
        if (ouMatch) ouName = ouMatch[1];
      }

      const existingUser = await User.findOne({ where: { username } });

      // ✅ Case 1: Disabled user
      if (isDisabledInAD) {
        if (existingUser && existingUser.passwordHash === null && existingUser.isActive !== false) {
          try {
            existingUser.isActive = false;
            await existingUser.save();
            await auditHelper(
              "USER",
              existingUser.id,
              "DEACTIVATED_BY_AD_SYNC",
              null,
              { Username: existingUser.username },
              null,
              null,
              "User deactivated by AD sync"
            );
          } catch (err) {
            console.error(`Deactivation failed for ${username}:`, err.message);
          }
        }
        continue;
      }

      // ✅ Case 2: Active user – create or update with audit
      try {
        if (!existingUser) {
          let employeeId = adUser.employeeID;
          if (!employeeId || employeeId.trim() === "") {
            employeeId = username;
          }
          const user = await User.create({
            employeeId,
            username,
            email: adUser.mail || `${username}@${config.ad_domain || "company.com"}`,
            fullName: adUser.displayName || username,
            department: adUser.department || "Unknown",
            designation: adUser.title || "",
            domainUserId: username,
            passwordHash: null,
            isActive: true,
            reportingManager: managerName || null,
          });

          if (defaultRole) await user.addRole(defaultRole);

          if (ouMapping && Object.keys(ouMapping).length > 0) {
            if (ouName && ouMapping[ouName]) {
              const facility = await Facility.findByPk(ouMapping[ouName]);
              if (facility && facility.type === "FACTORY") {
                await user.addFacility(facility);
              }
            }
          } else {
            if (adminFacilities.length > 0) {
              await user.setFacilities(adminFacilities);
            }
          }

          // ✅ Audit for creation
          await auditHelper(
            "USER", user.id, "CREATED_BY_AD_SYNC",
            null,
            {
              Username: user.username,
              "Full Name": user.fullName,
              Email: user.email,
              Department: user.department,
              Designation: user.designation,
              "Reporting Manager": user.reportingManager || "",
            },
            null,
            null,
            "User created by AD sync"
          );

          count++;
        } else {
          const oldValues = {
            fullName: existingUser.fullName,
            email: existingUser.email,
            department: existingUser.department,
            designation: existingUser.designation,
            reportingManager: existingUser.reportingManager || "",
          };
          const newValues = {
            fullName: adUser.displayName || existingUser.fullName,
            email: adUser.mail || existingUser.email,
            department: adUser.department || existingUser.department,
            designation: adUser.title || existingUser.designation,
            reportingManager: managerName || existingUser.reportingManager || "",
          };

          await existingUser.update(newValues);

          // ✅ Audit update if any field changed
          const changedOld = {}, changedNew = {};
          Object.keys(oldValues).forEach(key => {
            if (oldValues[key] !== newValues[key]) {
              changedOld[key] = oldValues[key];
              changedNew[key] = newValues[key];
            }
          });
          if (Object.keys(changedOld).length > 0) {
            changedOld.Username = existingUser.username;
            changedNew.Username = existingUser.username;
            await auditHelper(
              "USER", existingUser.id, "UPDATED_BY_AD_SYNC",
              changedOld, changedNew, null, null,
              "User updated by AD sync"
            );
          }

          // Facility mapping logic
          if (ouMapping && Object.keys(ouMapping).length > 0) {
            const desiredFacilityId = ouName ? Number(ouMapping[ouName]) : null;
            const userFacs = await existingUser.getFacilities();
            const currentFacIds = userFacs.map(f => f.id);
            for (const fac of userFacs) {
              const facId = fac.id;
              if (mappedFacilityIds.has(facId) && facId !== desiredFacilityId) {
                await existingUser.removeFacility(fac);
              }
            }
            if (desiredFacilityId && !currentFacIds.includes(desiredFacilityId)) {
              const desiredFacility = await Facility.findByPk(desiredFacilityId);
              if (desiredFacility && desiredFacility.type === "FACTORY") {
                await existingUser.addFacility(desiredFacility);
              }
            }
          } else if (adminFacilities.length > 0) {
            await existingUser.setFacilities(adminFacilities);
          }
        }
      } catch (err) {
        console.error(`Failed to sync user ${username}:`, err.message);
        if (err.name === "SequelizeValidationError") {
          const errors = err.errors.map(e => `${e.path}: ${e.message}`).join(', ');
          console.error(`Validation errors: ${errors}`);
        } else if (err.name === "SequelizeUniqueConstraintError") {
          console.error(`Duplicate key: ${err.fields ? Object.keys(err.fields).join(', ') : 'unknown'}`);
        }
      }
    }

    return { message: `Sync completed. ${count} new users imported.`, count };
  } catch (error) {
    console.error("AD Sync Critical Error:", error.message);
    return { message: `AD Sync failed: ${error.message}`, count: 0 };
  }
}

async function testConnection() {
  try {
    const config = await getADConfig();
    if (config.ad_enabled !== "true") return { success: false, message: "AD Sync is disabled" };
    const client = await createClient(config);
    client.destroy();
    return { success: true, message: "Connection successful" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

module.exports = { syncADUsers, testConnection, getADConfig };