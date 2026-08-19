import API from './api';

const getStats = () => API.get('/dashboard');

const dashboardService = { getStats };
export default dashboardService;