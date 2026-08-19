// src/pages/settings/WorkflowConfig.jsx – now uses only UAM system groups (dynamic)
import React, { useEffect, useState } from 'react';
import { Card, Table, Switch, message, Checkbox } from 'antd';
import workflowService from '../../services/workflowService';
import groupService from '../../services/groupService';   // to fetch all system groups

const moduleTypes = [
  { key: 'NEW_USER', label: 'New User' },
  { key: 'PASSWORD_RESET', label: 'Password Reset' },
  { key: 'ROLE_CHANGE', label: 'Role Change' },
  { key: 'UNLOCK', label: 'Account Unlock' },
  { key: 'DEACTIVATE', label: 'Account Deactivate' },
  { key: 'REACTIVATE', label: 'Account Reactivate' },
];

const WorkflowConfig = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState({});

  // Dynamic system groups from DB
  const [systemGroups, setSystemGroups] = useState([]);

  useEffect(() => {
    fetchWorkflows();
    fetchSystemGroups();
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await workflowService.getAll();
      setWorkflows(res.data);
    } catch (error) {
      message.error('Failed to load workflows');
    }
    setLoading(false);
  };

  const fetchSystemGroups = async () => {
    try {
      const res = await groupService.getAll();
      setSystemGroups(res.data.map(g => g.groupName));
    } catch { /* ignore */ }
  };

  const toggleActive = async (record, checked) => {
    try {
      const existing = workflows.find(w => w.moduleType === record.moduleType);
      if (existing) {
        await workflowService.update(existing.id, { isActive: checked });
      } else {
        await workflowService.create({
          moduleType: record.moduleType,
          steps: [],
          isActive: checked,
        });
      }
      message.success(`${checked ? 'Activated' : 'Deactivated'} for ${record.label}`);
      fetchWorkflows();
    } catch (error) {
      message.error('Failed to update active status');
    }
  };

  // Toggle a single system group for a request type
  const toggleApproverGroup = async (record, groupName) => {
    const key = `${record.moduleType}-group-${groupName}`;
    setToggling(prev => ({ ...prev, [key]: true }));

    try {
      let existing = workflows.find(w => w.moduleType === record.moduleType);
      let steps = existing?.steps ? [...existing.steps] : [];
      let auditAction = '';

      const groupIndex = steps.findIndex(s => s.approverGroup === groupName);
      if (groupIndex >= 0) {
        steps.splice(groupIndex, 1);
        auditAction = 'removed';
      } else {
        steps.push({
          step: steps.length + 1,
          name: `${groupName} Approval`,
          approverRole: '',
          approverGroup: groupName,
          canReturn: false,
        });
        steps = steps.map((s, idx) => ({ ...s, step: idx + 1 }));
        auditAction = 'added';
      }

      const isActive = existing ? existing.isActive : true;

      if (existing) {
        await workflowService.update(existing.id, {
          steps,
          isActive,
          auditAction,           // ← ये भेजना ज़रूरी है
          auditGroupName: groupName,  // ← ये भी
        });
      } else {
        await workflowService.create({
          moduleType: record.moduleType,
          steps,
          isActive,
          auditAction,
          auditGroupName: groupName,
        });
      }

      message.success(`Group ${groupName} toggled for ${record.label}`);
      fetchWorkflows();
    } catch (error) {
      message.error('Failed to update approver');
    } finally {
      setToggling(prev => ({ ...prev, [key]: false }));
    }
  };

  // Build table data
  const tableData = moduleTypes.map(type => {
    const def = workflows.find(w => w.moduleType === type.key);
    const steps = def?.steps || [];
    const assignedGroups = steps
      .filter(s => s.approverGroup)
      .map(s => s.approverGroup);

    return {
      moduleType: type.key,
      label: type.label,
      isActive: def ? def.isActive : false,
      id: def ? def.id : null,
      assignedGroups,
    };
  });

  // Dynamic columns: Request Type + each group as a checkbox
  const columns = [
    { title: 'Request Type', dataIndex: 'label', key: 'label' },
    ...systemGroups.map(group => ({
      title: group,
      key: `group-${group}`,
      render: (_, record) => {
        const isChecked = record.assignedGroups.includes(group);
        const isLoading = toggling[`${record.moduleType}-group-${group}`];
        return (
          <Checkbox
            checked={isChecked}
            disabled={isLoading}
            onChange={() => toggleApproverGroup(record, group)}
          />
        );
      },
    })),
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value, record) => (
        <Switch checked={value} onChange={(checked) => toggleActive(record, checked)} />
      ),
    },
  ];

  return (
    <Card title="Workflow Configuration">
      <Table
        dataSource={tableData}
        columns={columns}
        rowKey="moduleType"
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
};

export default WorkflowConfig;