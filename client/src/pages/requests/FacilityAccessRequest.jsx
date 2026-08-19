import React, { useEffect, useState } from 'react';
import { Form, Button, Card, Descriptions, Tag, Space, message, Select, Input, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import userService from '../../services/userService';
import facilityService from '../../services/facilityService';
import requestService from '../../services/requestService';

const { Option } = Select;

const FacilityAccessRequest = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [userFacilities, setUserFacilities] = useState([]);   // existing factories
  const [allFacilities, setAllFacilities] = useState([]);     // all factories (flat)
  const [availableFacilities, setAvailableFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [details, setDetails] = useState('');
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. User profile with facilities
      const profileRes = await userService.getProfile();
      const user = profileRes.data;
      setUserProfile(user);
      const userFacs = user.facilities ? user.facilities.filter(f => f.type === 'FACTORY') : [];
      setUserFacilities(userFacs);

      // 2. All factories (बिना किसी फ़िल्टर के)
      const facRes = await facilityService.getAllFactories();   // ✅ new API
      const factories = facRes.data || [];
      setAllFacilities(factories);

      // 3. Available = all factories minus user's existing factories
      const userFacIds = new Set(userFacs.map(f => f.id));
      const available = factories.filter(f => !userFacIds.has(f.id));
      setAvailableFacilities(available);
    } catch (error) {
      message.error('Failed to load data');
    }
  };

  const handleSubmit = async () => {
    if (!selectedFacility) {
      message.warning('Please select a facility');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        type: 'FACILITY_ACCESS',
        targetUserId: userProfile?.id,
        payload: {
          requestedFacilityId: selectedFacility,
          details: details || ''
        }
      };

      const res = await requestService.create(payload);
      const requestId = res.data.id;

      for (const file of fileList) {
        const formData = new FormData();
        formData.append('file', file);
        await requestService.uploadDocument(requestId, formData);
      }

      await requestService.submit(requestId);

      message.success('Facility access request submitted');
      navigate('/requests');
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const uploadProps = {
    beforeUpload: (file) => {
      setFileList(prev => [...prev, file]);
      return false;
    },
    onRemove: (file) => {
      setFileList(prev => prev.filter(f => f.uid !== file.uid));
    },
    fileList,
    accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx',
  };

  return (
    <Card title="Facility Access Request">
      {userProfile && (
        <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Employee ID">{userProfile.employeeId}</Descriptions.Item>
          <Descriptions.Item label="Full Name">{userProfile.fullName}</Descriptions.Item>
          <Descriptions.Item label="Department">{userProfile.department || '-'}</Descriptions.Item>
          <Descriptions.Item label="Designation">{userProfile.designation || '-'}</Descriptions.Item>
          <Descriptions.Item label="Joining Date">{userProfile.joiningDate || '-'}</Descriptions.Item>
          <Descriptions.Item label="Email">{userProfile.email}</Descriptions.Item>
          <Descriptions.Item label="Current Facilities">
            <Space wrap>
              {userFacilities.length > 0
                ? userFacilities.map(f => <Tag key={f.id} color="blue">{f.name}</Tag>)
                : <Tag>None</Tag>}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      )}

      <Form layout="vertical">
        <Form.Item label="Select Facility" required>
          <Select
            placeholder="Select facility you need access to"
            style={{ width: '100%' }}
            value={selectedFacility}
            onChange={setSelectedFacility}
          >
            {availableFacilities.map(f => (
              <Option key={f.id} value={f.id}>{f.name} ({f.code})</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="Additional Details">
          <Input.TextArea rows={3} value={details} onChange={e => setDetails(e.target.value)} placeholder="Reason for access" />
        </Form.Item>

        <Form.Item label="Supporting Documents">
          <Upload {...uploadProps} multiple>
            <Button icon={<UploadOutlined />}>Select Files</Button>
          </Upload>
        </Form.Item>

        <Space>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            Submit Request
          </Button>
          <Button onClick={() => navigate('/requests')}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
};

export default FacilityAccessRequest;