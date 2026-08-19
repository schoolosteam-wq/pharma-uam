import API from './api';

const getAll = () => API.get('/applications');
const getOne = (id) => API.get(`/applications/${id}`);
const create = (data) => API.post('/applications', data);
const update = (id, data) => API.put(`/applications/${id}`, data);
const remove = (id) => API.delete(`/applications/${id}`);
const getForRequest = () => API.get('/applications/list-for-request');
const getRolesGroups = (id) => API.get(`/applications/${id}/roles-groups`);
const downloadSampleCsv = () => API.get('/applications/sample-csv', { responseType: 'blob' });

const applicationService = { getAll, getOne, create, update, remove, getForRequest, getRolesGroups, downloadSampleCsv };
export default applicationService;