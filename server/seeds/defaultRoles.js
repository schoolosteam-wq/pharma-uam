module.exports = [
  { roleName: "Default Administrator", description: "Full system access (cannot be modified)", isSystem: true },
  { roleName: "Administrator", description: "Full rights except critical config", isSystem: false },
  { roleName: "IT Administrator", description: "IT department admin", isSystem: false },
  { roleName: "HOD", description: "Head of Department", isSystem: false },
  { roleName: "QA Reviewer", description: "Quality Assurance reviewer", isSystem: false },
  { roleName: "User", description: "Normal user", isSystem: false }
];