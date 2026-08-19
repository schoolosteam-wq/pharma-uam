import API from './api';

const getAll = () => API.get('/instruments');
const getOne = (id) => API.get(`/instruments/${id}`);
const create = (data) => API.post('/instruments', data);
const update = (id, data) => API.put(`/instruments/${id}`, data);
const remove = (id) => API.delete(`/instruments/${id}`);

const instrumentService = { getAll, getOne, create, update, remove };
export default instrumentService;