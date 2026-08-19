import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';
import roleService from '../services/roleService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      fetchPermissions();
    }
    setLoading(false);
  }, []);

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

  const value = { currentUser, permissions, login, logout, loading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);