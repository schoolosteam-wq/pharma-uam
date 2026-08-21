import API from './api';

const getAll = () => API.get('/users');
const getOne = (id) => API.get(`/users/${id}`);
const create = (data) => API.post('/users', data);
const update = (id, data) => API.put(`/users/${id}`, data);
const remove = (id) => API.delete(`/users/${id}`);
const getProfile = (applicationId) => {
  const params = applicationId ? { applicationId } : {};
  return API.get('/users/profile', { params });
};
const bulkUpload = (formData) => API.post('/users/bulk-upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
const downloadSampleCsv = () => API.get('/users/sample-csv', { responseType: 'blob' });

const searchUsers = (search, limit = 50) => {
  const params = { search };
  if (limit) params.limit = limit;
  return API.get('/users', { params });
};

const userService = {
  getAll,
  getOne,
  create,
  update,
  remove,
  getProfile,
  bulkUpload,
  downloadSampleCsv,
  searchUsers
};

export default userService;