module.exports = async (models) => {
  const MasterActivity = models.MasterActivity;

  const defaultActivities = [
    { name: "NEW_USER", description: "New User Request" },
    { name: "PASSWORD_RESET", description: "Password Reset Request" },
    { name: "ROLE_CHANGE", description: "Role Change Request" },
    { name: "UNLOCK", description: "Account Unlock Request" },
    { name: "DEACTIVATE", description: "Account Deactivate Request" },
    { name: "REACTIVATE", description: "Account Reactivate Request" },
    { name: "FACILITY_ACCESS", description: "Facility Access Request" },
  ];

  for (const act of defaultActivities) {
    await MasterActivity.findOrCreate({
      where: { name: act.name },
      defaults: { ...act, isActive: true }
    });
  }
};