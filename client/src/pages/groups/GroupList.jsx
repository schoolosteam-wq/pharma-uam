// src/pages/groups/GroupList.jsx – with backend search for members
import React, { useEffect, useState, useRef } from 'react';
import { Table, Button, Space, message, Modal, Form, Input, Popconfirm, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons';
import groupService from '../../services/groupService';
import userService from '../../services/userService';
import { usePermission } from '../../hooks/usePermission';

const { Option } = Select;

const GroupList = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [allUsers, setAllUsers] = useState([]);        // search results
  const [memberUsers, setMemberUsers] = useState([]);  // selected members' user objects
  const [memberIds, setMemberIds] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const searchTimeoutRef = useRef(null);

  const { canCreate, canEdit, canDelete } = usePermission();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await groupService.getAll();
      setGroups(res.data);
    } catch { message.error('Failed to fetch groups'); }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = () => { setEditing(null); form.resetFields(); setModalVisible(true); };
  const handleEdit = (record) => { setEditing(record); form.setFieldsValue(record); setModalVisible(true); };
  const handleDelete = async (id) => {
    try { await groupService.remove(id); message.success('Deleted'); fetch(); }
    catch { message.error('Delete failed'); }
  };
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await groupService.update(editing.id, values);
        message.success('Updated');
      } else {
        await groupService.create(values);
        message.success('Created');
      }
      setModalVisible(false);
      fetch();
    } catch { message.error('Operation failed'); }
  };

  // Load users from backend with search
  const loadUsers = async (search) => {
    setMembersLoading(true);
    try {
      const res = await userService.searchUsers(search, 50);
      setAllUsers(res.data);
    } catch {
      message.error('Could not load users');
    } finally {
      setMembersLoading(false);
    }
  };

  const openMembersModal = async (record) => {
    setSelectedGroup(record);
    setMembersModalVisible(true);
    setMemberSearch('');
    setAllUsers([]);
    setMemberUsers([]);
    setMemberIds([]);

    try {
      const membersRes = await groupService.getMembers(record.id);
      setMemberIds(membersRes.data.map(u => u.id));
      setMemberUsers(membersRes.data); // selected members' full objects
    } catch { message.error('Could not load members'); }

    // Load initial users (first page)
    await loadUsers('');
  };

  const handleMembersSave = async () => {
    if (!selectedGroup) return;
    try {
      await groupService.updateMembers(selectedGroup.id, memberIds);
      message.success('Members updated');
      setMembersModalVisible(false);
    } catch { message.error('Failed to update members'); }
  };

  const handleSearch = (value) => {
    setMemberSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadUsers(value);
    }, 300);
  };

  // Merge selected members with search results for options
  const options = [...memberUsers, ...allUsers.filter(u => !memberUsers.some(m => m.id === u.id))];

  const columns = [
    { title: 'Group Name', dataIndex: 'groupName' },
    { title: 'Description', dataIndex: 'description' },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          {canEdit('GROUP') && (
            <Button icon={<TeamOutlined />} size="small" onClick={() => openMembersModal(record)}>Members</Button>
          )}
          {canEdit('GROUP') && (
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          )}
          {canDelete('GROUP') && (
            <Popconfirm title="Sure?" onConfirm={() => handleDelete(record.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Groups</h2>
        {canCreate('GROUP') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Group</Button>
        )}
      </div>
      <Table dataSource={groups} columns={columns} rowKey="id" loading={loading} />

      {/* Add/Edit Group Modal */}
      <Modal
        title={editing ? 'Edit Group' : 'Add Group'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="groupName" label="Group Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Manage Members Modal */}
      <Modal
        title={`Manage Members – ${selectedGroup?.groupName}`}
        open={membersModalVisible}
        onOk={handleMembersSave}
        onCancel={() => {
          setMembersModalVisible(false);
          if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        }}
        width={500}
      >
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="Search and select members"
          value={memberIds}
          onChange={setMemberIds}
          loading={membersLoading}
          showSearch
          onSearch={handleSearch}
          filterOption={false}
        >
          {options.map(user => (
            <Option key={user.id} value={user.id}>{user.fullName} ({user.username})</Option>
          ))}
        </Select>
      </Modal>
    </div>
  );
};

export default GroupList;