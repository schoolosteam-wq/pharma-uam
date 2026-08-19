import React, { useState } from 'react';
import { Upload, Button, message, Card } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import API from '../../services/api';

const ComputerCsvUpload = () => {
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);

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
      setFileList([]);
    } catch (error) {
      message.error('Upload failed');
    }
    setUploading(false);
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
    <Card title="Bulk Upload Computers">
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
    </Card>
  );
};

export default ComputerCsvUpload;