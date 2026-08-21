import React, { useEffect, useState } from 'react';
import { Card, Select, Checkbox, Button, message, Divider } from 'antd';
import applicationService from '../../services/applicationService';
import masterActivityService from '../../services/masterActivityService';
import applicationActivityService from '../../services/applicationActivityService';

const { Option } = Select;

// fixed request types (जो पहले से सिस्टम में हैं)
const FIXED_TYPES = ['NEW_USER', 'PASSWORD_RESET', 'ROLE_CHANGE', 'UNLOCK', 'DEACTIVATE', 'REACTIVATE', 'FACILITY_ACCESS'];

const ApplicationActivityMapping = () => {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [masterActivities, setMasterActivities] = useState([]);
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchApplications();
    fetchMasterActivities();
  }, []);

  const fetchApplications = async () => {
    try {
      const res = await applicationService.getAll();
      setApplications(res.data);
    } catch { /* ignore */ }
  };

  const fetchMasterActivities = async () => {
    try {
      const res = await masterActivityService.getAll();
      setMasterActivities(res.data.filter(a => a.isActive));
    } catch { /* ignore */ }
  };

  const handleAppChange = async (appId) => {
    setSelectedApp(appId);
    if (!appId) {
      setSelectedActivities([]);
      return;
    }
    setLoading(true);
    try {
      const res = await applicationActivityService.getActivities(appId);
      setSelectedActivities(res.data || []);
    } catch { message.error('Failed to load activities'); }
    setLoading(false);
  };

  const handleCheckboxChange = (activityName, checked) => {
    setSelectedActivities(prev => {
      if (checked) return [...prev, activityName];
      return prev.filter(a => a !== activityName);
    });
  };

  const handleSave = async () => {
    if (!selectedApp) { message.warning('Select an application'); return; }
    setSaving(true);
    try {
      await applicationActivityService.saveActivities(selectedApp, selectedActivities);
      message.success('Mapping saved');
    } catch { message.error('Save failed'); }
    setSaving(false);
  };

  // सभी उपलब्ध activities = fixed types + active master activities (unique)
  const allActivityNames = [...new Set([...FIXED_TYPES, ...masterActivities.map(a => a.name)])];

  return (
    <Card title="Application Activity Mapping">
      <Select
        placeholder="Select Application"
        style={{ width: 300, marginBottom: 16 }}
        onChange={handleAppChange}
        allowClear
        value={selectedApp}
      >
        {applications.map(app => <Option key={app.id} value={app.id}>{app.name}</Option>)}
      </Select>

      {selectedApp && (
        <>
          <Divider>Select Activities for this Application</Divider>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {allActivityNames.map(name => (
              <Checkbox
                key={name}
                checked={selectedActivities.includes(name)}
                onChange={e => handleCheckboxChange(name, e.target.checked)}
              >
                {name.replace(/_/g, ' ')}
              </Checkbox>
            ))}
          </div>
          <Button type="primary" onClick={handleSave} loading={saving} style={{ marginTop: 16 }}>
            Save Mapping
          </Button>
        </>
      )}
    </Card>
  );
};

export default ApplicationActivityMapping;