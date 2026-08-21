// src/pages/Auth/Login.jsx – Updated to allow admin login without facilities
import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, App, Select } from 'antd';
import { UserOutlined, LockOutlined, MedicineBoxOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

// ✅ Base URL for server (for logo)
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const { login, logoUrl } = useAuth();   // ✅ Added logoUrl
  const navigate = useNavigate();
  const { message } = App.useApp();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const precheckRes = await API.post('/auth/precheck', values);
      const data = precheckRes.data;
      const userFacilities = data.facilities || [];
      const isAdmin = data.roles?.some(r => r === 'ROLE_DEFAULT ADMINISTRATOR' || r === 'ROLE_ADMINISTRATOR');

      localStorage.setItem('userFacilities', JSON.stringify(userFacilities));
      setCredentials({ username: values.username, password: values.password });

      if (isAdmin) {
        await login(values.username, values.password, null);
        localStorage.removeItem('selectedFacility');
        navigate('/');
        return;
      }

      if (userFacilities.length === 0) {
        message.error('No facilities assigned. Contact administrator.', 8);
        setLoading(false);
        return;
      }

      if (userFacilities.length === 1) {
        localStorage.setItem('selectedFacility', JSON.stringify(userFacilities[0]));
        await login(values.username, values.password, userFacilities[0].id);
        navigate('/');
      } else {
        setFacilities(userFacilities);
        setLoading(false);
        return;
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Login failed', 8);
    }
    setLoading(false);
  };

  const handleFacilitySelect = async () => {
    if (!selectedFacility) { message.warning('Please select a facility'); return; }
    try {
      await login(credentials.username, credentials.password, selectedFacility.id);
      localStorage.setItem('selectedFacility', JSON.stringify(selectedFacility));
      navigate('/');
    } catch (error) {
      message.error(error.response?.data?.message || 'Login failed', 8);
    }
  };

  // Multiple facility UI
  if (facilities.length > 0) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.backgroundDots} />
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ width: '100%', maxWidth: 420, zIndex: 1 }}
        >
          <Card style={styles.card} bodyStyle={{ padding: '40px 32px' }}>
            {/* ✅ Facility selection logo */}
            {logoUrl && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img
                  src={`${SERVER_BASE_URL}${logoUrl}`}
                  alt="logo"
                  style={{ maxHeight: 60 }}
                />
              </div>
            )}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <MedicineBoxOutlined style={{ fontSize: 48, color: '#1a5c3e', marginBottom: 12 }} />
              <Title level={2} style={{ margin: 0, color: '#1a5c3e', fontWeight: 700 }}>Pharma UAM</Title>
              <Text type="secondary">Select Facility</Text>
            </div>
            <Select
              style={{ width: '100%', marginBottom: 24 }}
              placeholder="Select a facility"
              size="large"
              value={selectedFacility?.id}
              onChange={(value) => {
                const fac = facilities.find(f => f.id === value);
                setSelectedFacility(fac);
              }}
            >
              {facilities.map(f => (
                <Option key={f.id} value={f.id}>{f.name} ({f.code})</Option>
              ))}
            </Select>
            <Button
              type="primary"
              block
              size="large"
              onClick={handleFacilitySelect}
              style={styles.button}
            >
              Enter
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Normal login form
  return (
    <div style={styles.wrapper}>
      <div style={styles.backgroundDots} />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        style={{ width: '100%', maxWidth: 420, zIndex: 1 }}
      >
        <Card style={styles.card} bodyStyle={{ padding: '40px 32px' }}>
          <motion.div variants={itemVariants} style={{ textAlign: 'center', marginBottom: 32 }}>
            {/* ✅ Main login logo */}
            {logoUrl && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img
                  src={`${SERVER_BASE_URL}${logoUrl}`}
                  alt="logo"
                  style={{ height: 110 }}
                />
              </div>
            )}
            <MedicineBoxOutlined style={{ fontSize: 48, color: '#1a5c3e', marginBottom: 12 }} />
            <Title level={2} style={{ margin: 0, color: '#1a5c3e', fontWeight: 700 }}>Pharma UAM</Title>
            <Text type="secondary" style={{ fontSize: 14 }}>User Access Management System</Text>
          </motion.div>
          <Form name="login" onFinish={onFinish} size="large">
            <motion.div variants={itemVariants}>
              <Form.Item name="username" rules={[{ required: true, message: 'Please enter your username' }]}>
                <Input prefix={<UserOutlined style={{ color: '#1a5c3e' }} />} placeholder="Username" style={styles.input} />
              </Form.Item>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
                <Input.Password prefix={<LockOutlined style={{ color: '#1a5c3e' }} />} placeholder="Password" style={styles.input} />
              </Form.Item>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Form.Item style={{ textAlign: 'right', marginBottom: 12 }}>
                <Link to="/forgot-password" style={{ color: '#1a5c3e', fontSize: 13 }}>Forgot Password?</Link>
              </Form.Item>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={loading} block style={styles.button}>
                  Sign In
                </Button>
              </Form.Item>
            </motion.div>
          </Form>
        </Card>
      </motion.div>
    </div>
  );
};

const containerVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

const styles = {
  wrapper: {
    display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh',
    background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)',
    position: 'relative', overflow: 'hidden',
  },
  backgroundDots: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    backgroundImage: 'radial-gradient(circle, rgba(26,92,62,0.1) 1px, transparent 1px)',
    backgroundSize: '30px 30px', zIndex: 0,
  },
  card: {
    borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    backdropFilter: 'blur(10px)', background: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.3)',
  },
  input: { borderRadius: 8, padding: '8px 12px', border: '1px solid #d9d9d9', transition: 'all 0.3s ease' },
  button: {
    borderRadius: 8, height: 48, fontSize: 16, fontWeight: 600,
    background: 'linear-gradient(135deg, #1a5c3e 0%, #2e7d32 100%)',
    border: 'none', boxShadow: '0 4px 15px rgba(26,92,62,0.4)', transition: 'all 0.3s ease',
  },
};

export default Login;