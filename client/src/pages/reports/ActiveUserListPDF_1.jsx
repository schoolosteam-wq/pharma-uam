import React, { useEffect, useState } from 'react';
import { Card, Table, Select, message, Tag } from 'antd';
import applicationService from '../../services/applicationService';
import activeUserService from '../../services/activeUserService';   // हम नीचे बनाएँगे

const { Option } = Select;

const ActiveUserList = () => {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const res = await applicationService.getAll();
      setApplications(res.data);
    } catch (error) { /* ignore */ }
  };

  const fetchActiveUsers = async (appId) => {
    if (!appId) {
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const res = await activeUserService.getByApplication(appId);
      setUsers(res.data);
    } catch (error) {
      message.error('Failed to load active users');
    }
    setLoading(false);
  };

  const handleAppChange = (appId) => {
    setSelectedApp(appId);
    fetchActiveUsers(appId);
  };

  const columns = [
    { title: 'User Name', dataIndex: 'fullName' },
    { title: 'Username', dataIndex: 'username' },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status) => <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>,
    },
    { title: 'Assigned Date', dataIndex: 'createdAt', render: (d) => d ? new Date(d).toLocaleDateString() : '—' },
  ];

  return (
    <Card title="Active User List">
      <div style={{ marginBottom: 16 }}>
        <Select
          placeholder="Select application"
          style={{ width: 300 }}
          onChange={handleAppChange}
          allowClear
        >
          {applications.map(app => (
            <Option key={app.id} value={app.id}>{app.name}</Option>
          ))}
        </Select>
      </div>
      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
};

export default ActiveUserList;