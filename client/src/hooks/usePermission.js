import { useAuth } from '../context/AuthContext';

// कुछ entities के लिए अलग-अलग create/edit/delete नहीं, बल्कि एक ही MANAGEMENT permission है
const SPECIAL_PERMISSIONS = {
  ROLE: 'MANAGE_ROLES',
  GROUP: 'MANAGE_GROUPS',
  WORKFLOW: 'MANAGE_WORKFLOW',
};

export const usePermission = () => {
  const { permissions } = useAuth();

  const canCreate = (entity) => {
    if (SPECIAL_PERMISSIONS[entity]) {
      return permissions.includes(SPECIAL_PERMISSIONS[entity]);
    }
    return permissions.includes(`CREATE_${entity}`);
  };

  const canEdit = (entity) => {
    if (SPECIAL_PERMISSIONS[entity]) {
      return permissions.includes(SPECIAL_PERMISSIONS[entity]);
    }
    return permissions.includes(`EDIT_${entity}`);
  };

  const canDelete = (entity) => {
    if (SPECIAL_PERMISSIONS[entity]) {
      return permissions.includes(SPECIAL_PERMISSIONS[entity]);
    }
    return permissions.includes(`DELETE_${entity}`);
  };

  const canView = (entity) => permissions.includes(`VIEW_${entity}`);

  return { canCreate, canEdit, canDelete, canView };
};