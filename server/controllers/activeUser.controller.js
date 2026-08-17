const db = require("../models");
const ActiveUser = db.ActiveUserList;
const User = db.User;
const ApplicationRole = db.ApplicationRole;
const { Op } = require("sequelize");
const { getUserFacilities } = require("../utils/facilityFilter");  // ✅ Helper to get user's facility IDs

exports.findAll = async (req, res) => {
  try {
    const { applicationId, status } = req.query;

    if (!applicationId) {
      return res.status(400).send({ message: "applicationId is required" });
    }

    const whereActiveUser = { applicationId };
    if (status && status !== "All") {
      whereActiveUser.status = status;
    }

    // ✅ Get user's facility IDs
    let userFacilityIds = await getUserFacilities(req.userId);
    const specificFacilityId = req.headers['x-facility-id'];

    // ✅ If specific facility header is provided, filter to that facility only (if user has access)
    if (specificFacilityId) {
      const facilityId = parseInt(specificFacilityId, 10);
      if (userFacilityIds === null) {
        // Admin – can access any facility
        userFacilityIds = [facilityId];
      } else if (userFacilityIds.includes(facilityId)) {
        userFacilityIds = [facilityId];
      } else {
        return res.status(403).send({ message: "Access denied to this facility" });
      }
    }

    // ✅ Build query options with facility filter on User
    let queryOptions = {
      where: whereActiveUser,
      include: [
        {
          model: User,
          attributes: ["id", "fullName", "username", "email"],
          include: [
            {
              model: ApplicationRole,
              as: "applicationRoles",
              through: { attributes: [] },
              where: { applicationId },
              required: false,
            },
          ],
        },
      ],
      order: [[User, "fullName", "ASC"]],
    };

    // ✅ Apply facility filter on User through association
    if (userFacilityIds !== null && userFacilityIds.length > 0) {
      queryOptions.include[0].where = {
        id: { [Op.in]: userFacilityIds },  // Filter users who have these facilities
      };
      // Instead of filtering ActiveUser directly, we filter User
      // so only users with access to those facilities appear
    }

    const activeUsers = await ActiveUser.findAll(queryOptions);

    const result = activeUsers.map((au, index) => {
      const user = au.User;
      const roles = user?.applicationRoles?.map(r => r.roleName).join(", ") || "—";
      return {
        key: au.id,
        srNo: index + 1,
        userId: user?.id,
        fullName: user?.fullName || au.username,
        username: au.username,
        email: user?.email || "",
        roles: roles,
        status: au.status,
        applicationId: au.applicationId,
        createdAt: au.createdAt,
      };
    });

    res.send(result);
  } catch (error) {
    console.error("Active user fetch error:", error);
    res.status(500).send({ message: error.message });
  }
};