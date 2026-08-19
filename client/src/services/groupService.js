// src/services/groupService.js – add new methods
import API from './api';

const getAll = () => API.get('/groups');
const getOne = (id) => API.get(`/groups/${id}`);
const create = (data) => API.post('/groups', data);
const update = (id, data) => API.put(`/groups/${id}`, data);
const remove = (id) => API.delete(`/groups/${id}`);

// New methods
const getMembers = (id) => API.get(`/groups/${id}/members`);
const updateMembers = (id, userIds) => API.put(`/groups/${id}/members`, { userIds });

const groupService = { getAll, getOne, create, update, remove, getMembers, updateMembers };
export default groupService;