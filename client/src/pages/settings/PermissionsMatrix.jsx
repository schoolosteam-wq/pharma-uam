import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Table, Checkbox, Button, message, Card, Spin, Modal, Input, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import roleService from '../../services/roleService';

const ALL_PERMISSIONS = [
  "CREATE_USER", "EDIT_USER", "DELETE_USER", "VIEW_USER",
  "CREATE_FACILITY", "EDIT_FACILITY", "DELETE_FACILITY", "VIEW_FACILITY",
  "MANAGE_ROLES", "MANAGE_GROUPS",
  "CREATE_APPLICATION", "EDIT_APPLICATION", "DELETE_APPLICATION", "VIEW_APPLICATION",
  "CREATE_INSTRUMENT", "EDIT_INSTRUMENT", "DELETE_INSTRUMENT", "VIEW_INSTRUMENT",
  "CREATE_COMPUTER", "EDIT_COMPUTER", "DELETE_COMPUTER", "VIEW_COMPUTER",
  "APPROVE_REQUEST", "RETURN_REQUEST", "REJECT_REQUEST", "VIEW_REQUEST",
  "MANAGE_WORKFLOW",
  "VIEW_AUDIT",
  "MANAGE_APPLICATION_BULK_UPLOAD",
  "MANAGE_INSTRUMENT_BULK_UPLOAD",
  "MANAGE_COMPUTER_BULK_UPLOAD",
  "MANAGE_ACTIVE_USER_BULK_UPLOAD"
];

const PermissionsMatrix = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});

  // ** Ref for permissions map – always up‑to‑date **
  const permissionsMapRef = useRef({});   // { [roleId]: Set }

  // Add role modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [adding, setAdding] = useState(false);

  // Fetch roles and initialize the ref map
  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await roleService.getAll();
      const sortedRoles = res.data.sort((a, b) => a.id - b.id);  // <-- id के अनुसार छाँटें
      setRoles(sortedRoles);

      const map = {};
      sortedRoles.forEach(role => {
        const permNames = (role.permissions || []).map(p => p.permissionName);
        map[role.id] = new Set(permNames);
      });
      permissionsMapRef.current = map;
    } catch (error) {
      message.error('Failed to load roles');
    }
    setLoading(false);
  };
  
    useEffect(() => {
    fetchRoles();
  }, []);

  // Checkbox change – directly update ref and force re‑render via state
  const handlePermissionChange = useCallback((roleId, permission, checked) => {
    const map = permissionsMapRef.current;
    if (!map[roleId]) map[roleId] = new Set();
    if (checked) {
      map[roleId].add(permission);
    } else {
      map[roleId].delete(permission);
    }
    // Force re‑render to update checkboxes (simple trick: update roles state)
    setRoles(prev => [...prev]);   // shallow copy triggers re‑render
  }, []);

  // Save permissions – reads latest from ref, so always correct
  const saveRolePermissions = async (roleId) => {
    const permSet = permissionsMapRef.current[roleId];
    const permissionNames = permSet ? Array.from(permSet) : [];
    console.log('Saving permissions for role', roleId, permissionNames);

    setSaving(prev => ({ ...prev, [roleId]: true }));
    try {
      await roleService.updatePermissions(roleId, permissionNames);
      message.success('Permissions saved');
    } catch (error) {
      message.error('Failed to save permissions');
    } finally {
      setSaving(prev => ({ ...prev, [roleId]: false }));
    }
  };

  // Add new role
  const handleAddRole = async () => {
    if (!newRoleName.trim()) {
      message.warning('Please enter a role name');
      return;
    }
    setAdding(true);
    try {
      await roleService.create({ roleName: newRoleName.trim(), description: newRoleDesc.trim() });
      message.success('Role created');
      setAddModalVisible(false);
      setNewRoleName('');
      setNewRoleDesc('');
      fetchRoles();   // refresh list and map
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to create role');
    } finally {
      setAdding(false);
    }
  };

  // Delete role
  const handleDeleteRole = async (roleId) => {
    try {
      await roleService.remove(roleId);
      message.success('Role deleted');
      fetchRoles();
    } catch (error) {
      message.error('Failed to delete role');
    }
  };

  // Build table data from ref (not from roles state, to avoid inconsistency)
  const dataSource = roles.map(role => ({
    key: role.id,
    roleName: role.roleName,
    isSystem: role.isSystem,
    roleId: role.id,
    permissions: Array.from(permissionsMapRef.current[role.id] || []),
  }));

  const columns = [
    {
      title: 'Role',
      dataIndex: 'roleName',
      key: 'roleName',
      fixed: 'left',
      width: 180,
    },
    ...ALL_PERMISSIONS.map(perm => ({
      title: perm.replace(/_/g, ' '),
      key: perm,
      width: 100,
      render: (_, record) => (
        <Checkbox
          checked={record.permissions.includes(perm)}
          disabled={record.isSystem}
          onChange={e => handlePermissionChange(record.roleId, perm, e.target.checked)}
        />
      ),
    })),
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            loading={saving[record.roleId]}
            disabled={record.isSystem}
            onClick={() => saveRolePermissions(record.roleId)}
          >
            Save
          </Button>
          {!record.isSystem && (
            <Popconfirm
              title="Are you sure you want to delete this role?"
              onConfirm={() => handleDeleteRole(record.roleId)}
            >
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Roles & Permissions"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
          Add Role
        </Button>
      }
    >
      <Spin spinning={loading}>
        <Table
          dataSource={dataSource}
          columns={columns}
          scroll={{ x: 'max-content' }}
          pagination={false}
          bordered
        />
      </Spin>

      <Modal
        title="Add New Role"
        open={addModalVisible}
        onOk={handleAddRole}
        onCancel={() => {
          setAddModalVisible(false);
          setNewRoleName('');
          setNewRoleDesc('');
        }}
        confirmLoading={adding}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="Role name"
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
          />
          <Input
            placeholder="Description (optional)"
            value={newRoleDesc}
            onChange={e => setNewRoleDesc(e.target.value)}
          />
        </Space>
      </Modal>
    </Card>
  );
};

export default PermissionsMatrix;