import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, message } from 'antd';
import { PlusOutlined, EyeOutlined, BankOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import requestService from '../../services/requestService';

const statusColors = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  IN_PROGRESS: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  RETURNED: 'warning',
  COMPLETED: 'success'
};

const RequestList = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await requestService.getAll();
      setRequests(res.data);
    } catch { message.error('Failed to fetch requests'); }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const columns = [
    { title: 'Request No', dataIndex: 'requestNo', key: 'requestNo' },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (t) => t.replace(/_/g, ' ') },
    { title: 'Requester', key: 'requester', render: (_, r) => r.requester?.fullName || r.requester?.username },
    { title: 'Target User', key: 'target', render: (_, r) => r.targetUser?.fullName || '-' },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={statusColors[s]}>{s}</Tag> },
    { title: 'Version', dataIndex: 'version' },
    {
      title: 'Actions',
      render: (_, record) => (
        <Button icon={<EyeOutlined />} size="small" onClick={() => navigate(`/requests/${record.id}`)}>View</Button>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Requests</h2>
        <Space>
          <Button icon={<BankOutlined />} onClick={() => navigate('/requests/facility-access')}>
            Facility Access Request
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/requests/new')}>
            New Request
          </Button>
        </Space>
      </div>
      <Table dataSource={requests} columns={columns} rowKey="id" loading={loading} />
    </div>
  );
};

export default RequestList;