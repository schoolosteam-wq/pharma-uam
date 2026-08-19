import API from './api';

const getADConfig = () => API.get('/settings/ad-config');
const saveADConfig = (data) => API.put('/settings/ad-config', data);
const syncADUsers = () => API.post('/users/sync-ad');
const getOUMapping = () => API.get('/settings/ad-ou-mapping');
const saveOUMapping = (data) => API.put('/settings/ad-ou-mapping', data);
const testADConnection = () => API.post('/settings/ad-test');
const getEmailConfig = () => API.get('/settings/email-config');
const saveEmailConfig = (data) => API.put('/settings/email-config', data);
const testEmailConnection = () => API.post('/settings/email-test');
const sendTestEmail = (email) => API.post('/settings/send-test-email', { test_email: email });
const uploadLogo = (formData) => API.post('/settings/upload-logo', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

const settingsService = { getADConfig, saveADConfig, getOUMapping, saveOUMapping, syncADUsers, testADConnection, getEmailConfig, saveEmailConfig, testEmailConnection, sendTestEmail, uploadLogo };
export default settingsService;