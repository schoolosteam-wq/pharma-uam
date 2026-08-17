const db = require("../models");
const Request = db.Request;
const Role = db.Role;
const { Op } = require("sequelize");
const { getUserFacilities } = require("../utils/facilityFilter");

exports.getStats = async (req, res) => {
  try {
    const userId = req.userId;
    const selectedFacilityId = req.headers['x-facility-id'];

    const user = await db.User.findByPk(userId, {
      include: [{ model: Role, as: "roles" }]
    });
    const roleNames = user.roles.map(r => r.roleName);

    const buildTable = (rows) => rows.map(r => ({
      id: r.id,
      requestNo: r.requestNo,
      type: r.type,
      status: r.status,
      createdAt: r.createdAt,
    }));

    // Facility filter for requests
    const requestWhere = {};
    if (selectedFacilityId) {
      requestWhere.facilityId = selectedFacilityId;
    } else {
      // Non-admin: show only user's facilities
      const userFacs = await getUserFacilities(userId);
      if (userFacs !== null) {
        requestWhere.facilityId = userFacs.length ? userFacs : -1;
      }
    }

    // Own requests
    const ownRequests = await Request.findAll({
      where: { ...requestWhere, requesterId: userId },
      order: [["createdAt", "DESC"]]
    });

    let data = {};

    if (roleNames.includes("Default Administrator") || roleNames.includes("Administrator") || roleNames.includes("IT Administrator")) {
      const allRequests = await Request.findAll({ where: requestWhere, order: [["createdAt", "DESC"]] });
      const pendingRequests = allRequests.filter(r => r.status === "SUBMITTED" || r.status === "IN_PROGRESS");
      const closedRequests = allRequests.filter(r => r.status === "APPROVED" || r.status === "REJECTED" || r.status === "COMPLETED");

      data = {
        totalRequests: buildTable(allRequests),
        pendingRequests: buildTable(pendingRequests),
        closedRequests: buildTable(closedRequests),
      };
    } else if (roleNames.includes("HOD") || roleNames.includes("QA Reviewer")) {
      const pendingAt = ownRequests.filter(r => r.status === "SUBMITTED" || r.status === "IN_PROGRESS");
      const forApproval = await Request.findAll({
        where: { ...requestWhere, status: { [Op.in]: ["SUBMITTED", "IN_PROGRESS"] } },
        order: [["createdAt", "DESC"]]
      });
      const completed = ownRequests.filter(r => r.status === "APPROVED" || r.status === "REJECTED" || r.status === "COMPLETED");

      data = {
        ownRequests: buildTable(ownRequests),
        pendingAt: buildTable(pendingAt),
        forApproval: buildTable(forApproval),
        completed: buildTable(completed),
      };
    } else {
      const pendingAt = ownRequests.filter(r => r.status === "SUBMITTED" || r.status === "IN_PROGRESS");
      const completed = ownRequests.filter(r => r.status === "APPROVED" || r.status === "REJECTED" || r.status === "COMPLETED");

      data = {
        ownRequests: buildTable(ownRequests),
        pendingAt: buildTable(pendingAt),
        completed: buildTable(completed),
      };
    }

    res.send(data);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};