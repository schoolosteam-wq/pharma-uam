const db = require("../models");
const AuditTrail = db.AuditTrail;
const User = db.User;
const { Op } = require("sequelize");
const { getUserFacilities } = require("../utils/facilityFilter");

exports.findAll = async (req, res) => {
  try {
    const { entityType, action, startDate, endDate } = req.query;
    const where = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (startDate && endDate) {
      where.changedAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    // ✅ Get user's facility IDs with optional header
    const selectedFacilityId = req.headers['x-facility-id'];
    const allowedIds = await getUserFacilities(req.userId, selectedFacilityId);

    // ✅ Build include for changedByUser
    let includeUser = {
      model: User,
      as: "changedByUser",
      attributes: ["id", "username"]
    };

    // If not admin, filter by user's facilities via nested association
    if (allowedIds !== null && allowedIds.length > 0) {
      includeUser.include = [
        {
          model: db.Facility,
          as: "facilities",
          attributes: [],
          through: { attributes: [] },
          where: { id: { [Op.in]: allowedIds } }
        }
      ];
      includeUser.required = true; // Only include users that have at least one of the allowed facilities
    }

    const logs = await AuditTrail.findAll({
      where,
      include: [includeUser],
      order: [["changedAt", "DESC"]],
      limit: 1000
    });

    res.send(logs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).send({ message: error.message });
  }
};