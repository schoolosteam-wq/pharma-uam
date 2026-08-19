import React, { useEffect, useState } from 'react';
import {
  Table, Button, Space, message, Modal, Form, Input, Select,
  Popconfirm, TreeSelect, Row, Col, Radio, Switch,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,   // ✅ Added
} from '@ant-design/icons';
import computerService from '../../services/computerService';
import instrumentService from '../../services/instrumentService';
import applicationService from '../../services/applicationService';
import facilityService from '../../services/facilityService';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';

const { Option } = Select;

const ComputerList = () => {
  const [data, setData] = useState([]);
  const [instruments, setInstruments] = useState([]);
  const [applications, setApplications] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [appMode, setAppMode] = useState('Single');

  // Permission hooks
  const { canCreate, canEdit, canDelete } = usePermission();
  const { permissions } = useAuth();

  const hasBulkUploadPermission = permissions.includes('MANAGE_COMPUTER_BULK_UPLOAD');

  // ---------- Data fetching ----------
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
      const [instRes, appRes, facRes, deptRes] = await Promise.all([
        instrumentService.getAll(),
        applicationService.getAll(),
        facilityService.getAll(),
        facilityService.getByType('DEPARTMENT'),
      ]);
      setInstruments(instRes.data);
      setApplications(appRes.data);

      const flattenFac = (nodes) => {
        let list = [];
        nodes.forEach((node) => {
          if (node.type === 'FACTORY') {
            list.push({ id: node.id, name: node.name, code: node.code });
          }
          if (node.children) list = list.concat(flattenFac(node.children));
        });
        return list;
      };
      setFacilities(flattenFac(facRes.data));
      setDepartments(deptRes.data || []);
    } catch (error) {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchData();
    fetchDropdowns();
  }, []);

  // ---------- Utility ----------
  const buildFacilityTree = (list) =>
    list.map((item) => ({
      value: item.id,
      title: `${item.code} - ${item.name}`,
    }));

  // ---------- Sample CSV download handler (NEW) ----------
  const handleDownloadSample = async () => {
    try {
      const res = await computerService.downloadSampleCsv();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sample_computers.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      message.error('Sample download failed');
    }
  };

  // ---------- Modal handlers ----------
  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setAppMode('Single');
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      hostname: record.hostname,
      computerMakeModel: record.computerMakeModel,
      serialNumber: record.serialNumber,
      assetCode: record.assetCode,
      osVersion: record.osVersion,
      antivirusStatus: record.antivirusStatus,
      domainStatus: record.domainStatus,
      systemOwner: record.systemOwner,
      csvDone: record.csvDone,
      location: record.location,
      ipAddress: record.ipAddress,
      status: record.status,
      instrumentIds: record.instruments?.map((i) => i.id) || [],
      applicationIds: record.applications?.map((a) => a.id) || [],
      facilityId: record.facility?.id || undefined,
      departmentId: record.department?.id || undefined,
    });
    setAppMode(record.applications?.length > 1 ? 'Multi' : 'Single');
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await computerService.remove(id);
      message.success('Deleted');
      fetchData();
    } catch {
      message.error('Delete failed');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        hostname: values.hostname,
        computerMakeModel: values.computerMakeModel,
        serialNumber: values.serialNumber,
        assetCode: values.assetCode || null,
        osVersion: values.osVersion || null,
        antivirusStatus: values.antivirusStatus || 'Not Installed',
        domainStatus: values.domainStatus || 'Workgroup',
        systemOwner: values.systemOwner || null,
        csvDone: values.csvDone ?? false,
        location: values.location || null,
        ipAddress: values.ipAddress || null,
        status: values.status || 'ACTIVE',
        instrumentIds: values.instrumentIds || [],
        applicationIds: values.applicationIds || [],
        facilityId: values.facilityId || null,
        departmentId: values.departmentId || null,
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

  // ---------- Table columns ----------
  const columns = [
    { title: 'Hostname', dataIndex: 'hostname' },
    { title: 'Make & Model', dataIndex: 'computerMakeModel' },
    { title: 'Serial Number', dataIndex: 'serialNumber' },
    { title: 'IP Address', dataIndex: 'ipAddress' },
    { title: 'Status', dataIndex: 'status' },
    {
      title: 'Connected Applications',
      render: (_, record) =>
        record.applications?.map((a) => a.name).join(', ') || '-',
    },
    {
      title: 'Connected Instruments',
      render: (_, record) =>
        record.instruments?.map((i) => `${i.make} ${i.model}`).join(', ') || '-',
    },
    { title: 'Department', render: (_, rec) => rec.department?.name || '-' },
    { title: 'Facility', render: (_, rec) => rec.facility?.name || '-' },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          {canEdit('COMPUTER') && (
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
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

  // ---------- Render ----------
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Computers</h2>
        <Space>
          {hasBulkUploadPermission && (
            <>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadSample}>
                Sample CSV
              </Button>
              <Button
                icon={<UploadOutlined />}
                onClick={() => navigate('/computers/csv')}
              >
                Bulk Upload
              </Button>
            </>
          )}
          {canCreate('COMPUTER') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Add Computer
            </Button>
          )}
        </Space>
      </div>

      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} />

      {/* ---------- Modal ---------- */}
      <Modal
        title={editing ? 'Edit Computer' : 'Add Computer'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={800}
        forceRender
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="hostname"
                label="Hostname"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="computerMakeModel"
                label="Computer Make & Model"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="serialNumber"
                label="Serial Number"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="assetCode" label="Asset Code">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="osVersion" label="OS Version">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ipAddress" label="IP Address">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="antivirusStatus" label="Antivirus Status">
                <Select>
                  <Option value="Installed">Installed</Option>
                  <Option value="Not Installed">Not Installed</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="domainStatus" label="Domain Status">
                <Select>
                  <Option value="Workgroup">Workgroup</Option>
                  <Option value="AD Joined">AD Joined</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="systemOwner" label="System Owner">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="csvDone" label="CSV Done" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="location" label="Location">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="departmentId" label="Department">
                <Select placeholder="Select department" allowClear>
                  {departments.map((d) => (
                    <Option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </Option>
                  ))}
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
              <Form.Item name="status" label="Status" initialValue="ACTIVE">
                <Select>
                  <Option value="ACTIVE">Active</Option>
                  <Option value="INACTIVE">Inactive</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Application Selection Mode */}
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="Application Selection Mode">
                <Radio.Group
                  value={appMode}
                  onChange={(e) => setAppMode(e.target.value)}
                >
                  <Radio value="Single">Single Application</Radio>
                  <Radio value="Multi">Multiple Applications</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          {appMode === 'Single' ? (
            <Form.Item
              name="applicationIds"
              label="Application"
              rules={[{ required: false }]}
            >
              <Select placeholder="Select application" allowClear>
                {applications.map((a) => (
                  <Option key={a.id} value={a.id}>
                    {a.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item name="applicationIds" label="Applications">
              <Select mode="multiple" placeholder="Select applications" allowClear>
                {applications.map((a) => (
                  <Option key={a.id} value={a.id}>
                    {a.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="instrumentIds" label="Connected Instruments">
            <Select mode="multiple" placeholder="Select instruments" allowClear>
              {instruments.map((i) => (
                <Option key={i.id} value={i.id}>
                  {i.instrumentId} - {i.make} {i.model}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ComputerList;