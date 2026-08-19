import React, { useEffect, useState } from 'react';
import { Card, Select, Button, message, Table, Space } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import applicationService from '../../services/applicationService';
import groupService from '../../services/groupService';
import applicationAdminGroupService from '../../services/applicationAdminGroupService';

const { Option } = Select;

const ApplicationAdminGroups = () => {
  const [applications, setApplications] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState({});   // { appId: groupIds }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appRes, groupRes] = await Promise.all([
        applicationService.getAll(),
        groupService.getAll(),
      ]);
      setApplications(appRes.data);
      setGroups(groupRes.data);

      // Load existing mappings
      const mapping = {};
      for (const app of appRes.data) {
        const adminRes = await applicationAdminGroupService.getAdminGroups(app.id);
        mapping[app.id] = adminRes.data.map(g => g.id);
      }
      setSelectedGroups(mapping);
    } catch { message.error('Failed to load data'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (appId) => {
    setSaving(prev => ({ ...prev, [appId]: true }));
    try {
      await applicationAdminGroupService.saveAdminGroups(appId, selectedGroups[appId] || []);
      message.success('Admin groups saved');
      fetchData();
    } catch { message.error('Save failed'); }
    setSaving(prev => ({ ...prev, [appId]: false }));
  };

  const columns = [
    { title: 'Application', dataIndex: 'name' },
    {
      title: 'Admin Groups',
      render: (_, record) => (
        <Select
          mode="multiple"
          style={{ width: 300 }}
          placeholder="Select groups"
          value={selectedGroups[record.id] || []}
          onChange={(vals) => setSelectedGroups(prev => ({ ...prev, [record.id]: vals }))}
          allowClear
        >
          {groups.map(g => <Option key={g.id} value={g.id}>{g.groupName}</Option>)}
        </Select>
      ),
    },
    {
      title: 'Action',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving[record.id]}
          onClick={() => handleSave(record.id)}
        >
          Save
        </Button>
      ),
    },
  ];

  return (
    <Card title="Application Admin Groups">
      <Table dataSource={applications} columns={columns} rowKey="id" loading={loading} pagination={false} />
    </Card>
  );
};

export default ApplicationAdminGroups;