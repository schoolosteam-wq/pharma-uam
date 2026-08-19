import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Button, Space, message, Modal, Form, Input, Select, Popconfirm, TreeSelect } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import facilityService from '../../services/facilityService';
import { usePermission } from '../../hooks/usePermission';

const { Option } = Select;

const typeLabels = {
  COMPANY: 'Company',
  FACTORY: 'Factory',
  UNIT: 'Unit',
  DEPARTMENT: 'Department',
};

// प्रत्येक प्रकार के लिए वैध माता-पिता (LOCATION हटने से DEPARTMENT का पैरेंट UNIT होगा)
const validParentType = {
  COMPANY: null,
  FACTORY: 'COMPANY',
  UNIT: 'FACTORY',
  DEPARTMENT: 'UNIT',     // ✅ अब सीधे UNIT के नीचे
};

const FacilityTypeList = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const { canCreate, canEdit, canDelete } = usePermission();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await facilityService.getByType(type);
      setData(res.data);
    } catch (error) {
      message.error(`Failed to fetch ${typeLabels[type] || type}`);
    }
    setLoading(false);
  };

  const fetchParents = async () => {
    try {
      const res = await facilityService.getAll();
      const flatten = (nodes) => {
        let list = [];
        nodes.forEach(node => {
          list.push(node);
          if (node.children) list = list.concat(flatten(node.children));
        });
        return list;
      };
      setParents(flatten(res.data));
    } catch (error) { /* ignore */ }
  };

  useEffect(() => {
    fetchData();
    fetchParents();
  }, [type]);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();

    // ✅ Sequential code generation
    const prefixMap = {
      COMPANY: 'C',
      FACTORY: 'F',
      UNIT: 'U',
      DEPARTMENT: 'D',
    };
    const prefix = prefixMap[type] || 'X';

    // मौजूदा data से same prefix वाले codes निकालो
    const existingCodes = data
      .map((item) => item.code || '')
      .filter((code) => code.startsWith(prefix));

    // Max numeric suffix निकालो
    let maxNum = 0;
    existingCodes.forEach((code) => {
      const numStr = code.replace(prefix, '').replace(/^0+/, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    const nextCode = `${prefix}${String(nextNum).padStart(3, '0')}`; // e.g., C001, F001

    form.setFieldsValue({
      type: type,
      status: 'ACTIVE',
      code: nextCode,
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      status: record.status,
      parentId: record.parentId || undefined,
      location: record.location || '',   // ✅ स्थान दिखाएँ
      type: record.type,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await facilityService.remove(id);
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
        ...values,
        type: type,
      };
      if (editing) {
        await facilityService.update(editing.id, payload);
        message.success('Updated');
      } else {
        await facilityService.create(payload);
        message.success('Created');
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Operation failed';
      message.error(msg);
    }
  };

  const parentType = validParentType[type];
  const filteredParents = parentType
    ? parents.filter(p => p.type === parentType)
    : [];

  const parentTreeData = filteredParents
    .filter(p => p.id !== editing?.id)
    .map(p => ({
      value: p.id,
      title: `${p.code} - ${p.name}`,
    }));

  // ✅ कॉलम: FACTORY होने पर Location दिखाएँ
  const columns = [
    { title: 'Code', dataIndex: 'code' },
    { title: 'Name', dataIndex: 'name' },
    ...(type === 'FACTORY' ? [{ title: 'Location', dataIndex: 'location', render: (text) => text || '-' }] : []),
    { title: 'Status', dataIndex: 'status' },
    { title: 'Parent', render: (_, record) => record.parentName || record.parent?.name || '-' },
    {
      title: 'Actions',
      render: (_, record) => (
        <Space>
          {canEdit('FACILITY') && (
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          )}
          {canDelete('FACILITY') && (
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
        <h2>{typeLabels[type] || type} Management</h2>
        {canCreate('FACILITY') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add {typeLabels[type]}</Button>
        )}
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={false} />

      <Modal
        title={editing ? `Edit ${typeLabels[type]}` : `Add ${typeLabels[type]}`}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        forceRender
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          {/* ✅ स्थान फ़ील्ड केवल FACTORY के लिए */}
          {type === 'FACTORY' && (
            <Form.Item name="location" label="Location">
              <Input placeholder="Enter factory location" />
            </Form.Item>
          )}
          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select>
              <Option value="ACTIVE">Active</Option>
              <Option value="INACTIVE">Inactive</Option>
            </Select>
          </Form.Item>
          {parentType && (
            <Form.Item name="parentId" label="Parent">
              <TreeSelect
                treeData={parentTreeData}
                placeholder="Select parent"
                treeDefaultExpandAll
                allowClear
              />
            </Form.Item>
          )}
          <Form.Item name="type" hidden><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FacilityTypeList;