const db = require("../models");
const { Op } = require("sequelize");
const Application = db.Application;
const ApplicationRole = db.ApplicationRole;
const ApplicationGroup = db.ApplicationGroup;
const Instrument = db.Instrument;
const Computer = db.Computer;
const Facility = db.Facility;
const Group = db.Group;
const { auditHelper } = require("../utils/auditHelper");
const { getUserFacilities, applyFacilityFilter } = require("../utils/facilityFilter");

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

    if (facilityId) {
      const facility = await Facility.findByPk(facilityId);
      if (!facility || facility.type !== "FACTORY") {
        return res.status(400).send({ message: "Facility must be a FACTORY" });
      }
    }

    const { roles, groups, adminGroups, instrumentIds, computerIds, ...data } = req.body;

    if (instrumentIds && Array.isArray(instrumentIds) && instrumentIds.length > 0) {
      const linkedInstruments = await Instrument.findAll({
        where: { id: { [Op.in]: instrumentIds }, applicationId: { [Op.ne]: null } },
        attributes: ["id", "instrumentId"],
      });
      if (linkedInstruments.length > 0) {
        return res.status(400).send({
          message: `Following instruments already assigned to another application: ${linkedInstruments.map(i => i.instrumentId).join(", ")}`,
        });
      }
    }

    const app = await Application.create({
      name: data.name,
      manufacturer: data.manufacturer || null,
      versionNo: data.versionNo || null,
      oemContact: data.oemContact || null,
      status: data.status || "ACTIVE",
      facilityId: facilityId || null,
      departmentId: data.departmentId || null,
      applicationOwner: data.applicationOwner || null,
      gampCategory: data.gampCategory || null,
      validated: data.validated ?? false,
      eresApplicable: data.eresApplicable ?? false,
      lastPeriodicReviewDate: data.lastPeriodicReviewDate || null,
      databaseType: data.databaseType || null,
      auditTrailEnabled: data.auditTrailEnabled ?? false,
      applicationCriticality: data.applicationCriticality || null,
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

    if (adminGroups && Array.isArray(adminGroups)) {
      const groupRecords = await Group.findAll({ where: { id: adminGroups } });
      await app.setAdminGroups(groupRecords);
    }

    if (instrumentIds && Array.isArray(instrumentIds) && instrumentIds.length > 0) {
      await Instrument.update(
        { applicationId: app.id },
        { where: { id: { [Op.in]: instrumentIds } } }
      );
    }

    if (computerIds && Array.isArray(computerIds) && computerIds.length > 0) {
      const computers = await Computer.findAll({ where: { id: { [Op.in]: computerIds } } });
      await app.setComputers(computers);
    }

    await app.reload({
      include: [
        { model: Group, as: "adminGroups" },
        { model: Instrument, as: "instruments" },
        { model: Computer, as: "computers" },
      ],
    });

    const cleanNewValue = await buildAuditAppObject(app, roles, groups, adminGroups);
    await auditHelper("APPLICATION", app.id, "CREATED", null, cleanNewValue,
                      req.userId, req.ip, "Application created");
    res.status(201).send(app);
  } catch (error) {
    console.error("Application create error:", error);
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
        { model: Facility, as: "department", attributes: ["id", "name"] },
        {
          model: Group,
          as: "adminGroups",
          attributes: ["id", "groupName"],
          through: { attributes: [] },
        },
      ],
    };

    query = await applyFacilityFilter(
      query,
      req.userId,
      "facilityId",
      req.headers["x-facility-id"]
    );

    const apps = await Application.findAll(query);

    const result = apps.map((app) => ({
      ...app.toJSON(),
      instrumentCount: app.instruments.length,
      computerCount: app.computers.length,
      roles: app.applicationRoles.map((r) => r.roleName),
      groups: app.applicationGroups.map((g) => g.groupName),
      adminGroups: app.adminGroups
        ? app.adminGroups.map((g) => ({ id: g.id, groupName: g.groupName }))
        : [],
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
        { model: Facility, as: "department", attributes: ["id", "name"] },
        {
          model: Group,
          as: "adminGroups",
          attributes: ["id", "groupName"],
          through: { attributes: [] },
        },
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
        { model: Group, as: "adminGroups", attributes: ["id", "groupName"] },
      ],
    });
    if (!app) return res.status(404).send({ message: "Application not found" });

    const oldCleanValue = await buildAuditAppObject(app, undefined, undefined, undefined);

    const { roles, groups, adminGroups, instrumentIds, computerIds, ...data } = req.body;

    if (data.facilityId !== undefined) {
      const facility = await Facility.findByPk(data.facilityId);
      if (!facility || facility.type !== "FACTORY") {
        return res.status(400).send({ message: "Facility must be a FACTORY" });
      }
    }

    if (instrumentIds !== undefined && Array.isArray(instrumentIds) && instrumentIds.length > 0) {
      const alreadyAssigned = await Instrument.findAll({
        where: {
          id: { [Op.in]: instrumentIds },
          applicationId: { [Op.ne]: null },
          [Op.and]: [{ applicationId: { [Op.ne]: app.id } }],
        },
        attributes: ["id", "instrumentId"],
      });
      if (alreadyAssigned.length > 0) {
        return res.status(400).send({
          message: `Following instruments already assigned to another application: ${alreadyAssigned.map(i => i.instrumentId).join(", ")}`,
        });
      }
    }

    const oldStatus = app.status;

    await app.update({
      name: data.name,
      manufacturer: data.manufacturer,
      versionNo: data.versionNo,
      oemContact: data.oemContact,
      status: data.status,
      facilityId: data.facilityId !== undefined ? data.facilityId : app.facilityId,
      departmentId: data.departmentId !== undefined ? data.departmentId : app.departmentId,
      applicationOwner: data.applicationOwner !== undefined ? data.applicationOwner : app.applicationOwner,
      gampCategory: data.gampCategory !== undefined ? data.gampCategory : app.gampCategory,
      validated: data.validated !== undefined ? data.validated : app.validated,
      eresApplicable: data.eresApplicable !== undefined ? data.eresApplicable : app.eresApplicable,
      lastPeriodicReviewDate: data.lastPeriodicReviewDate !== undefined ? data.lastPeriodicReviewDate : app.lastPeriodicReviewDate,
      databaseType: data.databaseType !== undefined ? data.databaseType : app.databaseType,
      auditTrailEnabled: data.auditTrailEnabled !== undefined ? data.auditTrailEnabled : app.auditTrailEnabled,
      applicationCriticality: data.applicationCriticality !== undefined ? data.applicationCriticality : app.applicationCriticality,
      updatedBy: req.userId,
    });

    // ===== GRANULAR CASCADE ON RETIRED =====
    if (data.status === "RETIRED" && oldStatus !== "RETIRED") {
      // 1. Retire instruments with individual audit
      const instruments = await Instrument.findAll({ where: { applicationId: app.id } });
      for (const inst of instruments) {
        await inst.update({ status: "RETIRED" });
        await auditHelper(
          "INSTRUMENT",
          inst.id,
          "RETIRED_BY_APPLICATION",
          { Status: "ACTIVE" },
          { Status: "RETIRED", ApplicationId: app.id },
          req.userId,
          req.ip,
          `Instrument retired due to application ${app.name} retirement`
        );
      }

      // 2. Inactive computers with individual audit
      const linkedComputers = await db.Computer.findAll({
        include: [{ model: Application, as: "applications", where: { id: app.id } }],
      });
      for (const comp of linkedComputers) {
        if (comp.status !== "INACTIVE") {
          await comp.update({ status: "INACTIVE" });
          await auditHelper(
            "COMPUTER",
            comp.id,
            "INACTIVE_BY_APPLICATION",
            { Status: "ACTIVE" },
            { Status: "INACTIVE", ApplicationId: app.id },
            req.userId,
            req.ip,
            `Computer inactivated due to application ${app.name} retirement`
          );
        }
      }

      // 3. Deactivate users with individual audit
      const activeUsers = await db.ActiveUserList.findAll({
        where: { applicationId: app.id, status: "Active" },
      });
      for (const au of activeUsers) {
        await au.update({ status: "Inactive" });
        await auditHelper(
          "ACTIVE_USER_BULK_UPLOAD",
          au.id,
          "DEACTIVATED_BY_APPLICATION",
          null,
          { userId: au.userId, applicationId: app.id, Status: "Inactive" },
          req.userId,
          req.ip,
          `User deactivated due to application ${app.name} retirement`
        );
      }

      // Summary audit
      await auditHelper(
        "APPLICATION",
        app.id,
        "RETIRED",
        { Status: oldStatus },
        {
          Status: "RETIRED",
          RetiredInstruments: instruments.length,
          InactiveComputers: linkedComputers.length,
          DeactivatedUsers: activeUsers.length,
        },
        req.userId,
        req.ip,
        "Application retired – assets and users updated"
      );
    }

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

    if (adminGroups !== undefined) {
      const groupRecords = await Group.findAll({ where: { id: adminGroups } });
      await app.setAdminGroups(groupRecords);
    }

    // ===== SKIP linking changes if application is RETIRED =====
    if (data.status !== "RETIRED") {
      if (instrumentIds !== undefined) {
        await Instrument.update(
          { applicationId: null },
          { where: { applicationId: app.id, id: { [Op.notIn]: instrumentIds } } }
        );
        if (instrumentIds.length > 0) {
          await Instrument.update(
            { applicationId: app.id },
            { where: { id: { [Op.in]: instrumentIds } } }
          );
        }
      }

      if (computerIds !== undefined) {
        const computers = await Computer.findAll({ where: { id: { [Op.in]: computerIds } } });
        await app.setComputers(computers);
      }
    }

    await app.reload({
      include: [
        { model: ApplicationRole, as: "applicationRoles" },
        { model: ApplicationGroup, as: "applicationGroups" },
        { model: Group, as: "adminGroups" },
        { model: Instrument, as: "instruments" },
        { model: Computer, as: "computers" },
      ],
    });
    const newCleanValue = await buildAuditAppObject(app, roles, groups);

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
    console.error("Application update error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const app = await Application.findByPk(req.params.id, {
      include: [
        { model: Facility, as: "facility" },
        { model: ApplicationRole, as: "applicationRoles" },
        { model: ApplicationGroup, as: "applicationGroups" },
      ],
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
        { model: ApplicationRole, as: "applicationRoles", attributes: ["roleName"] },
      ],
    });
    const result = apps.map(app => ({
      id: app.id,
      name: app.name,
      roles: app.applicationRoles.map(r => r.roleName),
    }));
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.downloadSampleCsv = async (req, res) => {
  const csvContent =
    "Application Name,Version,Manufacturer,OEM Contact,Status,Facility,Department,Application Owner,GAMP Category,Validated,ERES Applicable,Last Periodic Review Date,Database Type,Audit Trail Enabled,Application Criticality,Instrument IDs,Computer Hostnames,roles,groups\n" +
    "Empower,3.0,Waters,contact@waters.com,ACTIVE,,,John Doe,1,Yes,Yes,2026-08-01,Oracle,Yes,High,\"INS001,INS002\",\"PC001,PC002\",\"Administrator,Reviewer\",\"Group1\"\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=sample_applications.csv");
  res.send(csvContent);
};