import React, { useEffect, useState, useMemo } from 'react';
import { Form, Select, Button, message, Card, Input, Descriptions, Tag, Space, Upload, Alert } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import requestService from '../../services/requestService';
import userService from '../../services/userService';
import applicationService from '../../services/applicationService';
import applicationActivityService from '../../services/applicationActivityService';
import facilityService from '../../services/facilityService';

const { Option } = Select;

const NewRequest = () => {
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [appRoles, setAppRoles] = useState([]);
  const [currentAppRoles, setCurrentAppRoles] = useState([]);
  const [isUserInApp, setIsUserInApp] = useState(false);
  const [appActivities, setAppActivities] = useState([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [fileList, setFileList] = useState([]);

  useEffect(() => {
    fetchProfile();
    fetchApplications();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await userService.getProfile();
      setUserProfile(res.data);
    } catch (error) {
      message.error('Failed to load profile');
    }
  };

  const fetchApplications = async () => {
    try {
      const res = await applicationService.getForRequest();
      setApplications(res.data);
    } catch (error) { /* ignore */ }
  };

  const handleAppChange = async (appId) => {
    setSelectedApp(appId);
    if (!appId) {
      setCurrentAppRoles([]);
      setAppRoles([]);
      setIsUserInApp(false);
      setAppActivities([]);
      form.setFieldsValue({ requestedRole: undefined, type: undefined });
      return;
    }

    try {
      // User's roles in this app
      const profileRes = await userService.getProfile(appId);
      const userAppRoles = profileRes.data.applicationRoles || [];
      setCurrentAppRoles(userAppRoles);
      setIsUserInApp(userAppRoles.length > 0);

      // All roles of this application
      const rolesRes = await applicationService.getRolesGroups(appId);
      setAppRoles(rolesRes.data.roles || []);

      // Mapped activities for this application (excluding FACILITY_ACCESS)
      const activitiesRes = await applicationActivityService.getActivities(appId);
      const activities = (activitiesRes.data || []).filter(a => a !== 'FACILITY_ACCESS');
      setAppActivities(activities);

      form.setFieldsValue({ requestedRole: undefined, type: undefined });
    } catch (error) {
      message.error('Failed to load application data');
    }
  };

  const availableTypes = useMemo(() => {
    if (!selectedApp) return [];
    let types = appActivities;
    if (isUserInApp) {
      types = types.filter(name => name !== 'NEW_USER');
    }
    return types;
  }, [appActivities, isUserInApp, selectedApp]);

  useEffect(() => {
    const currentType = form.getFieldValue('type');
    if (currentType && !availableTypes.includes(currentType)) {
      form.setFieldsValue({ type: undefined });
    }
  }, [availableTypes, form]);

  const onFinish = async (values) => {
    if (values.type === 'NEW_USER' && isUserInApp) {
      message.error('You are already a user of this application.');
      return;
    }
    if (values.type === 'ROLE_CHANGE' && !isUserInApp) {
      message.error('You are not a user of this application.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type: values.type,
        targetUserId: userProfile?.id,
        payload: {
          details: values.details || '',
          applicationId: values.applicationId,
          ...(values.type === 'NEW_USER' || values.type === 'ROLE_CHANGE') && {
            requestedRole: values.requestedRole
          }
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

      message.success('Request submitted successfully');
      navigate('/requests');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to submit request');
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

  const currentType = Form.useWatch('type', form);

  return (
    <Card title="New Request">
      {userProfile && (
        <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Employee ID">{userProfile.employeeId}</Descriptions.Item>
          <Descriptions.Item label="Full Name">{userProfile.fullName}</Descriptions.Item>
          <Descriptions.Item label="Department">{userProfile.department || '-'}</Descriptions.Item>
          <Descriptions.Item label="Designation">{userProfile.designation || '-'}</Descriptions.Item>
          <Descriptions.Item label="Joining Date">{userProfile.joiningDate || '-'}</Descriptions.Item>
          <Descriptions.Item label="Email">{userProfile.email}</Descriptions.Item>
          <Descriptions.Item label="System Roles">
            <Space wrap>
              {userProfile.roles?.length > 0
                ? userProfile.roles.map(r => <Tag key={r.roleName} color="blue">{r.roleName}</Tag>)
                : <Tag>None</Tag>}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      )}

      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ type: undefined }}>
        <Form.Item name="applicationId" label="Application" rules={[{ required: true }]}>
          <Select placeholder="Select application" onChange={handleAppChange} allowClear>
            {applications.map(app => <Option key={app.id} value={app.id}>{app.name}</Option>)}
          </Select>
        </Form.Item>

        <Form.Item name="type" label="Request Type" rules={[{ required: true }]}>
          <Select placeholder="Select request type">
            {availableTypes.map(activity => (
              <Option key={activity} value={activity}>{activity.replace(/_/g, ' ')}</Option>
            ))}
          </Select>
        </Form.Item>

        {selectedApp && (
          <>
            {isUserInApp && currentType === 'NEW_USER' && (
              <Alert message="User already exists" description="New User request not allowed." type="warning" showIcon style={{ marginBottom: 16 }} />
            )}

            {currentType === 'ROLE_CHANGE' && isUserInApp && (
              <>
                <div style={{ marginBottom: 8 }}>
                  <strong>Current Role(s) in this Application:</strong>{' '}
                  <Space wrap>
                    {currentAppRoles.length > 0 ? currentAppRoles.map(r => <Tag key={r} color="green">{r}</Tag>) : <Tag>None</Tag>}
                  </Space>
                </div>
                <Form.Item name="requestedRole" label="Requested Role" rules={[{ required: true }]}>
                  <Select placeholder="Select new role">
                    {appRoles.map(role => (
                      <Option key={role} value={role} disabled={currentAppRoles.includes(role)}>{role}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </>
            )}

            {currentType === 'NEW_USER' && !isUserInApp && (
              <Form.Item name="requestedRole" label="Requested Role" rules={[{ required: true }]}>
                <Select placeholder="Select a role">
                  {appRoles.map(role => <Option key={role} value={role}>{role}</Option>)}
                </Select>
              </Form.Item>
            )}

            {currentType && !['NEW_USER', 'ROLE_CHANGE'].includes(currentType) && (
              <div style={{ marginBottom: 16, color: '#888' }}>No additional information required for this activity.</div>
            )}
          </>
        )}

        <Form.Item name="details" label="Additional Details">
          <Input.TextArea rows={3} placeholder="Any other information" />
        </Form.Item>

        <Form.Item label="Supporting Documents">
          <Upload {...uploadProps} multiple>
            <Button icon={<UploadOutlined />}>Select Files</Button>
          </Upload>
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>Submit Request</Button>
            <Button onClick={() => navigate('/requests')}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default NewRequest;