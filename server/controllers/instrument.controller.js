const db = require("../models");
const Instrument = db.Instrument;
const Application = db.Application;
const Computer = db.Computer;
const Facility = db.Facility;
const { auditHelper } = require("../utils/auditHelper");
const { getUserFacilities, applyFacilityFilter } = require("../utils/facilityFilter");

async function buildAuditInstrumentObject(instrument, computerNames = null) {
  const facility = instrument.facilityId ? await Facility.findByPk(instrument.facilityId) : null;
  const app = instrument.applicationId ? await Application.findByPk(instrument.applicationId) : null;
  const computers = computerNames || (instrument.computers ? instrument.computers.map(c => c.computerMakeModel) : []);
  return {
    Make: instrument.make,
    Model: instrument.model,
    "Serial Number": instrument.serialNumber,
    Status: instrument.status,
    Application: app ? app.name : null,
    Facility: facility ? facility.name : null,
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

    // ✅ फैक्ट्री वैलिडेशन (यदि facilityId मौजूद है)
    if (facilityId) {
      const facility = await Facility.findByPk(facilityId);
      if (!facility || facility.type !== "FACTORY") {
        return res.status(400).send({ message: "Facility must be a FACTORY" });
      }
    }

    const { make, model, serialNumber, oemDetails, status, applicationId, currentLocation, computerIds } = req.body;
    const instrument = await Instrument.create({
      make, model, serialNumber, oemDetails, status, applicationId, currentLocation, facilityId,
      createdBy: req.userId,
    });
    if (computerIds && Array.isArray(computerIds)) {
      await instrument.setComputers(computerIds);
    }
    const cleanNewValue = await buildAuditInstrumentObject(instrument);
    await auditHelper("INSTRUMENT", instrument.id, "CREATED", null, cleanNewValue, req.userId, req.ip, "Instrument created");
    res.status(201).send(instrument);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    let query = {
      include: [
        { model: Application, as: "application", attributes: ["id", "name"] },
        { model: Computer, as: "computers", through: { attributes: [] }, attributes: ["id", "computerMakeModel"] },
        { model: Facility, as: "facility", attributes: ["id", "name"] }
      ]
    };

    // ✅ Apply facility filter with x-facility-id header
    query = await applyFacilityFilter(
      query,
      req.userId,
      "facilityId",                              // Instrument model mein facilityId column
      req.headers['x-facility-id']               // Header se specific facility ID
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
        { model: Facility, as: "facility" }
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
        { model: Facility, as: "facility" }
      ]
    });
    if (!instrument) return res.status(404).send({ message: "Not found" });

    const oldCleanValue = await buildAuditInstrumentObject(instrument);
    const { make, model, serialNumber, oemDetails, status, applicationId, currentLocation, computerIds, facilityId } = req.body;

    // ✅ फैक्ट्री वैलिडेशन (यदि facilityId भेजा गया है)
    if (facilityId !== undefined) {
      const facility = await Facility.findByPk(facilityId);
      if (!facility || facility.type !== "FACTORY") {
        return res.status(400).send({ message: "Facility must be a FACTORY" });
      }
    }

    await instrument.update({
      make, model, serialNumber, oemDetails, status, applicationId, currentLocation, facilityId,
      updatedBy: req.userId,
    });
    if (computerIds !== undefined) {
      await instrument.setComputers(computerIds);
    }
    await instrument.reload({ include: [{ model: Computer, as: "computers" }] });
    const newCleanValue = await buildAuditInstrumentObject(instrument);

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
      changedOld["Make"] = instrument.make;
      changedNew["Make"] = instrument.make;
      changedOld["Model"] = instrument.model;
      changedNew["Model"] = instrument.model;
      changedOld["Serial Number"] = instrument.serialNumber;
      changedNew["Serial Number"] = instrument.serialNumber;
    }

    await auditHelper("INSTRUMENT", instrument.id, "UPDATED", changedOld, changedNew, req.userId, req.ip, "Instrument updated");
    res.send(instrument);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const instrument = await Instrument.findByPk(req.params.id, {
      include: [{ model: Facility, as: "facility" }, { model: Application, as: "application" }, { model: Computer, as: "computers" }]
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