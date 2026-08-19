import API from './api';

const getTemplate = (facilityId, reportType) => {
  const params = { reportType };
  if (facilityId) params.facilityId = facilityId;
  return API.get('/report-templates', { params });
};

const saveTemplate = (data) => API.post('/report-templates', data);

const uploadLogo = (formData) => API.post('/report-templates/upload-logo', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

const uploadReference = (formData) => API.post('/report-templates/upload-reference', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

const copyTemplate = (fromFacilityId, toFacilityId, reportType) =>
  API.post('/report-templates/copy', { fromFacilityId, toFacilityId, reportType });

const reportTemplateService = { getTemplate, saveTemplate, uploadLogo, uploadReference, copyTemplate };
export default reportTemplateService;