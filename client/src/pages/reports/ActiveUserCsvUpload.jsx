import React, { useState, useEffect } from 'react';
import { Card, Select, Button, message, Upload, Space } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import applicationService from '../../services/applicationService';
import activeUserService from '../../services/activeUserService';

const { Option } = Select;

const ActiveUserCsvUpload = () => {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const res = await applicationService.getAll();
      setApplications(res.data);
    } catch (error) {
      message.error('Failed to load applications');
    }
  };

  const handleDownloadSample = async () => {
    try {
      const res = await activeUserService.downloadSampleCsv();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sample_active_users.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      message.error('Sample download failed');
    }
  };

  const handleUpload = async () => {
    if (!selectedApp) {
      message.error('Please select an application');
      return;
    }
    if (!file) {
      message.error('Please select a CSV file');
      return;
    }
    setUploading(true);
    try {
      const res = await activeUserService.bulkUpload(selectedApp, file);
      message.success(res.data.message);
      setFile(null);
    } catch (error) {
      message.error(error.response?.data?.message || 'Upload failed');
    }
    setUploading(false);
  };

  const uploadProps = {
    onRemove: () => setFile(null),
    beforeUpload: (f) => {
      setFile(f);
      return false;
    },
    fileList: file ? [file] : [],
    accept: '.csv'
  };

  return (
    <Card title="Bulk Upload Active Users">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Select
            placeholder="Select Application"
            style={{ width: 300 }}
            value={selectedApp}
            onChange={setSelectedApp}
            allowClear
          >
            {applications.map((app) => (
              <Option key={app.id} value={app.id}>{app.name}</Option>
            ))}
          </Select>
        </div>

        <div>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadSample}>
            Sample CSV
          </Button>
        </div>

        <div>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />}>Select CSV File</Button>
          </Upload>
        </div>

        <Button
          type="primary"
          onClick={handleUpload}
          disabled={!selectedApp || !file}
          loading={uploading}
        >
          {uploading ? 'Uploading...' : 'Start Upload'}
        </Button>
      </Space>
    </Card>
  );
};

export default ActiveUserCsvUpload;