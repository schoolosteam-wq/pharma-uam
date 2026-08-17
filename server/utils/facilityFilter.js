const db = require("../models");

async function getUserFacilities(userId, selectedFacilityId = null) {
  if (!userId) return [];
  const user = await db.User.findByPk(userId, {
    include: [
      { model: db.Facility, as: "facilities" },   // ✅ बिना where
      { model: db.Role, as: "roles" }
    ]
  });
  if (!user) return [];

  // केवल फैक्ट्री प्रकार की सुविधाएँ
  const userFactoryIds = user.facilities
    .filter(f => f.type === "FACTORY")
    .map(f => f.id);

  const isAdmin = user.roles.some(r =>
    r.roleName === "Administrator" || r.roleName === "Default Administrator"
  );
  if (isAdmin) {
    if (selectedFacilityId) return [Number(selectedFacilityId)];
    return null; // admin sees all
  }

  if (selectedFacilityId && userFactoryIds.includes(Number(selectedFacilityId))) {
    return [Number(selectedFacilityId)];
  }
  return userFactoryIds;
}

async function applyFacilityFilter(query, userId, field = "facilityId", selectedFacilityId = null) {
  const allowedIds = await getUserFacilities(userId, selectedFacilityId);
  if (allowedIds === null) return query;
  const where = query.where || {};
  if (allowedIds.length === 0) {
    where.id = -1;
  } else {
    where[field] = allowedIds;
  }
  return { ...query, where };
}

module.exports = { getUserFacilities, applyFacilityFilter };