const bcrypt = require("bcryptjs");

module.exports = async (models) => {
  const admin = await models.User.create({
    employeeId: "EMP0001",
    username: "admin",
    email: "admin@pharma.com",
    fullName: "System Administrator",
    department: "IT",                      // required
    designation: "System Administrator",  // required
    joiningDate: new Date(),              // required – you can set a specific date like "2024-01-01"
    passwordHash: bcrypt.hashSync("Admin@123", 8),
    isActive: true
  });

  const role = await models.Role.findOne({ where: { roleName: "Default Administrator" } });
  if (role) {
    await admin.addRole(role);
  }
};