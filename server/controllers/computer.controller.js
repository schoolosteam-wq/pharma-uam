const db = require("../models");
const { Op } = require("sequelize");   // ✅ Added
const Computer = db.Computer;
const Instrument = db.Instrument;
const Application = db.Application;
const Facility = db.Facility;
const { auditHelper } = require("../utils/auditHelper");
const { getUserFacilities, applyFacilityFilter } = require("../utils/facilityFilter");

async function buildAuditComputerObject(computer) {
  const facility = computer.facilityId ? await Facility.findByPk(computer.facilityId) : null;
  const connectedInstruments = computer.instruments ? computer.instruments.map(i => `${i.make} ${i.model}`) : [];
  const connectedApplications = computer.applications ? computer.applications.map(a => a.name) : [];
  return {
    "Make & Model": computer.computerMakeModel,
    "Serial Number": computer.serialNumber,
    "IP Address": computer.ipAddress,
    Status: computer.status,
    Facility: facility ? facility.name : null,
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

    // ✅ फैक्ट्री वैलिडेशन (यदि facilityId मौजूद है)
    if (facilityId) {
      const facility = await Facility.findByPk(facilityId);
      if (!facility || facility.type !== "FACTORY") {
        return res.status(400).send({ message: "Facility must be a FACTORY" });
      }
    }

    const { computerMakeModel, serialNumber, ipAddress, status, instrumentIds, applicationIds } = req.body;

    // ========== 🆕 VALIDATION: Check if instruments already linked to another computer ==========
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
      computerMakeModel, serialNumber, ipAddress, status, facilityId,
      createdBy: req.userId,
    });
    if (instrumentIds) await computer.setInstruments(instrumentIds);
    if (applicationIds) await computer.setApplications(applicationIds);
    const cleanNewValue = await buildAuditComputerObject(computer);
    await auditHelper("COMPUTER", computer.id, "CREATED", null, cleanNewValue,
                      req.userId, req.ip, "Computer created");
    res.status(201).send(computer);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    let query = {
      include: [
        { model: Instrument, as: "instruments", attributes: ["id", "make", "model"] },
        { model: Application, as: "applications", attributes: ["id", "name"] },
        { model: Facility, as: "facility", attributes: ["id", "name"] }
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
        { model: Facility, as: "facility" }
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
        { model: Facility, as: "facility" }
      ]
    });
    if (!computer) return res.status(404).send({ message: "Not found" });

    const oldCleanValue = await buildAuditComputerObject(computer);
    const { computerMakeModel, serialNumber, ipAddress, status, instrumentIds, applicationIds, facilityId } = req.body;

    // ✅ फैक्ट्री वैलिडेशन (यदि facilityId भेजा गया है)
    if (facilityId !== undefined) {
      const facility = await Facility.findByPk(facilityId);
      if (!facility || facility.type !== "FACTORY") {
        return res.status(400).send({ message: "Facility must be a FACTORY" });
      }
    }

    await computer.update({
      computerMakeModel, serialNumber, ipAddress, status, facilityId,
      updatedBy: req.userId,
    });

    // ========== 🆕 CASCADE ON INACTIVE (ADDED) ==========
    if (status === "INACTIVE" && computer.status !== "INACTIVE") {
      // Unlink from applications
      await db.ComputerApplication.destroy({ where: { computerId: computer.id } });
      // Unlink from instruments
      await db.ComputerInstrument.destroy({ where: { computerId: computer.id } });
      // Audit
      await auditHelper(
        "COMPUTER",
        computer.id,
        "INACTIVE",
        { Status: "ACTIVE" },
        { Status: "INACTIVE", Unlinked: true },
        req.userId,
        req.ip,
        "Computer inactivated – links removed"
      );
    }

    // ========== 🆕 VALIDATION: Check instruments in update ==========
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

    if (applicationIds !== undefined) await computer.setApplications(applicationIds);
    await computer.reload({ include: [{ model: Instrument, as: "instruments" }, { model: Application, as: "applications" }] });
    const newCleanValue = await buildAuditComputerObject(computer);

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
      changedOld["Make & Model"] = computer.computerMakeModel;
      changedNew["Make & Model"] = computer.computerMakeModel;
      changedOld["Serial Number"] = computer.serialNumber;
      changedNew["Serial Number"] = computer.serialNumber;
    }

    await auditHelper("COMPUTER", computer.id, "UPDATED", changedOld, changedNew,
                      req.userId, req.ip, "Computer updated");
    res.send(computer);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const computer = await Computer.findByPk(req.params.id, {
      include: [{ model: Facility, as: "facility" }, { model: Instrument, as: "instruments" },
                { model: Application, as: "applications" }]
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