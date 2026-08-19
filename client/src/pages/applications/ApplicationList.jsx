// ApplicationList.jsx – Final with permission-based UI controls + Admin Groups column
import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Modal, Form, Input, Select, Popconfirm, Tag, TreeSelect } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  EyeOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import applicationService from '../../services/applicationService';
import facilityService from '../../services/facilityService';
import groupService from '../../services/groupService';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';

const { Option } = Select;

const ApplicationList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const [roleInput, setRoleInput] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [rolesList, setRolesList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [allGroups, setAllGroups] = useState([]);

  const { canCreate, canEdit, canDelete } = usePermission();

  const { permissions } = useAuth();

  const hasBulkUploadPermission = permissions.includes('MANAGE_APPLICATION_BULK_UPLOAD');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await applicationService.getAll();
      setData(res.data);
    } catch (error) {
      message.error('Failed to fetch applications');
    }
    setLoading(false);
  };

  const fetchFacilities = async () => {
    try {
      const res = await facilityService.getAll();
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
      setFacilities(flatten(res.data));
    } catch (error) { /* ignore */ }
  };

  const fetchGroups = async () => {
    try {
      const res = await groupService.getAll();
      setAllGroups(res.data);
    } catch (error) {
      message.error('Failed to load groups');
    }
  };

  useEffect(() => {
    fetchData();
    fetchFacilities();
    fetchGroups();
  }, []);

  const buildFacilityTree = (list) => list.map(item => ({
    value: item.id,
    title: `${item.code} - ${item.name}`,
  }));

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setRolesList([]);
    setGroupsList([]);
    setRoleInput('');
    setGroupInput('');
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      manufacturer: record.manufacturer,
      versionNo: record.versionNo,
      oemContact: record.oemContact,
      status: record.status,
      facilityId: record.facility?.id || undefined,
      adminGroups: record.adminGroups?.map(g => g.id) || [],
    });
    setRolesList(record.roles || []);
    setGroupsList(record.groups || []);
    setRoleInput('');
    setGroupInput('');
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await applicationService.remove(id);
      message.success('Deleted');
      fetchData();
    } catch (error) {
      message.error('Delete failed');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        manufacturer: values.manufacturer || null,
        versionNo: values.versionNo || null,
        oemContact: values.oemContact || null,
        status: values.status || 'ACTIVE',
        roles: rolesList,
        groups: groupsList,
        facilityId: values.facilityId || null,
        adminGroups: values.adminGroups || [],
      };
      if (editing) {
        await applicationService.update(editing.id, payload);
        message.success('Updated');
      } else {
        await applicationService.create(payload);
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

  const addRole = () => {
    const trimmed = roleInput.trim();
    if (trimmed && !rolesList.includes(trimmed)) {
      setRolesList([...rolesList, trimmed]);
      setRoleInput('');
    }
  };

  const removeRole = (role) => {
    setRolesList(rolesList.filter((r) => r !== role));
  };

  const addGroup = () => {
    const trimmed = groupInput.trim();
    if (trimmed && !groupsList.includes(trimmed)) {
      setGroupsList([...groupsList, trimmed]);
      setGroupInput('');
    }
  };

  const removeGroup = (group) => {
    setGroupsList(groupsList.filter((g) => g !== group));
  };

  const handleDownloadSample = async () => {
    try {
      const res = await applicationService.downloadSampleCsv();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sample_applications.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      message.error('Sample download failed');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Manufacturer', dataIndex: 'manufacturer' },
    { title: 'Version', dataIndex: 'versionNo' },
    { title: 'Status', dataIndex: 'status' },
    { title: 'Instruments', dataIndex: 'instrumentCount', align: 'center' },
    { title: 'Computers', dataIndex: 'computerCount', align: 'center' },
    { title: 'Facility', render: (_, rec) => rec.facility?.name || '-' },
    // ✅ Admin Groups column (title changed from "Admin" to "Admin Groups")
    {
      title: 'Admin Groups',
      key: 'adminGroups',
      render: (_, record) => {
        const groups = record.adminGroups || [];
        return groups.map(g => g.groupName).join(', ') || '-';
      }
    },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => navigate(`/applications/${record.id}`)}>View</Button>
          {canEdit('APPLICATION') && (
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          )}
          {canDelete('APPLICATION') && (
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
        <h2>Applications</h2>
        <Space>
          {hasBulkUploadPermission && (
            <>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadSample}>Sample CSV</Button>
              <Button icon={<UploadOutlined />} onClick={() => navigate('/applications/csv')}>Bulk Upload</Button>
            </>
          )}
          {canCreate('APPLICATION') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Application</Button>
          )}
        </Space>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} />
      <Modal
        title={editing ? 'Edit Application' : 'Add Application'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        forceRender
        width={600}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="Application Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="manufacturer" label="Manufacturer"><Input /></Form.Item>
          <Form.Item name="versionNo" label="Version No"><Input /></Form.Item>
          <Form.Item name="oemContact" label="OEM Contact"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select>
              <Option value="ACTIVE">Active</Option>
              <Option value="RETIRED">Retired</Option>
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

          <Form.Item name="adminGroups" label="Admin Groups">
            <Select mode="multiple" allowClear placeholder="Select admin groups">
              {allGroups.map(g => (
                <Option key={g.id} value={g.id}>{g.groupName}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Application Roles">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input.Search
                placeholder="Enter role name"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                enterButton="Add"
                onSearch={addRole}
                onPressEnter={addRole}
              />
              <Space wrap>
                {rolesList.map((role) => (
                  <Tag key={role} closable onClose={() => removeRole(role)}>{role}</Tag>
                ))}
              </Space>
            </Space>
          </Form.Item>

          <Form.Item label="Application Groups">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input.Search
                placeholder="Enter group name"
                value={groupInput}
                onChange={(e) => setGroupInput(e.target.value)}
                enterButton="Add"
                onSearch={addGroup}
                onPressEnter={addGroup}
              />
              <Space wrap>
                {groupsList.map((group) => (
                  <Tag key={group} closable onClose={() => removeGroup(group)}>{group}</Tag>
                ))}
              </Space>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApplicationList;