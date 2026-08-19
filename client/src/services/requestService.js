import API from './api';

const create = (data) => API.post('/requests', data);
const getAll = (params) => API.get('/requests', { params });
const getOne = (id) => API.get(`/requests/${id}`);
const submit = (id) => API.put(`/requests/${id}/submit`);
const approve = (id, comments) => API.put(`/requests/${id}/approve`, { comments });
const returnReq = (id, comments) => API.put(`/requests/${id}/return`, { comments });
const rejectReq = (id, comments) => API.put(`/requests/${id}/reject`, { comments });
const resubmit = (id, payload) => API.post(`/requests/${id}/resubmit`, { payload });
const uploadDocument = (id, formData) => API.post(`/requests/${id}/documents`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
const completeWithPassword = (id, data) => API.put(`/requests/${id}/complete-password`, data);
const completeFacilityAccess = (id, data) => API.put(`/requests/${id}/complete-facility-access`, data);

const requestService = {
  create, getAll, getOne, submit, approve, returnReq, rejectReq, resubmit, uploadDocument, completeWithPassword, completeFacilityAccess
};
export default requestService;