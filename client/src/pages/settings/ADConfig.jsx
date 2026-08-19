// src/pages/settings/ADConfig.jsx – Complete with OU Mapping UI
import React, { useEffect, useState, useCallback } from 'react';
import { Form, Input, Button, Switch, Card, message, Spin, InputNumber, Space, Divider, Table, Select } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import settingsService from '../../services/settingsService';
import facilityService from '../../services/facilityService';

const { Option } = Select;

const ADConfig = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // ---------- OU Mapping state ----------
  const [ouMapping, setOUMapping] = useState([]);          // array of { ou, facilityId }
  const [allFacilities, setAllFacilities] = useState([]);  // flat list for facility dropdown

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settingsService.getADConfig();
      form.setFieldsValue(res.data);
    } catch (error) {
      message.error('Failed to load AD configuration');
    }
    setLoading(false);
  }, [form]);   // No dependencies, form/setLoading/message are stable

  // ✅ fetchOUMapping को useCallback में wrap किया
  const fetchOUMapping = useCallback(async () => {
    try {
      const res = await settingsService.getOUMapping();
      const map = res.data || {};
      const arr = Object.entries(map).map(([ou, facilityId]) => ({ ou, facilityId }));
      setOUMapping(arr);
    } catch (e) {
      message.error('Failed to load OU mapping');
    }
  }, []);

  // ✅ fetchFacilities को useCallback में wrap किया
  const fetchFacilities = useCallback(async () => {
    try {
      const res = await facilityService.getAll();
      const flatten = (nodes) => {
        let list = [];
        nodes.forEach(node => {
          if (node.type === 'FACTORY') {
            list.push({ id: node.id, name: node.name, code: node.code });
          }
          if (node.children) list = list.concat(flatten(node.children));
        });
        return list;
      };
      setAllFacilities(flatten(res.data));
    } catch (e) { /* ignore */ }
  }, []);

  // ✅ useEffect में stable functions को dependencies में add किया
  useEffect(() => {
    fetchConfig();
    fetchOUMapping();
    fetchFacilities();
  }, [fetchConfig, fetchOUMapping, fetchFacilities]);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await settingsService.testADConnection();
      if (res.data.success) {
        message.success(res.data.message);
      } else {
        message.error(res.data.message);
      }
    } catch (error) {
      message.error('Connection test failed');
    }
    setTesting(false);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      await settingsService.saveADConfig(values);
      message.success('AD configuration saved');
    } catch (error) {
      message.error('Failed to save AD configuration');
    }
    setSaving(false);
  };

  // ---------- OU Mapping handlers ----------
  const addOU = () => {
    setOUMapping([...ouMapping, { ou: '', facilityId: null }]);
  };

  const removeOU = (index) => {
    const newList = ouMapping.filter((_, i) => i !== index);
    setOUMapping(newList);
  };

  const updateOU = (index, field, value) => {
    const newList = [...ouMapping];
    newList[index][field] = value;
    setOUMapping(newList);
  };

  const saveOUMapping = async () => {
    const obj = {};
    ouMapping.forEach(item => {
      if (item.ou && item.facilityId) {
        obj[item.ou] = item.facilityId;
      }
    });
    try {
      await settingsService.saveOUMapping(obj);
      message.success('OU Mapping saved');
    } catch (e) {
      message.error('Failed to save OU mapping');
    }
  };

  return (
    <Card title="Active Directory Configuration" style={{ maxWidth: 700, margin: '0 auto' }}>
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="ad_enabled" label="Enable AD Sync" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="ad_url" label="LDAP URL (e.g. ldap://dc.company.com)">
            <Input />
          </Form.Item>
          <Form.Item name="ad_baseDN" label="Base DN (e.g. dc=company,dc=com)">
            <Input />
          </Form.Item>
          <Form.Item name="ad_domain" label="AD Domain (UPN Suffix, e.g. company.com)">
            <Input />
          </Form.Item>
          <Form.Item name="ad_username" label="Domain Admin Username">
            <Input />
          </Form.Item>
          <Form.Item name="ad_password" label="Domain Admin Password">
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
          <Form.Item name="ad_syncInterval" label="Sync Interval (hours)">
            <InputNumber min={1} max={168} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>Save Configuration</Button>
              <Button onClick={handleTestConnection} loading={testing}>Check Connection</Button>
            </Space>
          </Form.Item>
        </Form>

        {/* ---------- OU to Facility Mapping ---------- */}
        <Divider>OU to Facility Mapping</Divider>
        <Button onClick={addOU} icon={<PlusOutlined />} style={{ marginBottom: 8 }}>Add OU</Button>
        <Table
          dataSource={ouMapping}
          rowKey={(record, index) => index}
          pagination={false}
          size="small"
        >
          <Table.Column
            title="OU Name"
            dataIndex="ou"
            render={(text, record, index) => (
              <Input
                placeholder="e.g. Quality Control"
                value={text}
                onChange={e => updateOU(index, 'ou', e.target.value)}
              />
            )}
          />
          <Table.Column
            title="Facility"
            dataIndex="facilityId"
            render={(text, record, index) => (
              <Select
                style={{ width: '100%' }}
                placeholder="Select facility"
                value={text}
                onChange={value => updateOU(index, 'facilityId', value)}
                allowClear
              >
                {allFacilities.map(f => (
                  <Option key={f.id} value={f.id}>{f.name} ({f.code})</Option>
                ))}
              </Select>
            )}
          />
          <Table.Column
            title=""
            render={(_, __, index) => (
              <Button icon={<DeleteOutlined />} danger size="small" onClick={() => removeOU(index)} />
            )}
          />
        </Table>
        <Button type="primary" onClick={saveOUMapping} style={{ marginTop: 8 }}>Save OU Mapping</Button>
      </Spin>
    </Card>
  );
};

export default ADConfig;