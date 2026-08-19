import API from './api';

const getActivities = (applicationId) => API.get(`/applications/${applicationId}/activities`);
const saveActivities = (applicationId, activities) => API.put(`/applications/${applicationId}/activities`, { activities });

const applicationActivityService = { getActivities, saveActivities };
export default applicationActivityService;