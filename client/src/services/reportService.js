import API from './api';

const downloadActiveUsersPDF = (applicationId, status) => {
  const params = { applicationId };
  if (status && status !== 'All') params.status = status;
  return API.get('/reports/active-users/pdf', {
    params,
    responseType: 'blob',
  });
};

const downloadApplicationPDF = (params) => {
  return API.get('/reports/applications/pdf', { params, responseType: 'blob' });
};

const downloadInstrumentPDF = (params) => {
  return API.get('/reports/instruments/pdf', { params, responseType: 'blob' });
};

const downloadComputerPDF = (params) => {
  return API.get('/reports/computers/pdf', { params, responseType: 'blob' });
};

const downloadAuditPDF = (params) => {
  return API.get('/reports/audit/pdf', { params, responseType: 'blob' });
};

export default { downloadActiveUsersPDF, downloadApplicationPDF, downloadInstrumentPDF, downloadComputerPDF, downloadAuditPDF };