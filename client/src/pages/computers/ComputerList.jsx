// ComputerList.jsx – Final with permission-based UI controls
import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Modal, Form, Input, Select, Popconfirm, TreeSelect } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import computerService from '../../services/computerService';
import instrumentService from '../../services/instrumentService';
import applicationService from '../../services/applicationService';
import facilityService from '../../services/facilityService';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';   // <-- new import
import { useAuth } from '../../context/AuthContext';


const { Option } = Select;

const ComputerList = () => {
  const [data, setData] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [applications, setApplications] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Permission hooks
  const { canCreate, canEdit, canDelete } = usePermission();   // <-- new
  const { permissions } = useAuth();

  const hasBulkUploadPermission = permissions.includes('MANAGE_COMPUTER_BULK_UPLOAD');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await computerService.getAll();
      setData(res.data);
    } catch (error) {
      message.error('Failed to fetch computers');
    }
    setLoading(false);
  };

  const fetchDropdowns = async () => {
    try {
      const [instRes, appRes, facRes] = await Promise.all([
        instrumentService.getAll(),
        applicationService.getAll(),
        facilityService.getAll(),
      ]);
      setInstruments(instRes.data);
      setApplications(appRes.data);

      // ✅ केवल FACTORY प्रकार की सुविधाएँ निकालें
      const flatten = (nodes) => {
        let list = [];
        nodes.forEach(node => {
          if (node.type === 'FACTORY') {
            list.push({ id: node.id, name: node.name, code: node.code });
          }
          if (node.children) list = list.concat(flatten(node.children));
        });
        return list;
      };
      setFacilities(flatten(facRes.data));
    } catch (error) { /* ignore */ }
  };

  useEffect(() => {
    fetchData();
    fetchDropdowns();
  }, []);

  const buildFacilityTree = (list) => list.map(item => ({
    value: item.id,
    title: `${item.code} - ${item.name}`,
  }));

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      computerMakeModel: record.computerMakeModel,
      serialNumber: record.serialNumber,
      ipAddress: record.ipAddress,
      status: record.status,
      instrumentIds: record.instruments?.map(i => i.id) || [],
      applicationIds: record.applications?.map(a => a.id) || [],
      facilityId: record.facility?.id || undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try { await computerService.remove(id); message.success('Deleted'); fetchData(); }
    catch { message.error('Delete failed'); }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        computerMakeModel: values.computerMakeModel,
        serialNumber: values.serialNumber,
        ipAddress: values.ipAddress || null,
        status: values.status || 'ACTIVE',
        instrumentIds: values.instrumentIds || [],
        applicationIds: values.applicationIds || [],
        facilityId: values.facilityId || null,
      };
      if (editing) {
        await computerService.update(editing.id, payload);
        message.success('Updated');
      } else {
        await computerService.create(payload);
        message.success('Created');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      if (error.errorFields) return;
      const msg = error.response?.data?.message || error.message || 'Operation failed';
      message.error(msg);
    }
  };

  const columns = [
    { title: 'Make & Model', dataIndex: 'computerMakeModel' },
    { title: 'Serial Number', dataIndex: 'serialNumber' },
    { title: 'IP Address', dataIndex: 'ipAddress' },
    { title: 'Status', dataIndex: 'status' },
    { title: 'Connected Applications', render: (_, rec) => rec.applications?.map(a => a.name).join(', ') || '-' },
    { title: 'Connected Instruments', render: (_, rec) => rec.instruments?.map(i => `${i.make} ${i.model}`).join(', ') || '-' },
    { title: 'Facility', render: (_, rec) => rec.facility?.name || '-' },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          {canEdit('COMPUTER') && (
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          )}
          {canDelete('COMPUTER') && (
            <Popconfirm title="Sure?" onConfirm={() => handleDelete(record.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Computers</h2>
        <Space>
          {hasBulkUploadPermission && (
            <>
              <Button icon={<UploadOutlined />} onClick={() => navigate('/computers/csv')}>Bulk Upload</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Computer</Button>
            </>
          )}
        </Space>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} />
      <Modal
        title={editing ? 'Edit Computer' : 'Add Computer'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={600}
        forceRender
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="computerMakeModel" label="Computer Make & Model" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="serialNumber" label="Serial Number" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ipAddress" label="IP Address"><Input /></Form.Item>
          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select>
              <Option value="ACTIVE">Active</Option>
              <Option value="INACTIVE">Inactive</Option>
            </Select>
          </Form.Item>
          <Form.Item name="instrumentIds" label="Connected Instruments">
            <Select mode="multiple" placeholder="Select instruments" allowClear>
              {instruments.map(i => <Option key={i.id} value={i.id}>{i.make} {i.model} ({i.serialNumber})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="applicationIds" label="Connected Applications">
            <Select mode="multiple" placeholder="Select applications" allowClear>
              {applications.map(a => <Option key={a.id} value={a.id}>{a.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="facilityId" label="Facility">
            <TreeSelect
              treeData={buildFacilityTree(facilities)}
              placeholder="Select facility"
              treeDefaultExpandAll
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ComputerList;