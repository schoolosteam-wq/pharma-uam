// FacilityList.jsx – with permission-based UI controls
import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Modal, Form, Input, Select, Popconfirm, TreeSelect } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import facilityService from '../../services/facilityService';
import { usePermission } from '../../hooks/usePermission';   // <-- new import

const { Option } = Select;

const FacilityList = () => {
  const [treeData, setTreeData] = useState([]);
  const [flatList, setFlatList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFacility, setEditingFacility] = useState(null);
  const [form] = Form.useForm();

  // Permission hooks
  const { canCreate, canEdit, canDelete } = usePermission();   // <-- new

  const fetchFacilities = async () => {
    setLoading(true);
    try {
      const res = await facilityService.getAll();
      const tree = res.data;
      setTreeData(tree);
      const flatten = (nodes) => {
        let list = [];
        nodes.forEach(node => {
          list.push(node);
          if (node.children) list = list.concat(flatten(node.children));
        });
        return list;
      };
      setFlatList(flatten(tree));
    } catch (error) {
      message.error('Failed to fetch facilities');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFacilities();
  }, []);

  const handleAdd = () => {
    setEditingFacility(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingFacility(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      type: record.type,
      status: record.status,
      parentId: record.parentId || undefined,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await facilityService.remove(id);
      message.success('Facility deleted');
      fetchFacilities();
    } catch (error) {
      message.error('Delete failed');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingFacility) {
        await facilityService.update(editingFacility.id, values);
        message.success('Facility updated');
      } else {
        await facilityService.create(values);
        message.success('Facility created');
      }
      setModalVisible(false);
      fetchFacilities();
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Operation failed';
      message.error(msg);
    }
  };

  const getParentTreeData = () => {
    const filterOut = editingFacility ? editingFacility.id : null;
    const filterTree = (nodes) => {
      return nodes
        .filter(node => node.id !== filterOut)
        .map(node => ({
          value: node.id,
          title: `${node.code} - ${node.name}`,
          children: node.children ? filterTree(node.children) : undefined,
        }));
    };
    return filterTree(treeData);
  };

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Location',
      key: 'location',
      render: (_, record) => record.location || '-',   // ✅ स्थान दिखाएँ (फैक्ट्री के लिए)
    },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {canEdit('FACILITY') && (
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          )}
          {canDelete('FACILITY') && (
            <Popconfirm title="Sure to delete?" onConfirm={() => handleDelete(record.id)}>
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
        <h2>Organization</h2>
        {canCreate('FACILITY') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add Facility</Button>
        )}
      </div>
      <Table
        dataSource={treeData}
        columns={columns}
        rowKey="id"
        loading={loading}
        defaultExpandAllRows
        pagination={false}
        expandable={{ childrenColumnName: 'children' }}
      />
      
      <Modal
        title={editingFacility ? 'Edit Facility' : 'Add Facility'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        forceRender
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select>
              {['COMPANY', 'FACTORY', 'UNIT', 'LOCATION', 'DEPARTMENT'].map(t => (
                <Option key={t} value={t}>{t}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select>
              <Option value="ACTIVE">Active</Option>
              <Option value="INACTIVE">Inactive</Option>
            </Select>
          </Form.Item>
          <Form.Item name="parentId" label="Parent Facility">
            <TreeSelect
              treeData={getParentTreeData()}
              placeholder="Select parent"
              treeDefaultExpandAll
              allowClear
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FacilityList;