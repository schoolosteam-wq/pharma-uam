import API from './api';

const getAdminGroups = (applicationId) => API.get(`/applications/${applicationId}/admin-groups`);
const saveAdminGroups = (applicationId, groupIds) => API.put(`/applications/${applicationId}/admin-groups`, { groupIds });

const applicationAdminGroupService = { getAdminGroups, saveAdminGroups };
export default applicationAdminGroupService;