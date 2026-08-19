import API from './api';

const getAll = () => API.get('/computers');
const getOne = (id) => API.get(`/computers/${id}`);
const create = (data) => API.post('/computers', data);
const update = (id, data) => API.put(`/computers/${id}`, data);
const remove = (id) => API.delete(`/computers/${id}`);

const computerService = { getAll, getOne, create, update, remove };
export default computerService;