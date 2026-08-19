import React, { useEffect, useState } from 'react';
import { Card, Table, Button, message, Spin, Row, Col, Statistic, Typography } from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
  AuditOutlined,
  ExceptionOutlined,
} from '@ant-design/icons';
import dashboardService from '../../services/dashboardService';
import { CSVLink } from 'react-csv';

const { Title, Text } = Typography;

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalRequests: [],
    pendingRequests: [],
    closedRequests: [],
    ownRequests: [],
    pendingAt: [],
    forApproval: [],
    completed: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await dashboardService.getStats();
      const data = res.data || {};

      const keys = ['totalRequests', 'pendingRequests', 'closedRequests', 'ownRequests', 'pendingAt', 'forApproval', 'completed'];
      const safeData = {};
      keys.forEach((key) => {
        safeData[key] = Array.isArray(data[key]) ? data[key] : [];
      });

      setStats(safeData);
    } catch (error) {
      message.error('Failed to load dashboard data');
    }
    setLoading(false);
  };

  const getCount = (data) => data?.length || 0;

  const columns = [
    { title: 'Request No', dataIndex: 'requestNo', key: 'requestNo', render: (text) => <Text strong>{text || '-'}</Text> },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (t) => t?.replace(/_/g, ' ') || '-' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => {
        if (!status) return '-';
        const color = status === 'COMPLETED' || status === 'APPROVED' ? 'green'
          : status === 'PENDING' || status === 'SUBMITTED' ? 'orange' : 'red';
        return <Text style={{ color, fontWeight: 500 }}>{status}</Text>;
      },
    },
    { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', render: (d) => (d ? new Date(d).toLocaleDateString() : '-') },
  ];

  const renderTable = (title, data, csvFilename, icon = null) => {
    if (!data || data.length === 0) {
      return (
        <Card title={<span>{icon} {title} <Text type="secondary" style={{ fontSize: 12 }}>(0)</Text></span>}
          style={{ marginBottom: 16, height: '100%' }}>
          <div style={{ textAlign: 'center', padding: 30, color: '#bbb' }}>No data available</div>
        </Card>
      );
    }
    return (
      <Card
        title={<span>{icon} {title} <Text type="secondary" style={{ fontSize: 12 }}>({data.length})</Text></span>}
        extra={<CSVLink data={data} filename={csvFilename}><Button icon={<DownloadOutlined />} size="small">Export</Button></CSVLink>}
        style={{ marginBottom: 16, height: '100%' }}>
        <Table dataSource={data} columns={columns} rowKey="id" pagination={{ pageSize: 5, size: 'small' }} size="small" scroll={{ x: 400 }} />
      </Card>
    );
  };

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100, textAlign: 'center' }} />;

  return (
    <div style={{ padding: '0 8px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
        <Text type="secondary">Last updated: {new Date().toLocaleString()}</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* कार्ड्स – सिर्फ वही दिखेंगे जिनका डेटा मौजूद है */}
        {stats.totalRequests && (
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card style={{ textAlign: 'center', background: '#f0f5ff', borderColor: '#1890ff' }}>
              <Statistic title="Total Requests" value={getCount(stats.totalRequests)} prefix={<FileTextOutlined style={{ color: '#1890ff' }} />} />
            </Card>
          </Col>
        )}
        {stats.pendingRequests && (
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card style={{ textAlign: 'center', background: '#fff7e6', borderColor: '#fa8c16' }}>
              <Statistic title="Pending" value={getCount(stats.pendingRequests)} prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />} />
            </Card>
          </Col>
        )}
        {(stats.closedRequests || stats.completed) && (
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card style={{ textAlign: 'center', background: '#f6ffed', borderColor: '#52c41a' }}>
              <Statistic title="Completed" value={getCount(stats.closedRequests || stats.completed)} prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
            </Card>
          </Col>
        )}
        {stats.ownRequests && (
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card style={{ textAlign: 'center', background: '#fff1f0', borderColor: '#ff4d4f' }}>
              <Statistic title="My Requests" value={getCount(stats.ownRequests)} prefix={<UserOutlined style={{ color: '#ff4d4f' }} />} />
            </Card>
          </Col>
        )}
        {stats.forApproval && (
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card style={{ textAlign: 'center', background: '#e6f7ff', borderColor: '#13c2c2' }}>
              <Statistic title="For Approval" value={getCount(stats.forApproval)} prefix={<AuditOutlined style={{ color: '#13c2c2' }} />} />
            </Card>
          </Col>
        )}
        {stats.pendingAt && (
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card style={{ textAlign: 'center', background: '#f9f0ff', borderColor: '#722ed1' }}>
              <Statistic title="Pending At" value={getCount(stats.pendingAt)} prefix={<ExceptionOutlined style={{ color: '#722ed1' }} />} />
            </Card>
          </Col>
        )}
      </Row>

      <Row gutter={[16, 16]}>
        {stats.totalRequests && <Col xs={24} lg={12}>{renderTable('Total Requests', stats.totalRequests, 'total_requests.csv', <FileTextOutlined />)}</Col>}
        {stats.pendingRequests && <Col xs={24} lg={12}>{renderTable('Pending Requests', stats.pendingRequests, 'pending_requests.csv', <ClockCircleOutlined />)}</Col>}
        {(stats.closedRequests || stats.completed) && (
          <Col xs={24} lg={12}>{renderTable('Completed', stats.closedRequests || stats.completed, 'completed.csv', <CheckCircleOutlined />)}</Col>
        )}
        {stats.ownRequests && <Col xs={24} lg={12}>{renderTable('My Requests', stats.ownRequests, 'my_requests.csv', <UserOutlined />)}</Col>}
        {stats.pendingAt && <Col xs={24} lg={12}>{renderTable('Pending At (My Requests)', stats.pendingAt, 'pending_at.csv', <ExceptionOutlined />)}</Col>}
        {stats.forApproval && <Col xs={24} lg={12}>{renderTable('Requests for Approval', stats.forApproval, 'for_approval.csv', <AuditOutlined />)}</Col>}
      </Row>
    </div>
  );
};

export default Dashboard;