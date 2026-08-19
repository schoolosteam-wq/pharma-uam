import API from './api';

const getAll = () => API.get('/activity-workflows');
const getOne = (id) => API.get(`/activity-workflows/${id}`);
const create = (data) => API.post('/activity-workflows', data);
const update = (id, data) => API.put(`/activity-workflows/${id}`, data);
const remove = (id) => API.delete(`/activity-workflows/${id}`);

const activityWorkflowService = { getAll, getOne, create, update, remove };
export default activityWorkflowService;