import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes';
import 'antd/dist/reset.css'; // Ant Design v5 uses reset.css

const App = () => {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1a5c3e' } }}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;