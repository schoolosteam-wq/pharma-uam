const db = require("../models");
const Facility = db.Facility;
const { auditHelper } = require("../utils/auditHelper");
const { getUserFacilities, applyFacilityFilter } = require("../utils/facilityFilter");

// --- Helper: Descendants (बच्चों और उनके बच्चों) के IDs ---
async function getDescendantIds(parentId) {
  const ids = new Set();
  const queue = [parentId];
  while (queue.length) {
    const current = queue.shift();
    const children = await Facility.findAll({ where: { parentId: current }, attributes: ['id'] });
    children.forEach(child => {
      ids.add(child.id);
      queue.push(child.id);
    });
  }
  return Array.from(ids);
}

// --- Helper: Ancestors (माता-पिता और उनके माता-पिता) के IDs ---
async function getAncestorIds(facilityId) {
  const ids = new Set();
  let currentId = facilityId;
  while (currentId) {
    const facility = await Facility.findByPk(currentId, { attributes: ['id', 'parentId'] });
    if (!facility) break;
    if (facility.parentId) {
      ids.add(facility.parentId);
      currentId = facility.parentId;
    } else {
      break;
    }
  }
  return Array.from(ids);
}

function buildTree(flatList) {
  const map = {};
  const roots = [];
  flatList.forEach(item => {
    map[item.id] = { ...item.toJSON(), children: [] };
  });
  flatList.forEach(item => {
    if (item.parentId && map[item.parentId]) {
      map[item.parentId].children.push(map[item.id]);
    } else {
      roots.push(map[item.id]);
    }
  });
  return roots;
}

async function buildAuditFacilityObject(facility) {
  const parent = facility.parentId ? await Facility.findByPk(facility.parentId) : null;
  return {
    Code: facility.code,
    Name: facility.name,
    Type: facility.type,
    Status: facility.status,
    Parent: parent ? parent.name : null,
  };
}

exports.create = async (req, res) => {
  try {
    const facility = await Facility.create({ ...req.body, createdBy: req.userId });
    const cleanNewValue = await buildAuditFacilityObject(facility);
    await auditHelper("FACILITY", facility.id, "CREATED", null, cleanNewValue, req.userId, req.ip, "Facility created");
    res.status(201).send(facility);
  } catch (error) {
    console.error("Facility create error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const { type } = req.query;
    const selectedFacilityId = req.headers['x-facility-id'];

    // ✅ Get allowed facility IDs (null for admin, else array)
    const allowedIds = await getUserFacilities(req.userId, selectedFacilityId);

    // ---------- TYPE PAGES ----------
    if (type) {
      const whereClause = { type: type.toUpperCase() };

      if (allowedIds !== null) {
        // Non-admin: include allowed facilities + ancestors + descendants
        const filterIds = new Set();
        for (const id of allowedIds) {
          filterIds.add(id);
          const descendants = await getDescendantIds(id);
          descendants.forEach(d => filterIds.add(d));
          const ancestors = await getAncestorIds(id);
          ancestors.forEach(a => filterIds.add(a));
        }
        whereClause.id = { [db.Sequelize.Op.in]: Array.from(filterIds) };
      }
      // Admin: no filter

      const facilities = await Facility.findAll({
        where: whereClause,
        include: [{ model: Facility, as: "parent", attributes: ["id", "code", "name"] }],
        order: [["name", "ASC"]]
      });
      const result = facilities.map(f => ({
        ...f.toJSON(),
        parentName: f.parent ? f.parent.name : null,
      }));
      return res.send(result);
    }

    // ---------- TREE VIEW ----------
    const allFacilities = await Facility.findAll({ order: [["name", "ASC"]] });
    let filteredList;

    if (allowedIds === null) {
      filteredList = allFacilities;
    } else {
      const allowedSet = new Set(allowedIds);
      const relevantIds = new Set();
      for (const id of allowedIds) {
        relevantIds.add(id);
        const descendants = await getDescendantIds(id);
        descendants.forEach(d => relevantIds.add(d));
        const ancestors = await getAncestorIds(id);
        ancestors.forEach(a => relevantIds.add(a));
      }
      filteredList = allFacilities.filter(f => relevantIds.has(f.id));
    }

    // Build tree from filtered list
    const map = {};
    const roots = [];
    filteredList.forEach(item => { map[item.id] = { ...item.toJSON(), children: [] }; });
    filteredList.forEach(item => {
      if (item.parentId && map[item.parentId]) {
        map[item.parentId].children.push(map[item.id]);
      } else {
        roots.push(map[item.id]);
      }
    });

    res.send(roots);
  } catch (error) {
    console.error("Facility fetch error:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const facility = await Facility.findByPk(req.params.id, {
      include: [{ model: Facility, as: "children" }]
    });
    if (!facility) return res.status(404).send({ message: "Facility not found" });
    res.send(facility);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const facility = await Facility.findByPk(req.params.id);
    if (!facility) return res.status(404).send({ message: "Facility not found" });
    const oldCleanValue = await buildAuditFacilityObject(facility);
    await facility.update({ ...req.body, updatedBy: req.userId });
    const newCleanValue = await buildAuditFacilityObject(facility);

    const changedOld = {};
    const changedNew = {};
    for (const key of Object.keys(oldCleanValue)) {
      if (oldCleanValue[key] !== newCleanValue[key]) {
        changedOld[key] = oldCleanValue[key];
        changedNew[key] = newCleanValue[key];
      }
    }
    if (Object.keys(changedOld).length > 0) {
      changedOld.Name = facility.name;
      changedNew.Name = facility.name;
      changedOld.Code = facility.code;
      changedNew.Code = facility.code;
    }

    await auditHelper("FACILITY", facility.id, "UPDATED", changedOld, changedNew, req.userId, req.ip, "Facility updated");
    res.send(facility);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const facility = await Facility.findByPk(req.params.id);
    if (!facility) return res.status(404).send({ message: "Facility not found" });
    const oldCleanValue = await buildAuditFacilityObject(facility);
    await facility.destroy();
    await auditHelper("FACILITY", req.params.id, "DELETED", oldCleanValue, null, req.userId, req.ip, "Facility deleted");
    res.send({ message: "Facility deleted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getAllFactories = async (req, res) => {
  try {
    const factories = await Facility.findAll({
      where: { type: "FACTORY" },
      attributes: ["id", "name", "code", "type"],
      order: [["name", "ASC"]]
    });
    res.send(factories);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};