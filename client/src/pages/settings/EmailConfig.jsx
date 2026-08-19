import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Switch, Card, message, Spin, InputNumber, Space, Modal } from 'antd';
import settingsService from '../../services/settingsService';

const EmailConfig = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmailModalVisible, setTestEmailModalVisible] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await settingsService.getEmailConfig();
      form.setFieldsValue(res.data);
    } catch (error) {
      message.error('Failed to load email configuration');
    }
    setLoading(false);
  };

  const handleSave = async (values) => {
    // Ensure boolean smtp_enabled is sent as string "true" / "false"
    const payload = {
      ...values,
      smtp_enabled: values.smtp_enabled ? "true" : "false",
      smtp_port: values.smtp_port ? String(values.smtp_port) : "587",
    };
    setSaving(true);
    try {
      await settingsService.saveEmailConfig(payload);
      message.success('Email configuration saved');
    } catch (error) {
      message.error('Failed to save email configuration');
    }
    setSaving(false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await settingsService.testEmailConnection();
      if (res.data.success) {
        message.success(res.data.message);
      } else {
        message.error(res.data.message);
      }
    } catch (error) {
      message.error('Connection test failed');
    }
    setTesting(false);
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) {
      message.warning('Please enter a test email address');
      return;
    }
    setSendingTest(true);
    try {
      await settingsService.sendTestEmail(testEmailAddress);
      message.success('Test email sent');
      setTestEmailModalVisible(false);
      setTestEmailAddress('');
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to send test email');
    }
    setSendingTest(false);
  };

  return (
    <Card title="Email Configuration" style={{ maxWidth: 600, margin: '0 auto' }}>
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="smtp_enabled" label="Enable Email Notifications" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="smtp_host" label="SMTP Host (e.g. smtp.gmail.com)">
            <Input />
          </Form.Item>
          <Form.Item name="smtp_port" label="SMTP Port">
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="smtp_user" label="SMTP Username">
            <Input />
          </Form.Item>
          <Form.Item name="smtp_pass" label="SMTP Password">
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
          <Form.Item name="smtp_from" label="From Address">
            <Input />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>Save Configuration</Button>
              <Button onClick={handleTestConnection} loading={testing}>Test Connection</Button>
              <Button onClick={() => setTestEmailModalVisible(true)}>Send Test Email</Button>
            </Space>
          </Form.Item>
        </Form>
      </Spin>

      {/* Test Email Modal */}
      <Modal
        title="Send Test Email"
        open={testEmailModalVisible}
        onOk={handleSendTestEmail}
        onCancel={() => { setTestEmailModalVisible(false); setTestEmailAddress(''); }}
        confirmLoading={sendingTest}
      >
        <Input
          placeholder="Enter recipient email address"
          value={testEmailAddress}
          onChange={e => setTestEmailAddress(e.target.value)}
        />
      </Modal>
    </Card>
  );
};

export default EmailConfig;