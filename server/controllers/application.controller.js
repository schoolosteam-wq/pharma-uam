const db = require("../models");
const Application = db.Application;
const ApplicationRole = db.ApplicationRole;
const ApplicationGroup = db.ApplicationGroup;
const Instrument = db.Instrument;
const Computer = db.Computer;
const Facility = db.Facility;
const Group = db.Group;   // ✅ Already imported
const { auditHelper } = require("../utils/auditHelper");
const { getUserFacilities, applyFacilityFilter } = require("../utils/facilityFilter");

// ✅ Updated to include adminGroupsArr
async function buildAuditAppObject(app, rolesArr, groupsArr, adminGroupsArr) {
  const facility = app.facilityId ? await Facility.findByPk(app.facilityId) : null;
  return {
    "Application Name": app.name,
    Manufacturer: app.manufacturer,
    Version: app.versionNo,
    "OEM Contact": app.oemContact,
    Status: app.status,
    Facility: facility ? facility.name : null,
    Roles: rolesArr !== undefined ? (rolesArr || []) :
           (app.applicationRoles ? app.applicationRoles.map(r => r.roleName) : []),
    Groups: groupsArr !== undefined ? (groupsArr || []) :
           (app.applicationGroups ? app.applicationGroups.map(g => g.groupName) : []),
    "Admin Groups": adminGroupsArr !== undefined ? (adminGroupsArr || []) :
           (app.adminGroups ? app.adminGroups.map(g => g.groupName) : []),
  };
}

exports.create = async (req, res) => {
  try {
    const userFacs = await getUserFacilities(req.userId);
    let facilityId = req.body.facilityId;
    if (userFacs !== null) {
      if (!facilityId || !userFacs.includes(Number(facilityId))) {
        facilityId = userFacs[0] || null;
      }
    }

    // ✅ फैक्ट्री प्रकार की जाँच करें (यदि facilityId मौजूद है)
    if (facilityId) {
      const facility = await Facility.findByPk(facilityId);
      if (!facility || facility.type !== "FACTORY") {
        return res.status(400).send({ message: "Facility must be a FACTORY" });
      }
    }

    // ✅ Destructure adminGroups as well
    const { roles, groups, adminGroups, ...data } = req.body;
    const app = await Application.create({
      name: data.name,
      manufacturer: data.manufacturer || null,
      versionNo: data.versionNo || null,
      oemContact: data.oemContact || null,
      status: data.status || "ACTIVE",
      facilityId: facilityId || null,
      createdBy: req.userId,
    });

    if (roles && Array.isArray(roles)) {
      const roleRecords = roles.map(r => ({ roleName: r, applicationId: app.id }));
      await ApplicationRole.bulkCreate(roleRecords);
    }
    if (groups && Array.isArray(groups)) {
      const groupRecords = groups.map(g => ({ groupName: g, applicationId: app.id }));
      await ApplicationGroup.bulkCreate(groupRecords);
    }

    // ✅ Save admin groups
    if (adminGroups && Array.isArray(adminGroups)) {
      const groupRecords = await Group.findAll({ where: { id: adminGroups } });
      await app.setAdminGroups(groupRecords);
    }

    await app.reload({ include: [{ model: Group, as: "adminGroups" }] });

    // ✅ Pass adminGroups to audit
    const cleanNewValue = await buildAuditAppObject(app, roles, groups, adminGroups);
    await auditHelper("APPLICATION", app.id, "CREATED", null, cleanNewValue,
                      req.userId, req.ip, "Application created");
    res.status(201).send(app);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    let query = {
      include: [
        { model: ApplicationRole, as: "applicationRoles", attributes: ["id", "roleName"] },
        { model: ApplicationGroup, as: "applicationGroups", attributes: ["id", "groupName"] },
        { model: Instrument, as: "instruments", attributes: ["id"] },
        { model: Computer, as: "computers", attributes: ["id"] },
        { model: Facility, as: "facility", attributes: ["id", "name"] },
        // ✅ Include adminGroups
        {
          model: Group,
          as: "adminGroups",
          attributes: ["id", "groupName"],
          through: { attributes: [] }
        }
      ],
    };

    // ✅ Apply facility filter – uses req.userId and optional x-facility-id header
    query = await applyFacilityFilter(
      query,
      req.userId,
      "facilityId",
      req.headers['x-facility-id']
    );

    const apps = await Application.findAll(query);
    
    const result = apps.map(app => ({
      ...app.toJSON(),
      instrumentCount: app.instruments.length,
      computerCount: app.computers.length,
      roles: app.applicationRoles.map(r => r.roleName),
      groups: app.applicationGroups.map(g => g.groupName),
      adminGroups: app.adminGroups ? app.adminGroups.map(g => ({ id: g.id, groupName: g.groupName })) : [],
    }));
    
    res.send(result);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const app = await Application.findByPk(req.params.id, {
      include: [
        { model: ApplicationRole, as: "applicationRoles", attributes: ["id", "roleName"] },
        { model: ApplicationGroup, as: "applicationGroups", attributes: ["id", "groupName"] },
        { model: Instrument, as: "instruments", attributes: ["id", "make", "model", "serialNumber"] },
        { model: Computer, as: "computers", through: { attributes: [] }, attributes: ["id", "computerMakeModel", "serialNumber"] },
        { model: Facility, as: "facility", attributes: ["id", "name"] },
        // ✅ Include adminGroups
        {
          model: Group,
          as: "adminGroups",
          attributes: ["id", "groupName"],
          through: { attributes: [] }
        }
      ],
    });
    if (!app) return res.status(404).send({ message: "Application not found" });

    const userFacs = await getUserFacilities(req.userId);
    if (userFacs !== null && app.facilityId && !userFacs.includes(app.facilityId)) {
      return res.status(403).send({ message: "Access denied" });
    }
    res.send(app);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const app = await Application.findByPk(req.params.id, {
      include: [
        { model: ApplicationRole, as: "applicationRoles" },
        { model: ApplicationGroup, as: "applicationGroups" },
        { model: Facility, as: "facility" },
        { model: Group, as: "adminGroups", attributes: ["id", "groupName"] }
      ]
    });
    if (!app) return res.status(404).send({ message: "Application not found" });

    // ✅ Old audit value without adminGroups (function handles if undefined)
    const oldCleanValue = await buildAuditAppObject(app, undefined, undefined, undefined);

    // ✅ Destructure adminGroups as well
    const { roles, groups, adminGroups, ...data } = req.body;
    if (data.facilityId !== undefined) {
      const facility = await Facility.findByPk(data.facilityId);
      if (!facility || facility.type !== "FACTORY") {
        return res.status(400).send({ message: "Facility must be a FACTORY" });
      }
    }

    await app.update({
      name: data.name,
      manufacturer: data.manufacturer,
      versionNo: data.versionNo,
      oemContact: data.oemContact,
      status: data.status,
      facilityId: data.facilityId !== undefined ? data.facilityId : app.facilityId,
      updatedBy: req.userId,
    });

    if (roles !== undefined) {
      await ApplicationRole.destroy({ where: { applicationId: app.id } });
      if (Array.isArray(roles) && roles.length > 0) {
        const roleRecords = roles.map(r => ({ roleName: r, applicationId: app.id }));
        await ApplicationRole.bulkCreate(roleRecords);
      }
    }
    if (groups !== undefined) {
      await ApplicationGroup.destroy({ where: { applicationId: app.id } });
      if (Array.isArray(groups) && groups.length > 0) {
        const groupRecords = groups.map(g => ({ groupName: g, applicationId: app.id }));
        await ApplicationGroup.bulkCreate(groupRecords);
      }
    }

    // ✅ Update admin groups
    if (adminGroups !== undefined) {
      const groupRecords = await Group.findAll({ where: { id: adminGroups } });
      await app.setAdminGroups(groupRecords);
    }

    // ✅ Reload with all associations for audit
    await app.reload({
      include: [
        { model: ApplicationRole, as: "applicationRoles" },
        { model: ApplicationGroup, as: "applicationGroups" },
        { model: Group, as: "adminGroups" }
      ]
    });
    const newCleanValue = await buildAuditAppObject(app, roles, groups);

    // --- diff only changed fields ---
    const changedOld = {};
    const changedNew = {};
    for (const key of Object.keys(oldCleanValue)) {
      if (JSON.stringify(oldCleanValue[key]) !== JSON.stringify(newCleanValue[key])) {
        changedOld[key] = oldCleanValue[key];
        changedNew[key] = newCleanValue[key];
      }
    }

    if (Object.keys(changedOld).length > 0) {
      changedOld["Application Name"] = app.name;
      changedNew["Application Name"] = app.name;
    }

    await auditHelper("APPLICATION", app.id, "UPDATED", changedOld, changedNew,
                      req.userId, req.ip, "Application updated");
    res.send(app);
  } catch (error) {
    console.error('Application update error:', error);
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const app = await Application.findByPk(req.params.id, {
      include: [
        { model: Facility, as: "facility" },
        { model: ApplicationRole, as: "applicationRoles" },
        { model: ApplicationGroup, as: "applicationGroups" }
        // adminGroups not needed for delete
      ]
    });
    if (!app) return res.status(404).send({ message: "Application not found" });
    const oldCleanValue = await buildAuditAppObject(app, undefined, undefined, undefined);
    await app.destroy();
    await auditHelper("APPLICATION", req.params.id, "DELETED", oldCleanValue, null,
                      req.userId, req.ip, "Application deleted");
    res.send({ message: "Application deleted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getRolesGroups = async (req, res) => {
  try {
    const appId = req.params.id;
    const roles = await ApplicationRole.findAll({ where: { applicationId: appId } });
    const groups = await ApplicationGroup.findAll({ where: { applicationId: appId } });
    res.send({ roles: roles.map(r => r.roleName), groups: groups.map(g => g.groupName) });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.listForRequest = async (req, res) => {
  try {
    const apps = await Application.findAll({
      attributes: ["id", "name"],
      include: [
        { model: ApplicationRole, as: "applicationRoles", attributes: ["roleName"] }
      ]
    });
    const result = apps.map(app => ({
      id: app.id,
      name: app.name,
      roles: app.applicationRoles.map(r => r.roleName)
    }));
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.downloadSampleCsv = async (req, res) => {
  const csvContent = "name,manufacturer,versionNo,oemContact,status,roles,groups\nEmpower,Waters,3.5,contact@waters.com,ACTIVE,\"Administrator,Reviewer,Analyst\",\"Group1,Group2\"";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=sample_applications.csv");
  res.send(csvContent);
};