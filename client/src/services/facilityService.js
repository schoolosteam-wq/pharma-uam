import API from './api';

const getAll = () => API.get('/facilities');
const getOne = (id) => API.get(`/facilities/${id}`);
const create = (data) => API.post('/facilities', data);
const update = (id, data) => API.put(`/facilities/${id}`, data);
const remove = (id) => API.delete(`/facilities/${id}`);
const getByType = (type) => API.get(`/facilities?type=${type}`);
const getAllFactories = () => API.get('/facilities/factories');

const facilityService = { getAll, getOne, create, update, remove, getByType, getAllFactories };
export default facilityService;