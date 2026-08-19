import React, { useEffect, useState } from 'react';
import {
  Table, Button, Space, message, Modal, Form, Input, Select,
  Popconfirm, Tag, TreeSelect, Row, Col, DatePicker, Radio,
} from 'antd';
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

  // Dynamic roles/groups lists (for modal)
  const [roleInput, setRoleInput] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [rolesList, setRolesList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);

  // Dropdown data
  const [facilities, setFacilities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allGroups, setAllGroups] = useState([]);

  const { canCreate, canEdit, canDelete } = usePermission();
  const { permissions } = useAuth();

  const hasBulkUploadPermission = permissions.includes('MANAGE_APPLICATION_BULK_UPLOAD');

  // ---------- Data fetching ----------
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

  const fetchDropdowns = async () => {
    try {
      const [facRes, deptRes, groupRes] = await Promise.all([
        facilityService.getAll(),
        facilityService.getByType('DEPARTMENT'),
        groupService.getAll(),
      ]);
      // Flatten facility tree to get only FACTORY nodes
      const flattenFac = (nodes) => {
        let list = [];
        nodes.forEach(node => {
          if (node.type === 'FACTORY') {
            list.push({ id: node.id, name: node.name, code: node.code });
          }
          if (node.children) list = list.concat(flattenFac(node.children));
        });
        return list;
      };
      setFacilities(flattenFac(facRes.data));
      setDepartments(deptRes.data || []);
      setAllGroups(groupRes.data || []);
    } catch (error) {
      message.error('Failed to load dropdown data');
    }
  };

  useEffect(() => {
    fetchData();
    fetchDropdowns();
  }, []);

  // ---------- Utility ----------
  const buildFacilityTree = (list) =>
    list.map(item => ({
      value: item.id,
      title: `${item.code} - ${item.name}`,
    }));

  // ---------- Modal handlers ----------
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
      departmentId: record.department?.id || undefined,
      applicationOwner: record.applicationOwner || undefined,
      gampCategory: record.gampCategory || undefined,
      validated: record.validated,
      eresApplicable: record.eresApplicable,
      lastPeriodicReviewDate: record.lastPeriodicReviewDate ? record.lastPeriodicReviewDate : null,
      databaseType: record.databaseType || undefined,
      auditTrailEnabled: record.auditTrailEnabled,
      applicationCriticality: record.applicationCriticality || undefined,
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
        facilityId: values.facilityId || null,
        departmentId: values.departmentId || null,
        applicationOwner: values.applicationOwner || null,
        gampCategory: values.gampCategory || null,
        validated: values.validated ?? false,
        eresApplicable: values.eresApplicable ?? false,
        lastPeriodicReviewDate: values.lastPeriodicReviewDate || null,
        databaseType: values.databaseType || null,
        auditTrailEnabled: values.auditTrailEnabled ?? false,
        applicationCriticality: values.applicationCriticality || null,
        roles: rolesList,
        groups: groupsList,
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

  // ---------- Dynamic role/group tag helpers ----------
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

  // ---------- CSV sample ----------
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

  // ---------- Table columns ----------
  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Manufacturer', dataIndex: 'manufacturer' },
    { title: 'Version', dataIndex: 'versionNo' },
    { title: 'Status', dataIndex: 'status' },
    { title: 'Instruments', dataIndex: 'instrumentCount', align: 'center' },
    { title: 'Computers', dataIndex: 'computerCount', align: 'center' },
    { title: 'Facility', render: (_, rec) => rec.facility?.name || '-' },
    {
      title: 'Admin Groups',
      key: 'adminGroups',
      render: (_, record) => {
        const groups = record.adminGroups || [];
        return groups.map(g => g.groupName).join(', ') || '-';
      },
    },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => navigate(`/applications/${record.id}`)}
          >
            View
          </Button>
          {canEdit('APPLICATION') && (
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
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

  // ---------- Render ----------
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Applications</h2>
        <Space>
          {hasBulkUploadPermission && (
            <>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadSample}>
                Sample CSV
              </Button>
              <Button icon={<UploadOutlined />} onClick={() => navigate('/applications/csv')}>
                Bulk Upload
              </Button>
            </>
          )}
          {canCreate('APPLICATION') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Add Application
            </Button>
          )}
        </Space>
      </div>

      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} />

      {/* ---------- Modal ---------- */}
      <Modal
        title={editing ? 'Edit Application' : 'Add Application'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        forceRender
        width={900}
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Application Name"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="manufacturer" label="Manufacturer">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="versionNo" label="Version No">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="oemContact" label="OEM Contact">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status" initialValue="ACTIVE">
                <Select>
                  <Option value="ACTIVE">Active</Option>
                  <Option value="RETIRED">Retired</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="facilityId" label="Facility">
                <TreeSelect
                  treeData={buildFacilityTree(facilities)}
                  placeholder="Select facility"
                  treeDefaultExpandAll
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="departmentId" label="Department">
                <Select placeholder="Select department" allowClear>
                  {departments.map(d => (
                    <Option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="applicationOwner" label="Application Owner">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={4}>
              <Form.Item name="gampCategory" label="GAMP Category">
                <Select allowClear placeholder="Select">
                  <Option value="1">1</Option>
                  <Option value="3">3</Option>
                  <Option value="4">4</Option>
                  <Option value="5">5</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item
                name="validated"
                label="Validated"
                valuePropName="checked"
              >
                <Radio.Group>
                  <Radio value={true}>Yes</Radio>
                  <Radio value={false}>No</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item
                name="eresApplicable"
                label="ERES Applicable"
                valuePropName="checked"
              >
                <Radio.Group>
                  <Radio value={true}>Yes</Radio>
                  <Radio value={false}>No</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item
                name="auditTrailEnabled"
                label="Audit Trail Enabled"
                valuePropName="checked"
              >
                <Radio.Group>
                  <Radio value={true}>Yes</Radio>
                  <Radio value={false}>No</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="applicationCriticality" label="Criticality">
                <Select allowClear placeholder="Select">
                  <Option value="High">High</Option>
                  <Option value="Medium">Medium</Option>
                  <Option value="Low">Low</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="databaseType" label="Database Type">
                <Select allowClear placeholder="Select">
                  <Option value="Oracle">Oracle</Option>
                  <Option value="SQL Server">SQL Server</Option>
                  <Option value="Local File Base">Local File Base</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="lastPeriodicReviewDate"
                label="Last Periodic Review Date"
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="adminGroups" label="Admin Groups">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Select admin groups"
                >
                  {allGroups.map(g => (
                    <Option key={g.id} value={g.id}>{g.groupName}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
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
                      <Tag key={role} closable onClose={() => removeRole(role)}>
                        {role}
                      </Tag>
                    ))}
                  </Space>
                </Space>
              </Form.Item>
            </Col>
            <Col span={12}>
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
                      <Tag key={group} closable onClose={() => removeGroup(group)}>
                        {group}
                      </Tag>
                    ))}
                  </Space>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default ApplicationList;