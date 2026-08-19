// RoleList.jsx – with permission-based UI controls
import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Modal, Form, Input, Select, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import roleService from '../../services/roleService';
import { usePermission } from '../../hooks/usePermission';   // <-- new import

const { Option } = Select;

const RoleList = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  // Permission hooks
  const { canCreate, canEdit, canDelete } = usePermission();   // <-- new

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await roleService.getAll();
      setRoles(res.data);
    } catch { message.error('Failed to fetch'); }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = () => { setEditing(null); form.resetFields(); setModalVisible(true); };
  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      roleName: record.roleName,
      description: record.description,
      permissions: record.permissions?.map(p => p.permissionName)
    });
    setModalVisible(true);
  };
  const handleDelete = async (id) => {
    try { await roleService.remove(id); message.success('Deleted'); fetch(); }
    catch { message.error('Delete failed'); }
  };
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await roleService.update(editing.id, values);
        message.success('Updated');
      } else {
        await roleService.create(values);
        message.success('Created');
      }
      setModalVisible(false);
      fetch();
    } catch { message.error('Operation failed'); }
  };

  const columns = [
    { title: 'Role Name', dataIndex: 'roleName' },
    { title: 'Description', dataIndex: 'description' },
    { title: 'System', dataIndex: 'isSystem', render: (v) => v ? <Tag color="blue">Yes</Tag> : <Tag>No</Tag> },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          {canEdit('ROLE') && (
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} disabled={record.isSystem} />
          )}
          {canDelete('ROLE') && (
            <Popconfirm title="Sure?" onConfirm={() => handleDelete(record.id)} disabled={record.isSystem}>
              <Button icon={<DeleteOutlined />} size="small" danger disabled={record.isSystem} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const predefinedPermissions = ['CREATE_USER','EDIT_USER','DELETE_USER','VIEW_USER','CREATE_FACILITY','EDIT_FACILITY','DELETE_FACILITY','MANAGE_ROLES','MANAGE_GROUPS','VIEW_AUDIT','APPROVE_REQUEST','RETURN_REQUEST'];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Roles</h2>
        {canCreate('ROLE') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Role</Button>
        )}
      </div>
      <Table dataSource={roles} columns={columns} rowKey="id" loading={loading} />
      <Modal
        title={editing ? 'Edit Role' : 'Add Role'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="roleName" label="Role Name" rules={[{ required: true }]}>
            <Input disabled={editing?.isSystem} />
          </Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="permissions" label="Permissions">
            <Select mode="multiple" placeholder="Select permissions">
              {predefinedPermissions.map(p => <Option key={p} value={p}>{p}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RoleList;