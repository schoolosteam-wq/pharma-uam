import React, { useEffect, useState } from 'react';
import { Table, Card, Select, DatePicker, Button, Space, message, Tag } from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import API from '../../services/api';
import reportService from '../../services/reportService';

const { Option } = Select;
const { RangePicker } = DatePicker;

const fieldMap = {
  USER: [
    "Username", "Full Name", "Email", "Department", "Designation",
    "Employee ID", "Joining Date", "Date Of Birth", "Status",
    "System Roles", "System Groups", "Facilities", "Facility"
  ],
  FACILITY: ["Code", "Name", "Type", "Status", "Parent"],
  APPLICATION: [
    "Application Name", "Manufacturer", "Version", "OEM Contact",
    "Status", "Facility", "Roles", "Groups", "Admin Groups"
  ],
  APPLICATION_ADMIN_GROUP: ["Admin Groups"],
  INSTRUMENT: [
    "Make", "Model", "Serial Number", "Status", "Application",
    "Facility", "Connected Computers"
  ],
  COMPUTER: [
    "Make & Model", "Serial Number", "IP Address", "Status",
    "Facility", "Connected Instruments", "Connected Applications"
  ],
  REQUEST: ["Request No", "Type", "Requester", "Target", "Payload"],
  ROLE: ["Role Name", "Description", "Permissions"],
  GROUP: ["Group Name", "Description", "Members", "Added", "Removed", "Added By", "Removed By"],
  WORKFLOW_DEF: ["Module Type", "Added Steps", "Added By", "Removed Steps", "Removed By"],
};

const AuditTrailViewer = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    entityType: null,
    action: null,
    dateRange: null,
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.action) params.action = filters.action;
      if (filters.dateRange) {
        params.startDate = filters.dateRange[0].toISOString();
        params.endDate = filters.dateRange[1].toISOString();
      }
      const res = await API.get('/audit', { params });
      setAuditLogs(res.data);
    } catch (error) {
      message.error('Failed to fetch audit trail');
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const handleSearch = () => fetchLogs();

  const handleDownloadPDF = async () => {
    try {
      const params = {};
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.action) params.action = filters.action;
      if (filters.dateRange) {
        params.startDate = filters.dateRange[0].toISOString();
        params.endDate = filters.dateRange[1].toISOString();
      }
      const res = await reportService.downloadAuditPDF(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'audit_trail.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      message.error('PDF download failed');
    }
  };

  const renderDetails = (record) => {
    const oldVal = record.oldValue || {};
    const newVal = record.newValue || {};

    if (!record.oldValue && !record.newValue) return '-';

    let keys = fieldMap[record.entityType];
    if (!keys) {
      const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
      keys = [...allKeys].filter(k => oldVal[k] || newVal[k]);
    }

    const formatValue = (value) => {
      if (value === undefined || value === null) return '';
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value, null, 2);
        } catch {
          return String(value);
        }
      }
      return String(value);
    };

    const rows = [];
    for (const key of keys) {
      const oldDisplay = formatValue(oldVal[key]);
      const newDisplay = formatValue(newVal[key]);

      if (!oldDisplay && !newDisplay) continue;

      if (record.action === 'CREATED') {
        rows.push(<div key={key}><strong>{key}:</strong> {newDisplay || '—'}</div>);
      } else if (record.action === 'DELETED') {
        rows.push(<div key={key}><strong>{key}:</strong> {oldDisplay || '—'}</div>);
      } else {
        if (oldDisplay === newDisplay) {
          if (newDisplay) {
            rows.push(<div key={key}><strong>{key}:</strong> {newDisplay}</div>);
          }
        } else {
          rows.push(
            <div key={key}>
              <strong>{key}:</strong> {oldDisplay || '—'} → {newDisplay || '—'}
            </div>
          );
        }
      }
    }

    return rows.length > 0 ? rows : '-';
  };

  const columns = [
    { title: 'Date/Time', dataIndex: 'changedAt', render: (text) => new Date(text).toLocaleString(), width: 180 },
    { title: 'Entity Type', dataIndex: 'entityType', width: 140 },
    { title: 'Action', dataIndex: 'action', width: 130, render: (text) => <Tag>{text}</Tag> },
    { title: 'Performed By', dataIndex: 'changedByUser', render: (user) => user?.username || 'System', width: 130 },
    { title: 'IP Address', dataIndex: 'ipAddress', width: 140 },
    { title: 'Details', key: 'details', render: (_, rec) => renderDetails(rec) },
    { title: 'Comments', dataIndex: 'comments', width: 200 },
  ];

  return (
    <Card title="Audit Trail">
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="Entity Type" allowClear style={{ width: 150 }}
          value={filters.entityType}
          onChange={(val) => setFilters({ ...filters, entityType: val })}
        >
          <Option value="USER">User</Option>
          <Option value="FACILITY">Facility</Option>
          <Option value="APPLICATION">Application</Option>
          <Option value="APPLICATION_ADMIN_GROUP">Application Admin Group</Option>
          <Option value="INSTRUMENT">Instrument</Option>
          <Option value="COMPUTER">Computer</Option>
          <Option value="REQUEST">Request</Option>
          <Option value="ROLE">Role</Option>
          <Option value="GROUP">Group</Option>
          <Option value="WORKFLOW_DEF">Workflow Def</Option>
        </Select>
        <Select
          placeholder="Action" allowClear style={{ width: 150 }}
          value={filters.action}
          onChange={(val) => setFilters({ ...filters, action: val })}
        >
          <Option value="CREATED">Created</Option>
          <Option value="UPDATED">Updated</Option>
          <Option value="DELETED">Deleted</Option>
          <Option value="LOGIN">Login</Option>
          <Option value="LOGOUT">Logout</Option>
          <Option value="LOGIN_FAILED">Login Failed</Option>
          <Option value="SUBMITTED">Submitted</Option>
          <Option value="APPROVED">Approved</Option>
          <Option value="REJECTED">Rejected</Option>
          <Option value="RETURNED">Returned</Option>
        </Select>
        <RangePicker onChange={(dates) => setFilters({ ...filters, dateRange: dates })} />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>Search</Button>
        <Button icon={<DownloadOutlined />} onClick={handleDownloadPDF}>Download PDF</Button>
      </Space>
      <Table
        dataSource={auditLogs}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1200 }}
      />
    </Card>
  );
};

export default AuditTrailViewer;