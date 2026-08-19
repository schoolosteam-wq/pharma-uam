import API from './api';

const login = async (username, password, facilityId = null) => {
  const response = await API.post('/auth/login', { username, password, facilityId });
  if (response.data.accessToken) {
    localStorage.setItem('accessToken', response.data.accessToken);
    localStorage.setItem('user', JSON.stringify(response.data));
    const permsRes = await API.get('/roles/permissions/me');
    localStorage.setItem('userPermissions', JSON.stringify(permsRes.data.permissions || []));
  }
  return response.data;
};

const logout = async () => {
  try {
    const selectedFacility = localStorage.getItem('selectedFacility');
    let facilityId = null;
    if (selectedFacility) {
      try { facilityId = JSON.parse(selectedFacility)?.id || null; } catch {}
    }
    await API.post('/auth/logout', { facilityId });
  } catch (error) {}
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  localStorage.removeItem('userPermissions');
};

const getCurrentUser = () => {
  return JSON.parse(localStorage.getItem('user'));
};

const authService = { login, logout, getCurrentUser };
export default authService;