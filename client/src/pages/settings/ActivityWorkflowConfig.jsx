import React, { useEffect, useState } from 'react';
import { Card, Table, Switch, message, Checkbox } from 'antd';
import activityWorkflowService from '../../services/activityWorkflowService';
import masterActivityService from '../../services/masterActivityService';
import groupService from '../../services/groupService';

const ActivityWorkflowConfig = () => {
  const [activities, setActivities] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [systemGroups, setSystemGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [actRes, wfRes, grpRes] = await Promise.all([
        masterActivityService.getAll(),
        activityWorkflowService.getAll(),
        groupService.getAll(),
      ]);
      // ✅ सभी activities दिखाएँ (active + inactive), ताकि inactive को re-enable कर सकें
      setActivities(actRes.data);
      setWorkflows(wfRes.data);
      setSystemGroups(grpRes.data.map(g => g.groupName));
    } catch (error) {
      message.error('Failed to load data');
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleActive = async (activityName, checked) => {
    try {
      const existing = workflows.find(w => w.activityName === activityName);
      if (existing) {
        await activityWorkflowService.update(existing.id, { isActive: checked });
      } else {
        await activityWorkflowService.create({
          activityName,
          steps: [],
          isActive: checked,
        });
      }
      message.success(`${checked ? 'Activated' : 'Deactivated'} for ${activityName}`);
      fetchData();
    } catch (error) {
      message.error('Failed to update active status');
    }
  };

  const toggleApproverGroup = async (activityName, groupName) => {
    const key = `${activityName}-group-${groupName}`;
    setToggling(prev => ({ ...prev, [key]: true }));

    try {
      let existing = workflows.find(w => w.activityName === activityName);
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
        await activityWorkflowService.update(existing.id, {
          steps,
          isActive,
          auditAction,
          auditGroupName: groupName,
        });
      } else {
        await activityWorkflowService.create({
          activityName,
          steps,
          isActive,
          auditAction,
          auditGroupName: groupName,
        });
      }

      message.success(`Group ${groupName} toggled for ${activityName}`);
      fetchData();
    } catch (error) {
      message.error('Failed to update approver');
    } finally {
      setToggling(prev => ({ ...prev, [key]: false }));
    }
  };

  // Table data
  const tableData = activities.map(activity => {
    const def = workflows.find(w => w.activityName === activity.name);
    const steps = def?.steps || [];
    const assignedGroups = steps.filter(s => s.approverGroup).map(s => s.approverGroup);
    return {
      key: activity.id,
      activityName: activity.name,
      isActive: def ? def.isActive : false,
      assignedGroups,
      workflowId: def?.id,
    };
  });

  const columns = [
    {
      title: 'Activity',
      dataIndex: 'activityName',
      key: 'activityName',
    },
    ...systemGroups.map(group => ({
      title: group,
      key: `group-${group}`,
      render: (_, record) => {
        const isChecked = record.assignedGroups.includes(group);
        const isLoading = toggling[`${record.activityName}-group-${group}`];
        return (
          <Checkbox
            checked={isChecked}
            disabled={isLoading}
            onChange={() => toggleApproverGroup(record.activityName, group)}
          />
        );
      },
    })),
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value, record) => (
        <Switch
          checked={value}
          onChange={(checked) => toggleActive(record.activityName, checked)}
        />
      ),
    },
  ];

  return (
    <Card title="Activity Workflow Configuration">
      <Table
        dataSource={tableData}
        columns={columns}
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
};

export default ActivityWorkflowConfig;