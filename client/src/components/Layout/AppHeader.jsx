// src/components/Layout/AppHeader.jsx – Facility Switcher for admins and non‑admins
import React, { useEffect, useState } from 'react';
import { Layout, Button, Space, Select, Typography } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../../services/api';   // ✅ API import

const { Header } = Layout;
const { Text } = Typography;
const { Option } = Select;

const AppHeader = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);

  useEffect(() => {
    const storedFacilities = JSON.parse(localStorage.getItem('userFacilities') || '[]');
    setFacilities(storedFacilities);

    const storedSelected = localStorage.getItem('selectedFacility');
    if (storedSelected) {
      try {
        setSelectedFacility(JSON.parse(storedSelected)?.id || null);
      } catch {
        setSelectedFacility(null);
      }
    } else {
      setSelectedFacility(null);
    }
  }, []);

  const handleFacilityChange = async (value) => {
    const oldFacilityId = selectedFacility;   // पुरानी चयनित facility (state में)
    try {
      if (!value) {
        localStorage.removeItem('selectedFacility');
        setSelectedFacility(null);
        await API.post('/auth/facility-switch', { oldFacilityId, newFacilityId: null });
      } else {
        const fac = facilities.find(f => f.id === value);
        localStorage.setItem('selectedFacility', JSON.stringify(fac));
        setSelectedFacility(value);
        await API.post('/auth/facility-switch', { oldFacilityId, newFacilityId: value });
      }
    } catch (error) {
      console.error('Facility switch audit failed:', error);
    }
    window.location.reload();
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('selectedFacility');
    localStorage.removeItem('userFacilities');
    navigate('/login');
  };

  const isAdmin = currentUser?.roles?.some(r => r === 'ROLE_DEFAULT ADMINISTRATOR' || r === 'ROLE_ADMINISTRATOR');

  return (
    <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text strong>Pharma User Management</Text>
      <Space>
        {(isAdmin || facilities.length > 1) && (
          <Select
            value={selectedFacility}
            onChange={handleFacilityChange}
            style={{ width: 250 }}
            size="small"
            allowClear={isAdmin}
            placeholder="All Facilities"
          >
            {isAdmin && (
              <Option value={null}>All Facilities</Option>
            )}
            {facilities.map(f => (
              <Option key={f.id} value={f.id}>{f.name} ({f.code})</Option>
            ))}
          </Select>
        )}
        <Text>{currentUser?.username}</Text>
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>Logout</Button>
      </Space>
    </Header>
  );
};

export default AppHeader;