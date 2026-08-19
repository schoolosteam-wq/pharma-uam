import React, { useEffect, useState } from 'react';
import {
  Table, Button, Space, message, Modal, Form, Input, Select,
  Popconfirm, TreeSelect, Row, Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import instrumentService from '../../services/instrumentService';
import applicationService from '../../services/applicationService';
import computerService from '../../services/computerService';
import facilityService from '../../services/facilityService';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../context/AuthContext';

const { Option } = Select;
const { TextArea } = Input;

const InstrumentList = () => {
  const [data, setData] = useState([]);
  const [apps, setApps] = useState([]);
  const [computers, setComputers] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // Permission hooks
  const { canCreate, canEdit, canDelete } = usePermission();
  const { permissions } = useAuth();

  const hasBulkUploadPermission = permissions.includes('MANAGE_INSTRUMENT_BULK_UPLOAD');

  // ---------- Data fetching ----------
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
      const [appsRes, compRes, facRes, deptRes] = await Promise.all([
        applicationService.getAll(),
        computerService.getAll(),
        facilityService.getAll(),
        facilityService.getByType('DEPARTMENT'),
      ]);
      setApps(appsRes.data);
      setComputers(compRes.data);

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
      const res = await instrumentService.downloadSampleCsv();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sample_instruments.csv');
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
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      instrumentId: record.instrumentId,
      assetCode: record.assetCode,
      instrumentType: record.instrumentType,
      make: record.make,
      model: record.model,
      serialNumber: record.serialNumber,
      oemDetails: record.oemDetails ? JSON.stringify(record.oemDetails, null, 2) : '',
      status: record.status,
      applicationId: record.applicationId || undefined,
      currentLocation: record.currentLocation,
      departmentId: record.department?.id || undefined,
      connectionStatus: record.connectionStatus,
      computerIds: record.computers?.map((c) => c.id) || [],
      facilityId: record.facility?.id || undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await instrumentService.remove(id);
      message.success('Deleted');
      fetchData();
    } catch {
      message.error('Delete failed');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Parse OEM Details JSON
      let oemDetails = {};
      if (values.oemDetails) {
        try {
          oemDetails = JSON.parse(values.oemDetails);
        } catch (e) {
          message.error('Invalid JSON in OEM Details');
          return;
        }
      }

      const payload = {
        instrumentId: values.instrumentId,
        assetCode: values.assetCode || null,
        instrumentType: values.instrumentType || null,
        make: values.make || null,
        model: values.model || null,
        serialNumber: values.serialNumber,
        oemDetails,
        status: values.status || 'ACTIVE',
        applicationId: values.applicationId || null,
        currentLocation: values.currentLocation || null,
        departmentId: values.departmentId || null,
        connectionStatus: values.connectionStatus || 'Standalone',
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

  // ---------- Table columns ----------
  const columns = [
    { title: 'Instrument ID', dataIndex: 'instrumentId' },
    { title: 'Asset Code', dataIndex: 'assetCode' },
    { title: 'Make', dataIndex: 'make' },
    { title: 'Model', dataIndex: 'model' },
    { title: 'Serial Number', dataIndex: 'serialNumber' },
    { title: 'Status', dataIndex: 'status' },
    {
      title: 'Application',
      render: (_, record) => record.application?.name || '-',
    },
    {
      title: 'Connected Computers',
      render: (_, record) =>
        record.computers?.map((c) => c.computerMakeModel).join(', ') || '-',
    },
    { title: 'Department', render: (_, rec) => rec.department?.name || '-' },
    { title: 'Facility', render: (_, rec) => rec.facility?.name || '-' },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          {canEdit('INSTRUMENT') && (
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
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

  // ---------- Render ----------
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>Instruments</h2>
        <Space>
          {hasBulkUploadPermission && (
            <>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadSample}>
                Sample CSV
              </Button>
              <Button
                icon={<UploadOutlined />}
                onClick={() => navigate('/instruments/csv')}
              >
                Bulk Upload
              </Button>
            </>
          )}
          {canCreate('INSTRUMENT') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Add Instrument
            </Button>
          )}
        </Space>
      </div>

      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} />

      {/* ---------- Modal ---------- */}
      <Modal
        title={editing ? 'Edit Instrument' : 'Add Instrument'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={700}
        forceRender
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="instrumentId"
                label="Instrument ID"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="assetCode" label="Asset Code">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="instrumentType" label="Instrument Type">
                <Select allowClear placeholder="Select type">
                  <Option value="Chromatography">Chromatography</Option>
                  <Option value="Spectroscopy">Spectroscopy</Option>
                  <Option value="Balances">Balances</Option>
                  <Option value="Other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="make" label="Make">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="model" label="Model">
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

          <Form.Item name="oemDetails" label="OEM Details">
            <TextArea rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="status" label="Status" initialValue="ACTIVE">
                <Select>
                  <Option value="ACTIVE">Active</Option>
                  <Option value="RETIRED">Retired</Option>
                  <Option value="TRANSFERRED">Transferred</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="connectionStatus"
                label="Connection Status"
                initialValue="Standalone"
              >
                <Select>
                  <Option value="Standalone">Standalone</Option>
                  <Option value="Networked">Networked</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="applicationId" label="Application">
                <Select allowClear placeholder="Select application">
                  {apps.map((app) => (
                    <Option key={app.id} value={app.id}>
                      {app.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
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
            <Col span={8}>
              <Form.Item name="currentLocation" label="Current Location">
                <Input />
              </Form.Item>
            </Col>
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
          </Row>

          <Form.Item name="computerIds" label="Connected Computers">
            <Select mode="multiple" placeholder="Select computers" allowClear>
              {computers.map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.computerMakeModel}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InstrumentList;