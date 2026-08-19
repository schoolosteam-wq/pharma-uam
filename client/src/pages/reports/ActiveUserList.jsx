import React, { useEffect, useState } from 'react';
import { Card, Table, Select, Button, message, Tag, Space } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import applicationService from '../../services/applicationService';
import activeUserService from '../../services/activeUserService';
import reportService from '../../services/reportService';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

const ActiveUserList = () => {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');   // 'All', 'Active', 'Inactive'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const { permissions } = useAuth();
  const navigate = useNavigate();
  const hasBulkUploadPermission = permissions.includes('MANAGE_ACTIVE_USER_BULK_UPLOAD');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const res = await applicationService.getAll();
      setApplications(res.data);
    } catch (error) { /* ignore */ }
  };

  const fetchActiveUsers = async () => {
    if (!selectedApp) {
      message.warning('Please select an application');
      return;
    }
    setLoading(true);
    try {
      const res = await activeUserService.getByApplication(selectedApp, statusFilter);
      setUsers(res.data);
    } catch (error) {
      message.error('Failed to load active users');
    }
    setLoading(false);
  };

  // Application change – केवल state update, कोई fetch नहीं
  const handleAppChange = (appId) => {
    setSelectedApp(appId);
    setUsers([]);   // पुराना data clear कर दें
  };

  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setUsers([]);   // status बदलने पर पुराना data clear
  };

  const handleSeeUserList = () => {
    fetchActiveUsers();
  };

  const handleDownloadPDF = async () => {
    if (!selectedApp) {
      message.warning('Please select an application');
      return;
    }
    try {
      const res = await reportService.downloadActiveUsersPDF(selectedApp, statusFilter);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `active_users_${selectedApp}_${statusFilter}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      message.error('PDF download failed');
    }
  };

  const columns = [
    { title: 'Sr. No.', dataIndex: 'srNo', width: 70 },
    { title: 'User Name', dataIndex: 'fullName' },
    { title: 'Emp Code', dataIndex: 'employeeId' },
    { title: 'User ID (Application)', dataIndex: 'username' },
    { title: 'Roles / Groups', dataIndex: 'roles' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status) => <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>,
    },
  ];

  return (
    <Card title="Active Users">
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="Select application"
          style={{ width: 250 }}
          onChange={handleAppChange}
          value={selectedApp}
          allowClear
        >
          {applications.map(app => (
            <Option key={app.id} value={app.id}>{app.name}</Option>
          ))}
        </Select>

        <Select
          value={statusFilter}
          onChange={handleStatusChange}
          style={{ width: 130 }}
        >
          <Option value="All">All</Option>
          <Option value="Active">Active</Option>
          <Option value="Inactive">Inactive</Option>
        </Select>

        <Button
          type="primary"
          onClick={handleSeeUserList}
          disabled={!selectedApp}
        >
          See User List
        </Button>

        <Button
          type="primary"
          icon={<DownloadOutlined />}
          disabled={!selectedApp || users.length === 0}
          onClick={handleDownloadPDF}
        >
          Download PDF
        </Button>
      </Space>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="key"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
};

export default ActiveUserList;