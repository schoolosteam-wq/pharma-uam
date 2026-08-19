import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Table, Button, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import applicationService from '../../services/applicationService';

const ApplicationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApp();
  }, [id]);

  const fetchApp = async () => {
    try {
      const res = await applicationService.getOne(id);
      setApp(res.data);
    } catch (error) {
      // handle error silently, or show a message
    }
    setLoading(false);
  };

  if (loading) return <Card loading>Loading...</Card>;
  if (!app) return <Card>Application not found</Card>;

  // Columns for instruments
  const instrumentColumns = [
    { title: 'Make', dataIndex: 'make' },
    { title: 'Model', dataIndex: 'model' },
    { title: 'Serial Number', dataIndex: 'serialNumber' },
    { title: 'Status', dataIndex: 'status', render: (text) => <Tag>{text}</Tag> },
  ];

  // Columns for computers
  const computerColumns = [
    { title: 'Make & Model', dataIndex: 'computerMakeModel' },
    { title: 'Serial Number', dataIndex: 'serialNumber' },
  ];

  return (
    <Card
      title={`${app.name} – Details`}
      extra={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/applications')}>
          Back to List
        </Button>
      }
    >
      {/* Application Details with Roles */}
      <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Manufacturer">{app.manufacturer || '-'}</Descriptions.Item>
        <Descriptions.Item label="Version">{app.versionNo || '-'}</Descriptions.Item>
        <Descriptions.Item label="OEM Contact">{app.oemContact || '-'}</Descriptions.Item>
        <Descriptions.Item label="Status">{app.status}</Descriptions.Item>

        {/* Application‑Specific Roles */}
        <Descriptions.Item label="Application Roles">
          {app.applicationRoles && app.applicationRoles.length > 0
            ? app.applicationRoles.map(role => (
                <Tag key={role.id} color="blue">{role.roleName}</Tag>
              ))
            : '-'}
        </Descriptions.Item>

        {/* ✅ Admin Groups (new) */}
        <Descriptions.Item label="Admin Groups">
          {app.adminGroups?.length
            ? app.adminGroups.map(g => <Tag key={g.id}>{g.groupName}</Tag>)
            : '-'}
        </Descriptions.Item>
      </Descriptions>

      <h4>Connected Instruments ({app.instruments?.length || 0})</h4>
      <Table
        dataSource={app.instruments || []}
        columns={instrumentColumns}
        rowKey="id"
        pagination={false}
        style={{ marginBottom: 24 }}
      />

      <h4>Connected Computers ({app.computers?.length || 0})</h4>
      <Table
        dataSource={app.computers || []}
        columns={computerColumns}
        rowKey="id"
        pagination={false}
      />
    </Card>
  );
};

export default ApplicationDetail;