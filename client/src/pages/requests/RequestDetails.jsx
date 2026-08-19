// RequestDetails.jsx – with Complete Facility Access button & modal
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Button, Space, message, Upload, List, Timeline, Modal, Form, Input, Tag, Divider } from 'antd';
import { UploadOutlined, CheckOutlined, RollbackOutlined, StopOutlined, SendOutlined, KeyOutlined, EyeOutlined } from '@ant-design/icons';
import requestService from '../../services/requestService';
import { useAuth } from '../../context/AuthContext';

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

  // --- New state for Facility Access completion ---
  const [completeFacilityModalVisible, setCompleteFacilityModalVisible] = useState(false);
  const [facilityAccessForm] = Form.useForm();   // separate form for facility access

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

  // --- New handler for Facility Access completion ---
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

  // ✅ अब सिर्फ NEW_USER के लिए credential fields आवश्यक हैं
  const isCredentialType = request.type === 'NEW_USER';

  const history = request.workflowHistories?.sort((a, b) => new Date(a.actionDate) - new Date(b.actionDate)) || [];

  return (
    <Card title={`Request ${request.requestNo}`} extra={<Button onClick={() => navigate('/requests')}>Back</Button>}>
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="Type">{request.type?.replace(/_/g, ' ')}</Descriptions.Item>
        <Descriptions.Item label="Status"><Tag color={request.status === 'APPROVED' ? 'green' : 'blue'}>{request.status}</Tag></Descriptions.Item>
        <Descriptions.Item label="Requester">{request.requester?.fullName}</Descriptions.Item>
        <Descriptions.Item label="Target User">{request.targetUser?.fullName || 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="Version">{request.version}</Descriptions.Item>
        <Descriptions.Item label="Current Step">{request.currentStep}</Descriptions.Item>
      </Descriptions>

      <Divider>Supporting Documents</Divider>
      <Upload beforeUpload={handleUpload} showUploadList={false} accept=".pdf,.jpg,.png,.docx">
        <Button icon={<UploadOutlined />}>Upload Document</Button>
      </Upload>
      {request.documents?.length > 0 && (
        <List size="small" dataSource={request.documents} renderItem={doc => (
          <List.Item><a href={`http://localhost:5000/${doc.filePath}`} target="_blank" rel="noreferrer">{doc.originalName}</a></List.Item>
        )} />
      )}

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
        {/* New button for Facility Access */}
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

      {/* Complete Request Modal – type‑specific fields */}
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