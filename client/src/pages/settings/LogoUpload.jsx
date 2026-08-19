import React, { useState } from 'react';
import { Card, Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import settingsService from '../../services/settingsService';

const LogoUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) { message.error('Please select a logo file'); return; }
    const formData = new FormData();
    formData.append('logo', file);
    setUploading(true);
    try {
      await settingsService.uploadLogo(formData);
      message.success('Logo uploaded successfully');
      setFile(null);
    } catch (error) {
      message.error('Upload failed');
    }
    setUploading(false);
  };

  return (
    <Card title="Company Logo" style={{ maxWidth: 400, margin: '0 auto' }}>
      <Upload
        accept=".png,.jpg,.jpeg"
        showUploadList={false}
        beforeUpload={(f) => { setFile(f); return false; }}
        fileList={file ? [file] : []}
        onRemove={() => setFile(null)}
      >
        <Button icon={<UploadOutlined />}>Select Logo</Button>
      </Upload>
      <Button type="primary" onClick={handleUpload} loading={uploading} disabled={!file} style={{ marginTop: 16 }}>
        Upload
      </Button>
    </Card>
  );
};

export default LogoUpload;