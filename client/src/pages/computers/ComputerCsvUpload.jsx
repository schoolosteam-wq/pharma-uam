import React, { useState } from 'react';
import { Upload, Button, message, Card, Space, Alert, Tag } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import API from '../../services/api';

const ComputerCsvUpload = () => {
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.error('Please select a CSV file');
      return;
    }
    const formData = new FormData();
    formData.append('file', fileList[0]);
    setUploading(true);
    try {
      const res = await API.post('/csv/computers', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(res.data.message);
      setUploadResult(res.data);
      setFileList([]);
    } catch (error) {
      message.error('Upload failed');
    }
    setUploading(false);
  };

  const handleDownloadLogs = async () => {
    if (!uploadResult || !uploadResult.logId) return;
    try {
      const res = await API.get(`/bulk-upload-logs/${uploadResult.logId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bulk_upload_logs_${uploadResult.logId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      message.error('Log download failed');
    }
  };

  const props = {
    onRemove: () => setFileList([]),
    beforeUpload: (file) => {
      setFileList([file]);
      return false;
    },
    fileList,
    accept: '.csv'
  };

  return (
    <Card title="Bulk Upload Applications">
      <Upload {...props}>
        <Button icon={<UploadOutlined />}>Select CSV File</Button>
      </Upload>
      <Button
        type="primary"
        onClick={handleUpload}
        disabled={fileList.length === 0}
        loading={uploading}
        style={{ marginTop: 16 }}
      >
        {uploading ? 'Uploading' : 'Start Upload'}
      </Button>

      {uploadResult && (
        <Alert
          style={{ marginTop: 16 }}
          type={uploadResult.errors > 0 || uploadResult.skipped > 0 ? 'warning' : 'success'}
          message={`Created: ${uploadResult.created}, Skipped: ${uploadResult.skipped}, Errors: ${uploadResult.errors}`}
          showIcon
        />
      )}

      {uploadResult && (uploadResult.skipped > 0 || uploadResult.errors > 0) && (
        <Button
          icon={<DownloadOutlined />}
          style={{ marginTop: 8 }}
          onClick={handleDownloadLogs}
        >
          Download Logs
        </Button>
      )}
    </Card>
  );
};

export default ComputerCsvUpload;