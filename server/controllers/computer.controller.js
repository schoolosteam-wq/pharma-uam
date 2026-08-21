const db = require("../models");
const { Op } = require("sequelize");
const Computer = db.Computer;
const Instrument = db.Instrument;
const Application = db.Application;
const Facility = db.Facility;
const { auditHelper } = require("../utils/auditHelper");
const { getUserFacilities, applyFacilityFilter } = require("../utils/facilityFilter");

async function buildAuditComputerObject(computer) {
  const facility = computer.facilityId ? await Facility.findByPk(computer.facilityId) : null;
  const department = computer.departmentId ? await Facility.findByPk(computer.departmentId) : null;
  const connectedInstruments = computer.instruments ? computer.instruments.map(i => `${i.make} ${i.model}`) : [];
  const connectedApplications = computer.applications ? computer.applications.map(a => a.name) : [];
  return {
    "Hostname": computer.hostname,
    "Make & Model": computer.computerMakeModel,
    "Serial Number": computer.serialNumber,
    "IP Address": computer.ipAddress,
    Status: computer.status,
    Facility: facility ? facility.name : null,
    Department: department ? department.name : null,
    "Connected Instruments": connectedInstruments,
    "Connected Applications": connectedApplications,
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

    const {
      hostname, computerMakeModel, serialNumber, assetCode, osVersion,
      antivirusStatus, domainStatus, systemOwner, csvDone, location,
      ipAddress, status, instrumentIds, applicationIds, departmentId
    } = req.body;

    if (!hostname) {
      return res.status(400).send({ message: "Hostname is required" });
    }

    if (instrumentIds && Array.isArray(instrumentIds) && instrumentIds.length > 0) {
      const alreadyLinked = await db.ComputerInstrument.findAll({
        where: { instrumentId: { [Op.in]: instrumentIds } },
        attributes: ["instrumentId"],
      });
      if (alreadyLinked.length > 0) {
        return res.status(400).send({
          message: "Some instruments are already connected to another computer.",
        });
      }
    }

    const computer = await Computer.create({
      hostname,
      computerMakeModel,
      serialNumber,
      assetCode: assetCode || null,
      osVersion: osVersion || null,
      antivirusStatus: antivirusStatus || "Not Installed",
      domainStatus: domainStatus || "Workgroup",
      systemOwner: systemOwner || null,
      csvDone: csvDone ?? false,
      location: location || null,
      ipAddress: ipAddress || null,
      status: status || "ACTIVE",
      departmentId: departmentId || null,
      facilityId: facilityId || null,
      createdBy: req.userId,
    });

    if (instrumentIds) await computer.setInstruments(instrumentIds);
    if (applicationIds) await computer.setApplications(applicationIds);

    const cleanNewValue = await buildAuditComputerObject(computer);
    await auditHelper("COMPUTER", computer.id, "CREATED", null, cleanNewValue,
                      req.userId, req.ip, "Computer created");
    res.status(201).send(computer);
  } catch (error) {
    console.error("Computer create error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    let query = {
      include: [
        { model: Instrument, as: "instruments", attributes: ["id", "make", "model"] },
        { model: Application, as: "applications", attributes: ["id", "name"] },
        { model: Facility, as: "facility", attributes: ["id", "name"] },
        { model: Facility, as: "department", attributes: ["id", "name"] },
      ]
    };

    query = await applyFacilityFilter(
      query,
      req.userId,
      "facilityId",
      req.headers['x-facility-id']
    );

    const computers = await Computer.findAll(query);
    res.send(computers);
  } catch (error) {
    console.error("Error fetching computers:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const computer = await Computer.findByPk(req.params.id, {
      include: [
        { model: Instrument, as: "instruments" },
        { model: Application, as: "applications" },
        { model: Facility, as: "facility", attributes: ["id", "name"] },
        { model: Facility, as: "department", attributes: ["id", "name"] },
      ]
    });
    if (!computer) return res.status(404).send({ message: "Not found" });
    const userFacs = await getUserFacilities(req.userId);
    if (userFacs !== null && computer.facilityId && !userFacs.includes(computer.facilityId)) {
      return res.status(403).send({ message: "Access denied" });
    }
    res.send(computer);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const computer = await Computer.findByPk(req.params.id, {
      include: [
        { model: Instrument, as: "instruments" },
        { model: Application, as: "applications" },
        { model: Facility, as: "facility" },
        { model: Facility, as: "department" },
      ]
    });
    if (!computer) return res.status(404).send({ message: "Not found" });

    const oldCleanValue = await buildAuditComputerObject(computer);
    const {
      hostname, computerMakeModel, serialNumber, assetCode, osVersion,
      antivirusStatus, domainStatus, systemOwner, csvDone, location,
      ipAddress, status, instrumentIds, applicationIds, facilityId, departmentId
    } = req.body;

    if (facilityId !== undefined) {
      const facility = await Facility.findByPk(facilityId);
      if (!facility || facility.type !== "FACTORY") {
        return res.status(400).send({ message: "Facility must be a FACTORY" });
      }
    }

    const oldStatus = computer.status;

    await computer.update({
      hostname: hostname !== undefined ? hostname : computer.hostname,
      computerMakeModel: computerMakeModel !== undefined ? computerMakeModel : computer.computerMakeModel,
      serialNumber: serialNumber !== undefined ? serialNumber : computer.serialNumber,
      assetCode: assetCode !== undefined ? assetCode : computer.assetCode,
      osVersion: osVersion !== undefined ? osVersion : computer.osVersion,
      antivirusStatus: antivirusStatus !== undefined ? antivirusStatus : computer.antivirusStatus,
      domainStatus: domainStatus !== undefined ? domainStatus : computer.domainStatus,
      systemOwner: systemOwner !== undefined ? systemOwner : computer.systemOwner,
      csvDone: csvDone !== undefined ? csvDone : computer.csvDone,
      location: location !== undefined ? location : computer.location,
      ipAddress: ipAddress !== undefined ? ipAddress : computer.ipAddress,
      status: status !== undefined ? status : computer.status,
      departmentId: departmentId !== undefined ? departmentId : computer.departmentId,
      facilityId: facilityId !== undefined ? facilityId : computer.facilityId,
      updatedBy: req.userId,
    });

    // ===== GRANULAR CASCADE ON INACTIVE =====
    if (status === "INACTIVE" && oldStatus !== "INACTIVE") {
      // Unlink applications with audit
      const linkedAppIds = await db.ComputerApplication.findAll({
        where: { computerId: computer.id },
        attributes: ["applicationId"],
      });
      for (const link of linkedAppIds) {
        const app = await Application.findByPk(link.applicationId, { attributes: ["id", "name"] });
        if (app) {
          await auditHelper(
            "APPLICATION",
            app.id,
            "UNLINKED_BY_COMPUTER_INACTIVE",
            { ComputerId: computer.id },
            { ComputerId: null },
            req.userId,
            req.ip,
            `Application ${app.name} unlinked due to computer ${computer.hostname} inactivation`
          );
        }
      }
      await db.ComputerApplication.destroy({ where: { computerId: computer.id } });

      // Unlink instruments with audit
      const linkedInstIds = await db.ComputerInstrument.findAll({
        where: { computerId: computer.id },
        attributes: ["instrumentId"],
      });
      for (const link of linkedInstIds) {
        const inst = await Instrument.findByPk(link.instrumentId, { attributes: ["id", "instrumentId"] });
        if (inst) {
          await auditHelper(
            "INSTRUMENT",
            inst.id,
            "UNLINKED_BY_COMPUTER_INACTIVE",
            { ComputerId: computer.id },
            { ComputerId: null },
            req.userId,
            req.ip,
            `Instrument ${inst.instrumentId} unlinked due to computer ${computer.hostname} inactivation`
          );
        }
      }
      await db.ComputerInstrument.destroy({ where: { computerId: computer.id } });

      await auditHelper(
        "COMPUTER",
        computer.id,
        "INACTIVE",
        { Status: oldStatus },
        { Status: "INACTIVE", Unlinked: true },
        req.userId,
        req.ip,
        "Computer inactivated – links removed"
      );
    }

    if (instrumentIds !== undefined) {
      const alreadyLinked = await db.ComputerInstrument.findAll({
        where: {
          instrumentId: { [Op.in]: instrumentIds },
          computerId: { [Op.ne]: computer.id },
        },
        attributes: ["instrumentId"],
      });
      if (alreadyLinked.length > 0) {
        return res.status(400).send({
          message: "Some instruments are already connected to another computer.",
        });
      }
      await computer.setInstruments(instrumentIds);
    }

    if (applicationIds !== undefined) {
      await computer.setApplications(applicationIds);
    }

    await computer.reload({
      include: [
        { model: Instrument, as: "instruments" },
        { model: Application, as: "applications" },
        { model: Facility, as: "facility" },
        { model: Facility, as: "department" },
      ],
    });
    const newCleanValue = await buildAuditComputerObject(computer);

    const changedOld = {};
    const changedNew = {};
    for (const key of Object.keys(oldCleanValue)) {
      if (JSON.stringify(oldCleanValue[key]) !== JSON.stringify(newCleanValue[key])) {
        changedOld[key] = oldCleanValue[key];
        changedNew[key] = newCleanValue[key];
      }
    }

    if (Object.keys(changedOld).length > 0) {
      changedOld["Hostname"] = computer.hostname;
      changedNew["Hostname"] = computer.hostname;
    }

    await auditHelper("COMPUTER", computer.id, "UPDATED", changedOld, changedNew,
                      req.userId, req.ip, "Computer updated");
    res.send(computer);
  } catch (error) {
    console.error("Computer update error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const computer = await Computer.findByPk(req.params.id, {
      include: [
        { model: Facility, as: "facility" },
        { model: Facility, as: "department" },
        { model: Instrument, as: "instruments" },
        { model: Application, as: "applications" },
      ]
    });
    if (!computer) return res.status(404).send({ message: "Not found" });
    const oldCleanValue = await buildAuditComputerObject(computer);
    await computer.destroy();
    await auditHelper("COMPUTER", req.params.id, "DELETED", oldCleanValue, null,
                      req.userId, req.ip, "Computer deleted");
    res.send({ message: "Deleted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.downloadSampleCsv = async (req, res) => {
  const csvContent =
    "Hostname,Computer Make & Model,Serial Number,Asset Code,OS Version,Antivirus Status,Domain Status,System Owner,CSV Done,Location,IP Address,Status,Department,Facility,Instrument IDs\n" +
    "PC001,Dell Optiplex 7090,SNPC001,ASTPC001,Windows 10 Pro,Installed,AD Joined,John Doe,Yes,Lab1,192.168.1.100,ACTIVE,,,\"INS001,INS002\"\n" +
    "PC002,HP EliteDesk,SNPC002,ASTPC002,Windows 11 Pro,Not Installed,Workgroup,Jane Smith,No,Lab2,192.168.1.101,ACTIVE,,,\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=sample_computers.csv");
  res.send(csvContent);
};