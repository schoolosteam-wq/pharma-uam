// src/services/api.js – Only change the interceptor to handle null selectedFacility
import axios from 'axios';
import { message } from 'antd';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const API = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const selectedFacility = localStorage.getItem('selectedFacility');
  if (selectedFacility) {
    try {
      const facility = JSON.parse(selectedFacility);
      if (facility && facility.id) {
        config.headers['x-facility-id'] = facility.id;
      }
    } catch { /* ignore */ }
  }
  // If selectedFacility is null/absent, no header is sent → admin sees all

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (error.request && !error.response) {
      message.error('Network error – server may be down', 5);
    }
    return Promise.reject(error);
  }
);

export default API;