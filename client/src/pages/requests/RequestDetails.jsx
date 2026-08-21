// RequestDetails.jsx – with complete details, application name, comments, documents, version history
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Button, Space, message, Upload, List, Timeline, Modal, Form, Input, Tag, Divider, Row, Col, Typography } from 'antd';
import { UploadOutlined, CheckOutlined, RollbackOutlined, StopOutlined, SendOutlined, KeyOutlined, EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import requestService from '../../services/requestService';
import { useAuth } from '../../context/AuthContext';

const { Text } = Typography;

const RequestDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, permissions } = useAuth();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [commentModal, setCommentModal] = useState({ visible: false, action: '' });
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [credentialsModalVisible, setCredentialsModalVisible] = useState(false);
  const [completeForm] = Form.useForm();
  const [completeFacilityModalVisible, setCompleteFacilityModalVisible] = useState(false);
  const [facilityAccessForm] = Form.useForm();

  const fetchRequest = async () => {
    setLoading(true);
    try {
      const res = await requestService.getOne(id);
      setRequest(res.data);
    } catch { message.error('Failed to load request'); }
    setLoading(false);
  };

  useEffect(() => { fetchRequest(); }, [id]);

  const handleAction = async (action, comments = '') => {
    try {
      switch (action) {
        case 'submit': await requestService.submit(id); break;
        case 'approve': await requestService.approve(id, comments); break;
        case 'return': await requestService.returnReq(id, comments); break;
        case 'reject': await requestService.rejectReq(id, comments); break;
      }
      message.success(`${action} successful`);
      fetchRequest();
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Action failed');
    }
    setCommentModal({ visible: false, action: '' });
  };

  const handleResubmit = async () => {
    try {
      await requestService.resubmit(id, {});
      message.success('Resubmitted as new version');
      navigate('/requests');
    } catch { message.error('Resubmit failed'); }
  };

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await requestService.uploadDocument(id, formData);
      message.success('Document uploaded');
      fetchRequest();
    } catch { message.error('Upload failed'); }
    return false;
  };

  const handleCompleteWithPassword = async () => {
    try {
      const values = await completeForm.validateFields();
      await requestService.completeWithPassword(id, values);
      message.success('Request completed successfully');
      setCompleteModalVisible(false);
      completeForm.resetFields();
      fetchRequest();
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to complete request');
    }
  };

  const handleCompleteFacilityAccess = async () => {
    try {
      const values = await facilityAccessForm.validateFields();
      await requestService.completeFacilityAccess(id, values);
      message.success('Facility access granted');
      setCompleteFacilityModalVisible(false);
      facilityAccessForm.resetFields();
      fetchRequest();
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to complete request');
    }
  };

  if (!request) return <Card loading={loading}>Loading...</Card>;

  const canSubmit = request.status === 'DRAFT' && request.requesterId === currentUser.id;
  const canResubmit = request.status === 'RETURNED' && request.requesterId === currentUser.id;
  const canApprove = (request.status === 'SUBMITTED' || request.status === 'IN_PROGRESS') && request.requesterId !== currentUser.id;
  const canComplete = request.status === 'APPROVED' && permissions.includes('APPROVE_REQUEST');
  const showCredentials = request.status === 'COMPLETED' && request.payload?.credentials;
  const isCredentialType = request.type === 'NEW_USER';

  const history = request.workflowHistories?.sort((a, b) => new Date(a.actionDate) - new Date(b.actionDate)) || [];

  // Version history data
  const parentVersion = request.parentRequest;
  const childVersions = request.childRequests || [];

  return (
    <Card title={`Request ${request.requestNo}`} extra={<Button onClick={() => navigate('/requests')}>Back</Button>}>
      {/* Basic Information */}
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="Type">{request.type?.replace(/_/g, ' ')}</Descriptions.Item>
        <Descriptions.Item label="Status"><Tag color={request.status === 'APPROVED' ? 'green' : 'blue'}>{request.status}</Tag></Descriptions.Item>
        <Descriptions.Item label="Requester">{request.requester?.fullName}</Descriptions.Item>
        <Descriptions.Item label="Target User">{request.targetUser?.fullName || 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="Version">{request.version}</Descriptions.Item>
        <Descriptions.Item label="Current Step">{request.currentStep}</Descriptions.Item>
      </Descriptions>

      {/* User Details */}
      <Divider>User Details</Divider>
      <Row gutter={16}>
        <Col span={12}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Username">{request.requester?.username || '-'}</Descriptions.Item>
            <Descriptions.Item label="Department">{request.requester?.department || '-'}</Descriptions.Item>
          </Descriptions>
        </Col>
        <Col span={12}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Target Username">{request.targetUser?.username || '-'}</Descriptions.Item>
            <Descriptions.Item label="Target Department">{request.targetUser?.department || '-'}</Descriptions.Item>
          </Descriptions>
        </Col>
      </Row>

      {/* Request Details */}
      <Divider>Request Details</Divider>
      <Descriptions column={1} bordered size="small">
        {request.applicationName && (
          <Descriptions.Item label="Application">{request.applicationName}</Descriptions.Item>
        )}
        {request.payload?.requestedRole && (
          <Descriptions.Item label="Requested Role">{request.payload.requestedRole}</Descriptions.Item>
        )}
        {request.payload?.details && (
          <Descriptions.Item label="Additional Details">{request.payload.details}</Descriptions.Item>
        )}
        {request.payload?.credentials && (
          <Descriptions.Item label="Credentials">
            User ID: {request.payload.credentials.userId}<br/>
            Password: {request.payload.credentials.password}
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Supporting Documents */}
      <Divider>Supporting Documents</Divider>
      <Upload beforeUpload={handleUpload} showUploadList={false} accept=".pdf,.jpg,.png,.docx">
        <Button icon={<UploadOutlined />}>Upload Document</Button>
      </Upload>
      {request.documents?.length > 0 && (
        <List size="small" dataSource={request.documents} renderItem={doc => (
          <List.Item><a href={`http://localhost:5000/${doc.filePath}`} target="_blank" rel="noreferrer">{doc.originalName}</a></List.Item>
        )} />
      )}

      {/* Workflow History */}
      <Divider>Workflow History</Divider>
      <Timeline>
        {history.map((entry, idx) => (
          <Timeline.Item key={idx} color={entry.action === 'APPROVED' ? 'green' : entry.action === 'RETURNED' ? 'orange' : 'blue'}>
            <strong>{entry.stepName || entry.action}</strong> – {entry.action} by{' '}
            {entry.actionByUser?.fullName || entry.actionBy}
            {entry.comments && <p><em>{entry.comments}</em></p>}
            <small>{new Date(entry.actionDate).toLocaleString()}</small>
          </Timeline.Item>
        ))}
      </Timeline>

      {/* Version History */}
      <Divider>Version History</Divider>
      <Row gutter={16}>
        {parentVersion && (
          <Col span={12}>
            <Card size="small" title="Previous Version">
              <p><Text strong>Request No:</Text> {parentVersion.requestNo}</p>
              <p><Text strong>Version:</Text> {parentVersion.version}</p>
              <p><Text strong>Status:</Text> {parentVersion.status}</p>
              <Button size="small" onClick={() => navigate(`/requests/${parentVersion.id}`)}>View</Button>
            </Card>
          </Col>
        )}
        {childVersions.length > 0 && (
          <Col span={12}>
            <Card size="small" title="Newer Versions">
              {childVersions.map(child => (
                <div key={child.id} style={{ marginBottom: 8 }}>
                  <p><Text strong>Request No:</Text> {child.requestNo}</p>
                  <p><Text strong>Version:</Text> {child.version}</p>
                  <p><Text strong>Status:</Text> {child.status}</p>
                  <Button size="small" onClick={() => navigate(`/requests/${child.id}`)}>View</Button>
                </div>
              ))}
            </Card>
          </Col>
        )}
      </Row>

      {/* Actions */}
      <Divider>Actions</Divider>
      <Space>
        {canSubmit && <Button icon={<SendOutlined />} type="primary" onClick={() => handleAction('submit')}>Submit for Approval</Button>}
        {canResubmit && <Button icon={<SendOutlined />} onClick={handleResubmit}>Resubmit (New Version)</Button>}
        {canApprove && (
          <>
            <Button icon={<CheckOutlined />} type="primary" onClick={() => setCommentModal({ visible: true, action: 'approve' })}>Approve</Button>
            <Button icon={<RollbackOutlined />} onClick={() => setCommentModal({ visible: true, action: 'return' })}>Return</Button>
            <Button icon={<StopOutlined />} danger onClick={() => setCommentModal({ visible: true, action: 'reject' })}>Reject</Button>
          </>
        )}
        {canComplete && request.type !== 'FACILITY_ACCESS' && (
          <Button
            icon={isCredentialType ? <KeyOutlined /> : <CheckOutlined />}
            type="primary"
            onClick={() => setCompleteModalVisible(true)}
          >
            {isCredentialType ? 'Complete & Send Credentials' : 'Complete Request'}
          </Button>
        )}
        {request.type === 'FACILITY_ACCESS' && request.status === 'APPROVED' && permissions.includes('APPROVE_REQUEST') && (
          <Button icon={<KeyOutlined />} type="primary" onClick={() => setCompleteFacilityModalVisible(true)}>
            Complete Facility Access
          </Button>
        )}
        {showCredentials && (
          <Button icon={<EyeOutlined />} type="primary" onClick={() => setCredentialsModalVisible(true)}>
            View Credentials
          </Button>
        )}
      </Space>

      {/* Comment Modal */}
      <Modal
        title={commentModal.action === 'approve' ? 'Approve Comments' : commentModal.action === 'return' ? 'Return Reason' : 'Reject Reason'}
        open={commentModal.visible}
        onCancel={() => setCommentModal({ visible: false, action: '' })}
        onOk={() => {
          const comment = document.getElementById('commentInput').value;
          handleAction(commentModal.action, comment);
        }}
      >
        <Input.TextArea id="commentInput" rows={3} placeholder="Enter comments..." />
      </Modal>

      {/* Complete Request Modal */}
      <Modal
        title={isCredentialType ? "Complete Request & Send Credentials" : "Complete Request"}
        open={completeModalVisible}
        onOk={handleCompleteWithPassword}
        onCancel={() => { setCompleteModalVisible(false); completeForm.resetFields(); }}
        destroyOnClose
      >
        <Form form={completeForm} layout="vertical" preserve={false}>
          <Form.Item name="itAdminUsername" label="Your (IT Admin) Username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="itAdminPassword" label="Your (IT Admin) Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          {isCredentialType && (
            <>
              <Form.Item name="newUserId" label="New User ID (for Application)" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="newPassword" label="Temporary Password" rules={[{ required: true, min: 6 }]}>
                <Input.Password />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Complete Facility Access Modal */}
      <Modal
        title="Complete Facility Access"
        open={completeFacilityModalVisible}
        onOk={handleCompleteFacilityAccess}
        onCancel={() => { setCompleteFacilityModalVisible(false); facilityAccessForm.resetFields(); }}
        destroyOnClose
      >
        <Form form={facilityAccessForm} layout="vertical" preserve={false}>
          <Form.Item name="itAdminUsername" label="Your (IT Admin) Username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="itAdminPassword" label="Your (IT Admin) Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      {/* View Credentials Modal */}
      <Modal
        title="Your Credentials"
        open={credentialsModalVisible}
        onCancel={() => setCredentialsModalVisible(false)}
        footer={null}
      >
        {request.payload?.credentials && (
          <>
            <p><strong>User ID:</strong> {request.payload.credentials.userId}</p>
            <p><strong>Password:</strong> {request.payload.credentials.password}</p>
            <p style={{ color: '#888' }}>Please change your password after first login.</p>
          </>
        )}
      </Modal>
    </Card>
  );
};

export default RequestDetails;