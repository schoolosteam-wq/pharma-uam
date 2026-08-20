import React, { useEffect, useState } from 'react';
import { Card, Select, Button, Table, Space, message, Typography, Tag } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import API from '../../services/api';
import facilityService from '../../services/facilityService';
import reportService from '../../services/reportService';

const { Option } = Select;
const { Text } = Typography;

const REPORT_TYPE_OPTIONS = [
  { key: 'application', label: 'Application Report' },
  { key: 'instrument', label: 'Instrument Report' },
  { key: 'computer', label: 'Computer Report' },
];

const STATUS_OPTIONS = {
  application: [
    { key: 'All', label: 'All' },
    { key: 'ACTIVE', label: 'ACTIVE' },
    { key: 'RETIRED', label: 'RETIRED' },
  ],
  instrument: [
    { key: 'All', label: 'All' },
    { key: 'ACTIVE', label: 'ACTIVE' },
    { key: 'RETIRED', label: 'RETIRED' },
    { key: 'TRANSFERRED', label: 'TRANSFERRED' },
  ],
  computer: [
    { key: 'All', label: 'All' },
    { key: 'ACTIVE', label: 'ACTIVE' },
    { key: 'INACTIVE', label: 'INACTIVE' },
  ],
};

const ReportsCenter = () => {
  const [reportType, setReportType] = useState('application');
  const [applications, setApplications] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchApplications();
    fetchFacilities();
  }, []);

  const fetchApplications = async () => {
    try {
      const res = await API.get('/applications');
      setApplications(res.data);
    } catch (error) {
      message.error('Failed to load applications');
    }
  };

  const fetchFacilities = async () => {
    try {
      const res = await facilityService.getAllFactories();
      setFacilities(res.data);
    } catch (error) {
      message.error('Failed to load facilities');
    }
  };

  // Report type change par filters reset
  const handleReportTypeChange = (value) => {
    setReportType(value);
    setSelectedApplication(null);
    setSelectedFacility(null);
    setSelectedStatus('All');
    setData([]);
  };

  const handleFetchReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (selectedFacility) params.facilityId = selectedFacility;
      if (selectedApplication) params.applicationId = selectedApplication;

      let endpoint = '';
      if (reportType === 'application') endpoint = '/applications';
      else if (reportType === 'instrument') endpoint = '/instruments';
      else if (reportType === 'computer') endpoint = '/computers';

      const res = await API.get(endpoint, { params });
      setData(res.data);
    } catch (error) {
      message.error('Failed to fetch report data');
    }
    setLoading(false);
  };

  const handleDownloadPDF = async () => {
    try {
      const params = {};
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (selectedFacility) params.facilityId = selectedFacility;
      if (selectedApplication) params.applicationId = selectedApplication;

      let response;
      if (reportType === 'application') {
        response = await reportService.downloadApplicationPDF(params);
      } else if (reportType === 'instrument') {
        response = await reportService.downloadInstrumentPDF(params);
      } else if (reportType === 'computer') {
        response = await reportService.downloadComputerPDF(params);
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      message.error('PDF download failed');
    }
  };

  // Table columns definition per report type
  const getColumns = () => {
    if (reportType === 'application') {
      return [
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Manufacturer', dataIndex: 'manufacturer', key: 'manufacturer' },
        { title: 'Version', dataIndex: 'versionNo', key: 'versionNo' },
        { title: 'Status', dataIndex: 'status', key: 'status', render: (text) => <Tag>{text}</Tag> },
        { title: 'Department', key: 'department', render: (_, record) => record.department?.name || '-' },
        { title: 'Facility', key: 'facility', render: (_, record) => record.facility?.name || '-' },
        { title: 'Owner', dataIndex: 'applicationOwner', key: 'applicationOwner' },
        { title: 'GAMP', dataIndex: 'gampCategory', key: 'gampCategory' },
        { title: 'Criticality', dataIndex: 'applicationCriticality', key: 'applicationCriticality' },
      ];
    } else if (reportType === 'instrument') {
      return [
        { title: 'Instrument ID', dataIndex: 'instrumentId', key: 'instrumentId' },
        { title: 'Type', dataIndex: 'instrumentType', key: 'instrumentType' },
        { title: 'Make', dataIndex: 'make', key: 'make' },
        { title: 'Model', dataIndex: 'model', key: 'model' },
        { title: 'Serial Number', dataIndex: 'serialNumber', key: 'serialNumber' },
        { title: 'Status', dataIndex: 'status', key: 'status', render: (text) => <Tag>{text}</Tag> },
        { title: 'Application', key: 'application', render: (_, record) => record.application?.name || '-' },
        { title: 'Department', key: 'department', render: (_, record) => record.department?.name || '-' },
        { title: 'Facility', key: 'facility', render: (_, record) => record.facility?.name || '-' },
      ];
    } else if (reportType === 'computer') {
      return [
        { title: 'Hostname', dataIndex: 'hostname', key: 'hostname' },
        { title: 'Make & Model', dataIndex: 'computerMakeModel', key: 'computerMakeModel' },
        { title: 'Serial Number', dataIndex: 'serialNumber', key: 'serialNumber' },
        { title: 'IP Address', dataIndex: 'ipAddress', key: 'ipAddress' },
        { title: 'Status', dataIndex: 'status', key: 'status', render: (text) => <Tag>{text}</Tag> },
        { title: 'Department', key: 'department', render: (_, record) => record.department?.name || '-' },
        { title: 'Facility', key: 'facility', render: (_, record) => record.facility?.name || '-' },
        { title: 'OS Version', dataIndex: 'osVersion', key: 'osVersion' },
        { title: 'Antivirus', dataIndex: 'antivirusStatus', key: 'antivirusStatus' },
      ];
    }
    return [];
  };

  return (
    <Card title="Reports Center">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <Text strong>Select Report Type</Text>
            <div style={{ marginTop: 4 }}>
              <Select
                style={{ width: 250 }}
                value={reportType}
                onChange={handleReportTypeChange}
              >
                {REPORT_TYPE_OPTIONS.map(opt => (
                  <Option key={opt.key} value={opt.key}>{opt.label}</Option>
                ))}
              </Select>
            </div>
          </div>

          {reportType === 'instrument' && (
            <div>
              <Text strong>Select Application</Text>
              <div style={{ marginTop: 4 }}>
                <Select
                  placeholder="Select application"
                  style={{ width: 250 }}
                  value={selectedApplication}
                  onChange={setSelectedApplication}
                  allowClear
                >
                  {applications.map(app => (
                    <Option key={app.id} value={app.id}>{app.name}</Option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {reportType !== 'instrument' && (
            <div>
              <Text strong>Select Facility</Text>
              <div style={{ marginTop: 4 }}>
                <Select
                  placeholder="Select facility"
                  style={{ width: 250 }}
                  value={selectedFacility}
                  onChange={setSelectedFacility}
                  allowClear
                >
                  {facilities.map(f => (
                    <Option key={f.id} value={f.id}>{f.name} ({f.code})</Option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          <div>
            <Text strong>Select Status</Text>
            <div style={{ marginTop: 4 }}>
              <Select
                style={{ width: 200 }}
                value={selectedStatus}
                onChange={setSelectedStatus}
              >
                {STATUS_OPTIONS[reportType].map(status => (
                  <Option key={status.key} value={status.key}>{status.label}</Option>
                ))}
              </Select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Space>
              <Button type="primary" onClick={handleFetchReport}>
                See Report
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadPDF}>
                Download PDF
              </Button>
            </Space>
          </div>
        </div>

        <Table
          dataSource={data}
          columns={getColumns()}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
        />
      </Space>
    </Card>
  );
};

export default ReportsCenter;