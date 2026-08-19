import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, App } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../services/api';

const { Title, Text } = Typography;

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');   // server का असली मैसेज
  const { message } = App.useApp();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await API.post('/auth/forgot-password', { username: values.username });
      setResponseMessage(res.data.message);   // e.g., "AD account – contact IT" या "request submitted"
      setSubmitted(true);
    } catch (error) {
      message.error(error.response?.data?.message || 'Request failed');
    }
    setLoading(false);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  if (submitted) {
    return (
      <div style={styles.wrapper}>
        <motion.div initial="hidden" animate="visible" variants={containerVariants} style={{ maxWidth: 420, width: '100%' }}>
          <Card style={styles.card}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Title level={4} style={{ color: '#1a5c3e' }}>Request Submitted</Title>
              <Text>{responseMessage}</Text>
              <br /><br />
              <Button type="primary" onClick={() => navigate('/login')}>Back to Login</Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <motion.div initial="hidden" animate="visible" variants={containerVariants} style={{ maxWidth: 420, width: '100%' }}>
        <Card style={styles.card} bodyStyle={{ padding: '40px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={3} style={{ color: '#1a5c3e', fontWeight: 700 }}>Forgot Password</Title>
            <Text type="secondary">Enter your username to request a password reset</Text>
          </div>

          <Form onFinish={onFinish} size="large">
            <Form.Item name="username" rules={[{ required: true, message: 'Please enter your username' }]}>
              <Input prefix={<MailOutlined style={{ color: '#1a5c3e' }} />} placeholder="Username" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block style={styles.button}>
                Submit Request
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center' }}>
            <Link to="/login" style={{ color: '#1a5c3e' }}>
              <ArrowLeftOutlined /> Back to Login
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

const styles = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)',
  },
  card: {
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
    background: 'rgba(255,255,255,0.9)',
  },
  button: {
    borderRadius: 8,
    height: 48,
    fontSize: 16,
    fontWeight: 600,
    background: 'linear-gradient(135deg, #1a5c3e 0%, #2e7d32 100%)',
    border: 'none',
    boxShadow: '0 4px 15px rgba(26,92,62,0.4)',
  },
};

export default ForgotPassword;