import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Modal, Form, Input, Switch, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import masterActivityService from '../../services/masterActivityService';

const MasterActivities = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState(false);       // ✅ read-only के लिए
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await masterActivityService.getAll();
      setActivities(res.data);
    } catch { message.error('Failed to fetch activities'); }
    setLoading(false);
  };

  useEffect(() => { fetchActivities(); }, []);

  const handleAdd = () => {
    setViewMode(false);
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: false });   // ✅ default false
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setViewMode(false);
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      isActive: record.isActive,
    });
    setModalVisible(true);
  };

  const handleView = (record) => {
    setViewMode(true);
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      isActive: record.isActive,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try { await masterActivityService.remove(id); message.success('Deleted'); fetchActivities(); }
    catch { message.error('Delete failed'); }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await masterActivityService.update(editing.id, values);
        message.success('Updated');
      } else {
        await masterActivityService.create(values);
        message.success('Created');
      }
      setModalVisible(false);
      fetchActivities();
    } catch (error) {
      message.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Description', dataIndex: 'description' },
    { title: 'Active', dataIndex: 'isActive', render: (v) => v ? 'Yes' : 'No' },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleView(record)}>View</Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Popconfirm title="Sure?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Master Activities</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Activity</Button>
      </div>
      <Table dataSource={activities} columns={columns} rowKey="id" loading={loading} />

      <Modal
        title={viewMode ? 'View Activity' : editing ? 'Edit Activity' : 'Add Activity'}
        open={modalVisible}
        onOk={viewMode ? () => setModalVisible(false) : handleSubmit}
        okText={viewMode ? 'Close' : editing ? 'Update' : 'Create'}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        forceRender
      >
        <Form form={form} layout="vertical" preserve={false} disabled={viewMode}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MasterActivities;