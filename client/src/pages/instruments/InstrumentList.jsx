// InstrumentList.jsx – Final with permission-based UI controls
import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Modal, Form, Input, Select, Popconfirm, TreeSelect } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import instrumentService from '../../services/instrumentService';
import applicationService from '../../services/applicationService';
import computerService from '../../services/computerService';
import facilityService from '../../services/facilityService';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';   // <-- new import
import { useAuth } from '../../context/AuthContext';

const { Option } = Select;
const { TextArea } = Input;

const InstrumentList = () => {
  const [data, setData] = useState([]);
  const [apps, setApps] = useState([]);
  const [computers, setComputers] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Permission hooks
  const { canCreate, canEdit, canDelete } = usePermission();   // <-- new
  const { permissions } = useAuth();

  const hasBulkUploadPermission = permissions.includes('MANAGE_INSTRUMENT_BULK_UPLOAD');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await instrumentService.getAll();
      setData(res.data);
    } catch (error) {
      message.error('Failed to fetch instruments');
    }
    setLoading(false);
  };

  const fetchDropdowns = async () => {
    try {
      const [appsRes, compRes, facRes] = await Promise.all([
        applicationService.getAll(),
        computerService.getAll(),
        facilityService.getAll(),
      ]);
      setApps(appsRes.data);
      setComputers(compRes.data);

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
      make: record.make,
      model: record.model,
      serialNumber: record.serialNumber,
      oemDetails: record.oemDetails ? JSON.stringify(record.oemDetails, null, 2) : '',
      status: record.status,
      applicationId: record.applicationId || undefined,
      currentLocation: record.currentLocation,
      computerIds: record.computers?.map(c => c.id) || [],
      facilityId: record.facility?.id || undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try { await instrumentService.remove(id); message.success('Deleted'); fetchData(); }
    catch { message.error('Delete failed'); }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let oemDetails = {};
      if (values.oemDetails) {
        try { oemDetails = JSON.parse(values.oemDetails); }
        catch (e) { message.error('Invalid JSON in OEM Details'); return; }
      }
      const payload = {
        make: values.make || null,
        model: values.model || null,
        serialNumber: values.serialNumber,
        oemDetails,
        status: values.status || 'ACTIVE',
        applicationId: values.applicationId || null,
        currentLocation: values.currentLocation || null,
        computerIds: values.computerIds || [],
        facilityId: values.facilityId || null,
      };
      if (editing) {
        await instrumentService.update(editing.id, payload);
        message.success('Updated');
      } else {
        await instrumentService.create(payload);
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
    { title: 'Make', dataIndex: 'make' },
    { title: 'Model', dataIndex: 'model' },
    { title: 'Serial Number', dataIndex: 'serialNumber' },
    { title: 'Status', dataIndex: 'status' },
    { title: 'Application', render: (_, record) => record.application?.name || '-' },
    { title: 'Connected Computers', render: (_, record) => record.computers?.map(c => c.computerMakeModel).join(', ') || '-' },
    { title: 'Facility', render: (_, rec) => rec.facility?.name || '-' },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          {canEdit('INSTRUMENT') && (
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          )}
          {canDelete('INSTRUMENT') && (
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
        <h2>Instruments</h2>
        <Space>
          {hasBulkUploadPermission && (
            <>
              <Button icon={<UploadOutlined />} onClick={() => navigate('/instruments/csv')}>Bulk Upload</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Instrument</Button>
            </>
          )}
        </Space>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} />
      <Modal
        title={editing ? 'Edit Instrument' : 'Add Instrument'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={600}
        forceRender
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="make" label="Make"><Input /></Form.Item>
          <Form.Item name="model" label="Model"><Input /></Form.Item>
          <Form.Item name="serialNumber" label="Serial Number" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="oemDetails" label="OEM Details (JSON)"><TextArea rows={4} placeholder='{"key": "value"}' /></Form.Item>
          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select>
              <Option value="ACTIVE">Active</Option>
              <Option value="RETIRED">Retired</Option>
              <Option value="TRANSFERRED">Transferred</Option>
            </Select>
          </Form.Item>
          <Form.Item name="applicationId" label="Application">
            <Select allowClear placeholder="Select application">
              {apps.map(app => <Option key={app.id} value={app.id}>{app.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="currentLocation" label="Current Location"><Input /></Form.Item>
          <Form.Item name="computerIds" label="Connected Computers">
            <Select mode="multiple" placeholder="Select computers" allowClear>
              {computers.map(c => <Option key={c.id} value={c.id}>{c.computerMakeModel}</Option>)}
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

export default InstrumentList;