import API from './api';

const getAll = () => API.get('/master-activities');
const getOne = (id) => API.get(`/master-activities/${id}`);
const create = (data) => API.post('/master-activities', data);
const update = (id, data) => API.put(`/master-activities/${id}`, data);
const remove = (id) => API.delete(`/master-activities/${id}`);

const masterActivityService = { getAll, getOne, create, update, remove };
export default masterActivityService;