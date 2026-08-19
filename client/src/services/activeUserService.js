import API from './api';

const getByApplication = (applicationId, status) => {
  const params = { applicationId };
  if (status && status !== 'All') params.status = status;
  return API.get('/active-users', { params });
};

const downloadSampleCsv = () => {
  return API.get('/active-users/sample-csv', { responseType: 'blob' });
};

const bulkUpload = (applicationId, file) => {
  const formData = new FormData();
  formData.append('applicationId', applicationId);
  formData.append('file', file);
  return API.post('/active-users/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export default { getByApplication, downloadSampleCsv, bulkUpload };