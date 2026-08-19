import API from './api';

const getAll = () => API.get('/roles');
const getOne = (id) => API.get(`/roles/${id}`);
const create = (data) => API.post('/roles', data);
const update = (id, data) => API.put(`/roles/${id}`, data);
const remove = (id) => API.delete(`/roles/${id}`);
const getAllPermissions = () => API.get('/roles/permissions/me');

// Payload { permissions: [...] } भेजना है
const updatePermissions = (id, permissions) =>
  API.put(`/roles/${id}/permissions`, { permissions });

const roleService = { getAll, getOne, create, update, remove, updatePermissions, getAllPermissions };
export default roleService;