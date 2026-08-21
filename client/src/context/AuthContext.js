import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';
import roleService from '../services/roleService';
import settingsService from '../services/settingsService';   // ✅ Added

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState(null);   // ✅ Added

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      fetchPermissions();
    }
    fetchLogo();   // ✅ Added
    setLoading(false);
  }, []);

  const fetchLogo = async () => {
    try {
      const res = await settingsService.getLogo();
      setLogoUrl(res.data.logoUrl);
    } catch (error) {
      console.error('Failed to load logo', error);
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await roleService.getAllPermissions();
      setPermissions(res.data.permissions);
      localStorage.setItem('userPermissions', JSON.stringify(res.data.permissions));
    } catch (error) {
      console.error('Failed to load permissions', error);
    }
  };

  const login = async (username, password, facilityId = null) => {
    const userData = await authService.login(username, password, facilityId);
    setCurrentUser(userData);
    await fetchPermissions();
    await fetchLogo();   // ✅ refresh after login
    return userData;
  };

  const logout = () => {
    authService.logout();
    setCurrentUser(null);
    setPermissions([]);
    localStorage.removeItem('userPermissions');
    localStorage.removeItem('userFacilities');
    localStorage.removeItem('selectedFacility');
  };

  const value = { currentUser, permissions, login, logout, loading, logoUrl };   // ✅ Added logoUrl

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);