import React, { useEffect, useState } from 'react';
import { Layout, Button, Space, Select, Typography, Dropdown, Avatar, Modal, Descriptions, message } from 'antd';
import { LogoutOutlined, UserOutlined, DownOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../../services/api';
import userService from '../../services/userService';
import settingsService from '../../services/settingsService';

const { Header } = Layout;
const { Text } = Typography;
const { Option } = Select;

const AppHeader = () => {
  const { currentUser, logout, logoUrl } = useAuth();
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [profileData, setProfileData] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

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
    const oldFacilityId = selectedFacility;
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

  const showProfile = async () => {
    if (!currentUser) return;
    try {
      const res = await userService.getOne(currentUser.id);
      setProfileData(res.data);
      setProfileVisible(true);
    } catch (error) {
      message.error('Failed to load profile');
    }
  };

  const isAdmin = currentUser?.roles?.some(r => r === 'ROLE_DEFAULT ADMINISTRATOR' || r === 'ROLE_ADMINISTRATOR');

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'View Profile',
      onClick: showProfile,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

  return (
    <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 64 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {logoUrl && (
          <img src={`${SERVER_BASE_URL}${logoUrl}`} alt="logo" style={{ height: 60, objectFit: 'contain' }} />
        )}
        <Text strong style={{ fontSize: 18 }}>Pharma User Management</Text>
      </div>
      <Space size="middle">
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
        <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1a5c3e' }} />
            <Text>{currentUser?.fullName || currentUser?.username}</Text>
            <DownOutlined />
          </Space>
        </Dropdown>
      </Space>

      <Modal
        title="User Profile"
        open={profileVisible}
        onCancel={() => setProfileVisible(false)}
        footer={null}
        width={600}
      >
        {profileData ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Full Name">{profileData.fullName}</Descriptions.Item>
            <Descriptions.Item label="Username">{profileData.username}</Descriptions.Item>
            <Descriptions.Item label="Email">{profileData.email}</Descriptions.Item>
            <Descriptions.Item label="Employee ID">{profileData.employeeId}</Descriptions.Item>
            <Descriptions.Item label="Department">{profileData.department}</Descriptions.Item>
            <Descriptions.Item label="Designation">{profileData.designation}</Descriptions.Item>
            <Descriptions.Item label="Roles" span={2}>
              {profileData.roles?.map(r => r.roleName).join(', ') || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Groups" span={2}>
              {profileData.groups?.map(g => g.groupName).join(', ') || '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>Loading...</div>
        )}
      </Modal>
    </Header>
  );
};

export default AppHeader;