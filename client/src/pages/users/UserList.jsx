// UserList.jsx – with permission‑based UI controls (Add/Edit/Delete/CSV/Sync hidden for VIEW_USER only)
import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Modal, Form, Input, Select, Popconfirm, Tag, DatePicker, Upload, Input as SearchInput, Row, Col, TreeSelect } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  EyeOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import userService from '../../services/userService';
import roleService from '../../services/roleService';
import groupService from '../../services/groupService';
import facilityService from '../../services/facilityService';
import settingsService from '../../services/settingsService';
import { usePermission } from '../../hooks/usePermission';   // <-- new import
import moment from 'moment';

const { Option } = Select;

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  const [allRoles, setAllRoles] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [allFacilities, setAllFacilities] = useState([]);

  const [csvFile, setCsvFile] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Permission hooks
  const { canCreate, canEdit, canDelete } = usePermission();   // <-- new

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userService.getAll();
      setUsers(res.data);
      setFilteredUsers(res.data);
    } catch (error) {
      message.error('Failed to fetch users');
    }
    setLoading(false);
  };

  const fetchDropdowns = async () => {
    try {
      const [rolesRes, groupsRes, facRes] = await Promise.all([
        roleService.getAll(),
        groupService.getAll(),
        facilityService.getAll(),
      ]);
      setAllRoles(rolesRes.data);
      setAllGroups(groupsRes.data);

      // ✅ केवल FACTORY प्रकार की सुविधाएँ लें, और children हटा दें
      const flattenFactories = (nodes) => {
        let list = [];
        nodes.forEach(node => {
          if (node.type === 'FACTORY') {
            // children हटाएँ
            const { children, ...rest } = node;
            list.push({ ...rest, children: [] });
          }
          if (node.children) {
            list = list.concat(flattenFactories(node.children));
          }
        });
        return list;
      };
      const factories = flattenFactories(facRes.data);
      setAllFacilities(factories);
    } catch (error) { /* ignore */ }
  };

  useEffect(() => {
    fetchUsers();
    fetchDropdowns();
  }, []);

  useEffect(() => {
    if (!searchText.trim()) { setFilteredUsers(users); return; }
    const lowerSearch = searchText.toLowerCase();
    setFilteredUsers(users.filter(u =>
      u.employeeId?.toLowerCase().includes(lowerSearch) ||
      u.fullName?.toLowerCase().includes(lowerSearch)
    ));
  }, [searchText, users]);

  const buildFacilityTree = (list) => list.map(item => ({
    value: item.id,
    title: `${item.code} - ${item.name}`,
    children: item.children ? buildFacilityTree(item.children) : undefined,
  }));

  const handleAdd = () => {
    setViewMode(false);
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ contactDetails: '', groupNames: allGroups.find(g => g.groupName === 'User')?.groupName ? [allGroups.find(g => g.groupName === 'User').groupName] : [] });
    setModalVisible(true);
  };

  const handleView = async (record) => {
    const user = await userService.getOne(record.id);
    setEditingUser(user.data);
    setViewMode(true);
    fillForm(user.data);
    setModalVisible(true);
  };

  const handleEdit = async (record) => {
    const user = await userService.getOne(record.id);
    setEditingUser(user.data);
    setViewMode(false);
    setTimeout(() => fillForm(user.data), 100);
    setModalVisible(true);
  };

  const fillForm = (user) => {
    form.setFieldsValue({
      employeeId: user.employeeId,
      username: user.username,
      domainUserId: user.domainUserId || '',
      email: user.email,
      fullName: user.fullName,
      department: user.department,
      designation: user.designation,
      joiningDate: user.joiningDate ? moment(user.joiningDate) : null,
      dateOfBirth: user.dateOfBirth ? moment(user.dateOfBirth) : null,
      reportingManager: user.reportingManager || '',
      contactDetails: user.contactDetails ? JSON.stringify(user.contactDetails, null, 2) : '',
      isActive: user.isActive === true,
      roleNames: user.roles ? user.roles.map(r => r.roleName) : [],
      groupNames: user.groups ? user.groups.map(g => g.groupName) : [],
      facilityIds: user.facilities ? user.facilities.map(f => f.id) : [],
    });
  };

  const handleDelete = async (id) => {
    try { await userService.remove(id); message.success('Deleted'); fetchUsers(); }
    catch { message.error('Delete failed'); }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (values.joiningDate) values.joiningDate = values.joiningDate.format('YYYY-MM-DD');
      if (values.dateOfBirth) values.dateOfBirth = values.dateOfBirth.format('YYYY-MM-DD');
      else values.dateOfBirth = null;

      let contactDetails = {};
      if (values.contactDetails) {
        try { contactDetails = JSON.parse(values.contactDetails); }
        catch (e) { message.error('Invalid JSON in Contact Details'); return; }
      }

      const payload = {
        employeeId: values.employeeId,
        username: values.username,
        domainUserId: values.domainUserId || values.username,
        email: values.email,
        fullName: values.fullName,
        department: values.department,
        designation: values.designation,
        joiningDate: values.joiningDate,
        contactDetails,
        reportingManager: values.reportingManager || null,
        dateOfBirth: values.dateOfBirth,
        isActive: values.isActive !== undefined ? values.isActive : true,
        roles: values.roleNames || [],
        groups: values.groupNames || [],
        facilityIds: values.facilityIds || [],
      };

      if (values.password) payload.password = values.password;

      if (editingUser) {
        await userService.update(editingUser.id, payload);
        message.success('User updated');
      } else {
        await userService.create(payload);
        message.success('User created');
      }
      setModalVisible(false);
      fetchUsers();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.message || error.message || 'Operation failed');
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    const formData = new FormData();
    formData.append('file', csvFile);
    try {
      await userService.bulkUpload(formData);
      message.success('CSV uploaded');
      setCsvFile(null);
      fetchUsers();
    } catch (error) { message.error('Upload failed'); }
  };

  const handleDownloadSample = async () => {
    try {
      const res = await userService.downloadSampleCsv();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample_users.csv';
      a.click();
      a.remove();
    } catch (error) { message.error('Download failed'); }
  };

  const handleSyncAD = async () => {
    setSyncing(true);
    try {
      const res = await settingsService.syncADUsers();
      message.success(res.data.message || 'AD Sync completed');
    } catch (error) {
      message.error(error.response?.data?.message || 'AD Sync failed');
    }
    setSyncing(false);
  };

  const columns = [
    { title: 'User Name', dataIndex: 'fullName' },
    { title: 'Emp Code', dataIndex: 'employeeId' },
    { title: 'Department', dataIndex: 'department' },
    { title: 'Status', dataIndex: 'isActive', render: v => v ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag> },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleView(record)}>View</Button>
          {canEdit('USER') && (
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          )}
          {canDelete('USER') && (
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Users</h2>
        <Space>
          <SearchInput placeholder="Search Emp Code or Name" allowClear value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 250 }} />
          {canCreate('USER') && (
            <>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadSample}>Sample CSV</Button>
              <Upload accept=".csv" showUploadList={false} beforeUpload={f => { setCsvFile(f); return false; }} fileList={csvFile ? [csvFile] : []} onRemove={() => setCsvFile(null)}>
                <Button icon={<UploadOutlined />}>Select CSV</Button>
              </Upload>
              <Button type="primary" onClick={handleCsvUpload} disabled={!csvFile}>Upload Users</Button>
              <Button
                icon={<SyncOutlined />}
                loading={syncing}
                onClick={handleSyncAD}
              >
                Sync AD Users
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add User</Button>
            </>
          )}
        </Space>
      </div>

      <Table dataSource={filteredUsers} columns={columns} rowKey="id" loading={loading} />

      <Modal
        title={viewMode ? 'View User' : editingUser ? 'Edit User' : 'Add User'}
        open={modalVisible}
        onOk={viewMode ? () => setModalVisible(false) : handleSubmit}
        okText={viewMode ? 'Close' : editingUser ? 'Update' : 'Create'}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        forceRender
        width={800}
      >
        <Form form={form} layout="vertical" preserve={false} disabled={viewMode}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="employeeId" label="Employee ID" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="username" label="Username (Domain ID)" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="domainUserId" label="Domain User ID"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="department" label="Department" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="designation" label="Designation" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="joiningDate" label="Joining Date" rules={[{ required: true }]}><DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="contactDetails" label="Contact Details (JSON)" extra='e.g. {"phone":"1234567890"}'><Input.TextArea rows={3} placeholder='{"phone":"1234567890"}' /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="reportingManager" label="Reporting Manager"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="dateOfBirth" label="Date of Birth"><DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="roleNames" label="System Roles">
                <Select mode="multiple" placeholder="Select roles" allowClear>
                  {allRoles.map(r => <Option key={r.id} value={r.roleName}>{r.roleName}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="groupNames" label="System Groups">
                <Select mode="multiple" placeholder="Select groups" allowClear>
                  {allGroups.map(g => <Option key={g.id} value={g.groupName}>{g.groupName}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="facilityIds" label="Assigned Facilities">
            <TreeSelect
              treeData={buildFacilityTree(allFacilities)}
              treeCheckable
              placeholder="Select facilities"
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              allowClear
            />
          </Form.Item>

          {!editingUser && (
            <Form.Item name="password" label="Password (leave blank for domain user)">
              <Input.Password />
            </Form.Item>
          )}
          {editingUser && !viewMode && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="isActive" label="Status">
                  <Select>
                    <Option value={true}>Active</Option>
                    <Option value={false}>Inactive</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="password" label="New Password (optional)">
                  <Input.Password />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default UserList;