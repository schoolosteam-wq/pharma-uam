const db = require("../models");
const { Op } = require("sequelize");
const Instrument = db.Instrument;
const Application = db.Application;
const Computer = db.Computer;
const Facility = db.Facility;
const { auditHelper } = require("../utils/auditHelper");
const { getUserFacilities, applyFacilityFilter } = require("../utils/facilityFilter");

async function buildAuditInstrumentObject(instrument, computerNames = null) {
  const facility = instrument.facilityId ? await Facility.findByPk(instrument.facilityId) : null;
  const department = instrument.departmentId ? await Facility.findByPk(instrument.departmentId) : null;
  const app = instrument.applicationId ? await Application.findByPk(instrument.applicationId) : null;
  const computers = computerNames || (instrument.computers ? instrument.computers.map(c => c.computerMakeModel) : []);
  return {
    "Instrument ID": instrument.instrumentId,
    "Asset Code": instrument.assetCode,
    "Instrument Type": instrument.instrumentType,
    Make: instrument.make,
    Model: instrument.model,
    "Serial Number": instrument.serialNumber,
    Status: instrument.status,
    Application: app ? app.name : null,
    Facility: facility ? facility.name : null,
    Department: department ? department.name : null,
    "Current Location": instrument.currentLocation,
    "Connection Status": instrument.connectionStatus,
    "Connected Computers": computers,
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
      instrumentId, assetCode, instrumentType, make, model, serialNumber,
      oemDetails, status, applicationId, currentLocation, departmentId,
      connectionStatus, computerIds
    } = req.body;

    if (!instrumentId) {
      return res.status(400).send({ message: "Instrument ID is required" });
    }

    const instrument = await Instrument.create({
      instrumentId,
      assetCode: assetCode || null,
      instrumentType: instrumentType || null,
      make: make || null,
      model: model || null,
      serialNumber,
      oemDetails: oemDetails || {},
      status: status || "ACTIVE",
      applicationId: applicationId || null,
      currentLocation: currentLocation || null,
      departmentId: departmentId || null,
      connectionStatus: connectionStatus || "Standalone",
      facilityId: facilityId || null,
      createdBy: req.userId,
    });

    if (computerIds && Array.isArray(computerIds)) {
      await instrument.setComputers(computerIds);
    }

    const cleanNewValue = await buildAuditInstrumentObject(instrument);
    await auditHelper("INSTRUMENT", instrument.id, "CREATED", null, cleanNewValue, req.userId, req.ip, "Instrument created");
    res.status(201).send(instrument);
  } catch (error) {
    console.error("Instrument create error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    let query = {
      include: [
        { model: Application, as: "application", attributes: ["id", "name"] },
        { model: Computer, as: "computers", through: { attributes: [] }, attributes: ["id", "computerMakeModel"] },
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

    const instruments = await Instrument.findAll(query);
    res.send(instruments);
  } catch (error) {
    console.error("Error fetching instruments:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const instrument = await Instrument.findByPk(req.params.id, {
      include: [
        { model: Application, as: "application" },
        { model: Computer, as: "computers", through: { attributes: [] } },
        { model: Facility, as: "facility", attributes: ["id", "name"] },
        { model: Facility, as: "department", attributes: ["id", "name"] },
      ]
    });
    if (!instrument) return res.status(404).send({ message: "Not found" });
    const userFacs = await getUserFacilities(req.userId);
    if (userFacs !== null && instrument.facilityId && !userFacs.includes(instrument.facilityId)) {
      return res.status(403).send({ message: "Access denied" });
    }
    res.send(instrument);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const instrument = await Instrument.findByPk(req.params.id, {
      include: [
        { model: Application, as: "application" },
        { model: Computer, as: "computers" },
        { model: Facility, as: "facility" },
        { model: Facility, as: "department" },
      ]
    });
    if (!instrument) return res.status(404).send({ message: "Not found" });

    const oldCleanValue = await buildAuditInstrumentObject(instrument);
    const {
      instrumentId, assetCode, instrumentType, make, model, serialNumber,
      oemDetails, status, applicationId, currentLocation, departmentId,
      connectionStatus, computerIds, facilityId
    } = req.body;

    if (facilityId !== undefined) {
      const facility = await Facility.findByPk(facilityId);
      if (!facility || facility.type !== "FACTORY") {
        return res.status(400).send({ message: "Facility must be a FACTORY" });
      }
    }

    const oldStatus = instrument.status;

    await instrument.update({
      instrumentId: instrumentId !== undefined ? instrumentId : instrument.instrumentId,
      assetCode: assetCode !== undefined ? assetCode : instrument.assetCode,
      instrumentType: instrumentType !== undefined ? instrumentType : instrument.instrumentType,
      make: make !== undefined ? make : instrument.make,
      model: model !== undefined ? model : instrument.model,
      serialNumber: serialNumber !== undefined ? serialNumber : instrument.serialNumber,
      oemDetails: oemDetails !== undefined ? oemDetails : instrument.oemDetails,
      status: status !== undefined ? status : instrument.status,
      applicationId: applicationId !== undefined ? applicationId : instrument.applicationId,
      currentLocation: currentLocation !== undefined ? currentLocation : instrument.currentLocation,
      departmentId: departmentId !== undefined ? departmentId : instrument.departmentId,
      connectionStatus: connectionStatus !== undefined ? connectionStatus : instrument.connectionStatus,
      facilityId: facilityId !== undefined ? facilityId : instrument.facilityId,
      updatedBy: req.userId,
    });

    // ===== GRANULAR CASCADE ON RETIRED/TRANSFERRED =====
    if ((status === "RETIRED" || status === "TRANSFERRED") && oldStatus !== status) {
      // Unlink from application with audit
      if (instrument.applicationId) {
        const app = await Application.findByPk(instrument.applicationId, { attributes: ["id", "name"] });
        if (app) {
          await auditHelper(
            "APPLICATION",
            app.id,
            "UNLINKED_BY_INSTRUMENT",
            { InstrumentId: instrument.id },
            { InstrumentId: null },
            req.userId,
            req.ip,
            `Application ${app.name} unlinked due to instrument ${instrument.instrumentId} ${status.toLowerCase()}`
          );
        }
        await instrument.update({ applicationId: null });
      }

      // Unlink from computers with audit
      const linkedComputerIds = await db.ComputerInstrument.findAll({
        where: { instrumentId: instrument.id },
        attributes: ["computerId"],
      });
      for (const link of linkedComputerIds) {
        const comp = await Computer.findByPk(link.computerId, { attributes: ["id", "hostname"] });
        if (comp) {
          await auditHelper(
            "COMPUTER",
            comp.id,
            "UNLINKED_BY_INSTRUMENT",
            { InstrumentId: instrument.id },
            { InstrumentId: null },
            req.userId,
            req.ip,
            `Computer ${comp.hostname} unlinked due to instrument ${instrument.instrumentId} ${status.toLowerCase()}`
          );
        }
      }
      await db.ComputerInstrument.destroy({ where: { instrumentId: instrument.id } });

      await auditHelper(
        "INSTRUMENT",
        instrument.id,
        status,
        { Status: oldStatus },
        { Status: status, Unlinked: true },
        req.userId,
        req.ip,
        `Instrument ${status.toLowerCase()} – links removed`
      );
    }

    if (computerIds !== undefined) {
      await instrument.setComputers(computerIds);
    }
    await instrument.reload({
      include: [
        { model: Computer, as: "computers" },
        { model: Application, as: "application" },
        { model: Facility, as: "facility" },
        { model: Facility, as: "department" },
      ],
    });
    const newCleanValue = await buildAuditInstrumentObject(instrument);

    const changedOld = {};
    const changedNew = {};
    for (const key of Object.keys(oldCleanValue)) {
      if (JSON.stringify(oldCleanValue[key]) !== JSON.stringify(newCleanValue[key])) {
        changedOld[key] = oldCleanValue[key];
        changedNew[key] = newCleanValue[key];
      }
    }

    if (Object.keys(changedOld).length > 0) {
      changedOld["Instrument ID"] = instrument.instrumentId;
      changedNew["Instrument ID"] = instrument.instrumentId;
    }

    await auditHelper("INSTRUMENT", instrument.id, "UPDATED", changedOld, changedNew, req.userId, req.ip, "Instrument updated");
    res.send(instrument);
  } catch (error) {
    console.error("Instrument update error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const instrument = await Instrument.findByPk(req.params.id, {
      include: [
        { model: Facility, as: "facility" },
        { model: Facility, as: "department" },
        { model: Application, as: "application" },
        { model: Computer, as: "computers" },
      ]
    });
    if (!instrument) return res.status(404).send({ message: "Not found" });
    const oldCleanValue = await buildAuditInstrumentObject(instrument);
    await instrument.destroy();
    await auditHelper("INSTRUMENT", req.params.id, "DELETED", oldCleanValue, null, req.userId, req.ip, "Instrument deleted");
    res.send({ message: "Deleted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.downloadSampleCsv = async (req, res) => {
  const csvContent =
    "Instrument ID,Asset Code,Instrument Type,Make,Model,Serial Number,OEM Details,Status,Current Location,Department,Connection Status,Application,Facility\n" +
    "INS001,AST001,Chromatography,Waters,HPLC,SN123,\"{}\",ACTIVE,Lab1,,Networked,,,\n" +
    "INS002,AST002,Spectroscopy,Agilent,Cary 60,SN456,\"{}\",ACTIVE,Lab2,,Standalone,,,\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=sample_instruments.csv");
  res.send(csvContent);
};