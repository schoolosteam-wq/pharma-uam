import API from './api';

const getAll = () => API.get('/workflows');
const getOne = (id) => API.get(`/workflows/${id}`);
const create = (data) => API.post('/workflows', data);
const update = (id, data) => API.put(`/workflows/${id}`, data);
const remove = (id) => API.delete(`/workflows/${id}`);

const workflowService = { getAll, getOne, create, update, remove };
export default workflowService;