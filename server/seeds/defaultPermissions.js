module.exports = async (models) => {
  const Role = models.Role;
  const Permission = models.Permission;

  // यह वही default permissions हैं जो हर रोल को पहली बार मिलनी चाहिए
  const roleDefaultPermissions = {
    "Default Administrator": [
      "CREATE_USER", "EDIT_USER", "DELETE_USER", "VIEW_USER",
      "CREATE_FACILITY", "EDIT_FACILITY", "DELETE_FACILITY", "VIEW_FACILITY",
      "MANAGE_ROLES", "MANAGE_GROUPS",
      "CREATE_APPLICATION", "EDIT_APPLICATION", "DELETE_APPLICATION", "VIEW_APPLICATION",
      "CREATE_INSTRUMENT", "EDIT_INSTRUMENT", "DELETE_INSTRUMENT", "VIEW_INSTRUMENT",
      "CREATE_COMPUTER", "EDIT_COMPUTER", "DELETE_COMPUTER", "VIEW_COMPUTER",
      "APPROVE_REQUEST", "RETURN_REQUEST", "REJECT_REQUEST", "VIEW_REQUEST",
      "MANAGE_WORKFLOW",
      "VIEW_AUDIT",
      "MANAGE_APPLICATION_BULK_UPLOAD",
      "MANAGE_INSTRUMENT_BULK_UPLOAD",
      "MANAGE_COMPUTER_BULK_UPLOAD",
      "MANAGE_ACTIVE_USER_BULK_UPLOAD"
    ],
    "Administrator": [
      "CREATE_USER", "EDIT_USER", "VIEW_USER",
      "CREATE_FACILITY", "EDIT_FACILITY", "VIEW_FACILITY",
      "CREATE_APPLICATION", "EDIT_APPLICATION", "VIEW_APPLICATION",
      "CREATE_INSTRUMENT", "EDIT_INSTRUMENT", "VIEW_INSTRUMENT",
      "CREATE_COMPUTER", "EDIT_COMPUTER", "VIEW_COMPUTER",
      "APPROVE_REQUEST", "RETURN_REQUEST", "REJECT_REQUEST", "VIEW_REQUEST",
      "VIEW_AUDIT",
      "MANAGE_APPLICATION_BULK_UPLOAD",
      "MANAGE_INSTRUMENT_BULK_UPLOAD",
      "MANAGE_COMPUTER_BULK_UPLOAD",
      "MANAGE_ACTIVE_USER_BULK_UPLOAD"
    ],
    "IT Administrator": [
      "CREATE_USER", "EDIT_USER", "VIEW_USER",
      "CREATE_APPLICATION", "EDIT_APPLICATION", "VIEW_APPLICATION",
      "CREATE_INSTRUMENT", "EDIT_INSTRUMENT", "VIEW_INSTRUMENT",
      "CREATE_COMPUTER", "EDIT_COMPUTER", "VIEW_COMPUTER",
      "APPROVE_REQUEST", "RETURN_REQUEST", "VIEW_REQUEST"
    ],
    "HOD": [
      "VIEW_USER",
      "APPROVE_REQUEST", "RETURN_REQUEST", "VIEW_REQUEST"
    ],
    "QA Reviewer": [
      "VIEW_USER",
      "APPROVE_REQUEST", "RETURN_REQUEST", "VIEW_REQUEST"
    ],
    "User": [
      "VIEW_USER",
      "VIEW_APPLICATION"   // डिफ़ॉल्ट रूप से application देखने का अधिकार
    ]
  };

  for (const [roleName, perms] of Object.entries(roleDefaultPermissions)) {
    const role = await Role.findOne({ where: { roleName } });
    if (!role) continue;

    // सिर्फ उन permissions को जोड़ो जो पहले से मौजूद नहीं हैं
    for (const permName of perms) {
      await Permission.findOrCreate({
        where: { permissionName: permName, roleId: role.id },
        defaults: { permissionName: permName, roleId: role.id }
      });
    }
    // कोई delete नहीं – मौजूदा permissions सुरक्षित रहेंगी
  }
};