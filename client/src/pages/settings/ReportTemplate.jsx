import React, { useEffect, useState } from 'react';
import {
  Card, Form, Input, Select, Button, Upload, message, Space, Radio, Divider,
  Col, Row, Checkbox, Modal, Switch, Typography,
} from 'antd';
import { UploadOutlined, SaveOutlined, CopyOutlined, EyeOutlined } from '@ant-design/icons';
import facilityService from '../../services/facilityService';
import reportTemplateService from '../../services/reportTemplateService';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

const REPORT_TYPES = [
  { key: 'activeUsers', label: 'Active Users' },
  { key: 'application', label: 'Application' },
  { key: 'instrument', label: 'Instrument' },
  { key: 'computer', label: 'Computer' },
  { key: 'audit', label: 'Audit Trail' },
];

const COLUMN_OPTIONS = {
  activeUsers: [
    { key: 'srNo', label: 'Sr. No.' },
    { key: 'fullName', label: 'User Name' },
    { key: 'employeeId', label: 'Emp Code' },
    { key: 'username', label: 'User ID (Application)' },
    { key: 'roles', label: 'Roles / Groups' },
    { key: 'status', label: 'Status' },
  ],
  application: [
    { key: 'name', label: 'Application Name' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'versionNo', label: 'Version' },
    { key: 'oemContact', label: 'OEM Contact' },
    { key: 'status', label: 'Status' },
    { key: 'facilityName', label: 'Facility' },
    { key: 'departmentName', label: 'Department' },
    { key: 'applicationOwner', label: 'Application Owner' },
    { key: 'gampCategory', label: 'GAMP Category' },
    { key: 'validated', label: 'Validated' },
    { key: 'eresApplicable', label: 'ERES Applicable' },
    { key: 'lastPeriodicReviewDate', label: 'Last Periodic Review Date' },
    { key: 'databaseType', label: 'Database Type' },
    { key: 'auditTrailEnabled', label: 'Audit Trail Enabled' },
    { key: 'applicationCriticality', label: 'Application Criticality' },
    { key: 'roles', label: 'Roles' },
    { key: 'groups', label: 'Groups' },
    { key: 'adminGroups', label: 'Admin Groups' },
  ],
  instrument: [
    { key: 'instrumentId', label: 'Instrument ID' },
    { key: 'assetCode', label: 'Asset Code' },
    { key: 'instrumentType', label: 'Instrument Type' },
    { key: 'make', label: 'Make' },
    { key: 'model', label: 'Model' },
    { key: 'serialNumber', label: 'Serial Number' },
    { key: 'oemDetails', label: 'OEM Details' },
    { key: 'status', label: 'Status' },
    { key: 'applicationName', label: 'Application' },
    { key: 'facilityName', label: 'Facility' },
    { key: 'departmentName', label: 'Department' },
    { key: 'currentLocation', label: 'Current Location' },
    { key: 'connectionStatus', label: 'Connection Status' },
    { key: 'connectedComputers', label: 'Connected Computers' },
  ],
  computer: [
    { key: 'hostname', label: 'Hostname' },
    { key: 'computerMakeModel', label: 'Make & Model' },
    { key: 'serialNumber', label: 'Serial Number' },
    { key: 'assetCode', label: 'Asset Code' },
    { key: 'osVersion', label: 'OS Version' },
    { key: 'antivirusStatus', label: 'Antivirus Status' },
    { key: 'domainStatus', label: 'Domain Status' },
    { key: 'systemOwner', label: 'System Owner' },
    { key: 'csvDone', label: 'CSV Done' },
    { key: 'location', label: 'Location' },
    { key: 'ipAddress', label: 'IP Address' },
    { key: 'status', label: 'Status' },
    { key: 'facilityName', label: 'Facility' },
    { key: 'departmentName', label: 'Department' },
    { key: 'connectedApplications', label: 'Connected Applications' },
    { key: 'connectedInstruments', label: 'Connected Instruments' },
  ],
  audit: [
    { key: 'entityType', label: 'Entity Type' },
    { key: 'action', label: 'Action' },
    { key: 'oldValue', label: 'Old Value' },
    { key: 'newValue', label: 'New Value' },
    { key: 'changedBy', label: 'Performed By' },
    { key: 'ipAddress', label: 'IP Address' },
    { key: 'changedAt', label: 'Date/Time' },
    { key: 'comments', label: 'Comments' },
  ],
};

const sampleDummyRows = {
  activeUsers: [
    { srNo: 1, fullName: 'John Doe', employeeId: 'EMP001', username: 'john.doe', roles: 'Administrator', status: 'Active' },
    { srNo: 2, fullName: 'Jane Smith', employeeId: 'EMP002', username: 'jane.smith', roles: 'Reviewer / G1', status: 'Active' },
  ],
  application: [
    { name: 'Empower', manufacturer: 'Waters', versionNo: '3.0', oemContact: '123', status: 'ACTIVE', facilityName: 'Plant A', departmentName: 'Quality Control', applicationOwner: 'John Doe', gampCategory: '1', validated: 'Yes', eresApplicable: 'Yes', lastPeriodicReviewDate: '2026-01-01', databaseType: 'Oracle', auditTrailEnabled: 'Yes', applicationCriticality: 'High', roles: 'Admin', groups: 'G1', adminGroups: 'IT' },
  ],
  instrument: [
    { instrumentId: 'INS001', assetCode: 'AST001', instrumentType: 'Chromatography', make: 'Waters', model: 'HPLC', serialNumber: 'SN123', oemDetails: '{}', status: 'ACTIVE', applicationName: 'Empower', facilityName: 'Plant A', departmentName: 'Quality Control', currentLocation: 'Lab1', connectionStatus: 'Networked', connectedComputers: 'PC1' },
  ],
  computer: [
    { hostname: 'PC001', computerMakeModel: 'Dell Optiplex', serialNumber: 'SNPC001', assetCode: 'ASTPC001', osVersion: 'Windows 10 Pro', antivirusStatus: 'Installed', domainStatus: 'AD Joined', systemOwner: 'John Doe', csvDone: 'Yes', location: 'Lab1', ipAddress: '192.168.1.100', status: 'ACTIVE', facilityName: 'Plant A', departmentName: 'Quality Control', connectedApplications: 'Empower', connectedInstruments: 'HPLC' },
  ],
  audit: [
    { entityType: 'USER', action: 'CREATED', oldValue: '', newValue: '{}', changedBy: 'Admin', ipAddress: '127.0.0.1', changedAt: '2026-08-18 10:00:00', comments: 'Test' },
  ],
};

const ReportTemplate = () => {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [selectedReportType, setSelectedReportType] = useState('activeUsers');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [logoPath, setLogoPath] = useState(null);
  const [copyFrom, setCopyFrom] = useState(null);
  const [copyTo, setCopyTo] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    try {
      const res = await facilityService.getAllFactories();
      setFacilities(res.data);
    } catch (error) {
      message.error('Failed to load facilities');
    }
  };

  const fetchTemplate = async (facilityId, reportType) => {
    setLoading(true);
    try {
      const res = await reportTemplateService.getTemplate(facilityId, reportType);
      const template = res.data || {};
      form.setFieldsValue({
        companyName: template.companyName || '',
        reportTitle: template.reportTitle || REPORT_TYPES.find(r => r.key === reportType)?.label + ' Report',
        footerText: template.footerText || '',
        logoAlignment: template.logoAlignment || 'LEFT',
        tableColumns: Array.isArray(template.tableColumns)
          ? template.tableColumns
          : COLUMN_OPTIONS[reportType].map(c => c.key),
        orientation: template.orientation || 'PORTRAIT',
        showPreparedBy: template.showPreparedBy === true,
        showReviewedBy: template.showReviewedBy === true,
        showApprovedBy: template.showApprovedBy === true,
        preparedByLabel: template.preparedByLabel || 'Prepared By',
        reviewedByLabel: template.reviewedByLabel || 'Reviewed By',
        approvedByLabel: template.approvedByLabel || 'Approved By',
      });
      setLogoPath(template.logoPath || null);
    } catch (error) {
      message.error('Failed to load template');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplate(selectedFacility, selectedReportType);
  }, [selectedFacility, selectedReportType]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        facilityId: selectedFacility,
        reportType: selectedReportType,
        ...values,
        logoPath,
      };
      await reportTemplateService.saveTemplate(payload);
      message.success('Template saved');
    } catch (error) {
      message.error('Save failed');
    }
  };

  const handleLogoUpload = async (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const res = await reportTemplateService.uploadLogo(formData);
      setLogoPath(res.data.logoPath);
      message.success('Logo uploaded');
    } catch (error) {
      message.error('Upload failed');
    }
    return false;
  };

  const handleCopy = async () => {
    if (copyFrom === null || copyTo === null) {
      message.warning('Select source and target');
      return;
    }
    try {
      await reportTemplateService.copyTemplate(copyFrom, copyTo, selectedReportType);
      message.success('Template copied');
      fetchTemplate(selectedFacility, selectedReportType);
    } catch (error) {
      message.error('Copy failed');
    }
  };

  // Generate preview HTML
  const getPreviewHtml = () => {
    const values = form.getFieldsValue();
    const reportType = selectedReportType;
    const columnOptions = COLUMN_OPTIONS[reportType] || [];
    const selectedColumns = Array.isArray(values.tableColumns)
      ? values.tableColumns.filter(c => columnOptions.find(o => o.key === c))
      : columnOptions.map(o => o.key);
    const sampleData = sampleDummyRows[reportType] || [];

    const companyName = values.companyName || 'Company Name';
    const reportTitle = values.reportTitle || '';
    const footerText = values.footerText || '';
    const logoAlignment = values.logoAlignment || 'LEFT';
    const showPreparedBy = values.showPreparedBy === true;
    const showReviewedBy = values.showReviewedBy === true;
    const showApprovedBy = values.showApprovedBy === true;
    const preparedByLabel = values.preparedByLabel || 'Prepared By';
    const reviewedByLabel = values.reviewedByLabel || 'Reviewed By';
    const approvedByLabel = values.approvedByLabel || 'Approved By';

    const logoHtml = logoPath
      ? `<img src="${SERVER_BASE_URL}${logoPath}" style="height:50px;width:auto;object-fit:contain;" />`
      : '';

    // Header
    const headerHtml = logoAlignment === 'LEFT'
      ? `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 30px; border-bottom:2px solid #3498db; font-family:Arial;">
          ${logoHtml}
          <div style="text-align:right;">
            <div style="font-size:20px; font-weight:bold;">${companyName}</div>
            ${reportTitle ? `<div style="font-size:14px;">${reportTitle}</div>` : ''}
          </div>
        </div>`
      : `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 30px; border-bottom:2px solid #3498db; font-family:Arial;">
          <div>
            <div style="font-size:20px; font-weight:bold;">${companyName}</div>
            ${reportTitle ? `<div style="font-size:14px;">${reportTitle}</div>` : ''}
          </div>
          ${logoHtml}
        </div>`;

    // Table columns
    const headerCells = selectedColumns
      .map(col => {
        const option = columnOptions.find(o => o.key === col);
        return option ? `<th style="background:#3498db;color:#fff;padding:8px;text-align:left;">${option.label}</th>` : '';
      })
      .join('');
    const bodyRows = sampleData
      .map(row => {
        const cells = selectedColumns
          .map(col => {
            const option = columnOptions.find(o => o.key === col);
            return option ? `<td style="padding:8px;border-bottom:1px solid #ddd;">${row[col] ?? ''}</td>` : '';
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    // Approval table
    const approvalItems = [
      { show: showPreparedBy, label: preparedByLabel },
      { show: showReviewedBy, label: reviewedByLabel },
      { show: showApprovedBy, label: approvedByLabel },
    ].filter(item => item.show);
    const approvalTable = approvalItems.length > 0
      ? `<table style="width:100%; border-collapse:collapse; margin-bottom:8px;"><tr>${approvalItems.map(item => `<td style="text-align:center; padding:5px; border:1px solid #ddd;">${item.label}: _________________</td>`).join('')}</tr></table>`
      : '';

    // Footer
    const footerHtml = `
      <div style="padding:10px 30px; border-top:1px solid #ddd; font-family:Arial; font-size:12px; color:#555;">
        ${approvalTable}
        ${footerText ? `<div style="text-align:left; margin-bottom:5px;">${footerText}</div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>Printed By: Admin User | ${new Date().toLocaleString()}</span>
          <span>Page 1 of 1</span>
        </div>
        <div style="text-align:center; margin-top:5px;">This report is system generated and does not require signature.</div>
      </div>`;

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Preview</title>
<style>
  body { font-family: Arial, sans-serif; margin:0; padding:0; }
  .content { padding:20px 30px; }
  table { width:100%; border-collapse:collapse; margin-top:15px; }
</style>
</head>
<body>
  ${headerHtml}
  <div class="content">
    <p><strong>Application:</strong> Empower | <strong>Status:</strong> All</p>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
  ${footerHtml}
</body>
</html>`;
  };

  return (
    <Card title="Report Template" loading={loading}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <Text strong>Select Facility</Text>
            <div style={{ marginTop: 4 }}>
              <Select
                placeholder="Select Facility (leave empty for Global)"
                style={{ width: 300 }}
                value={selectedFacility}
                onChange={setSelectedFacility}
                allowClear
              >
                <Option value={null}>Global</Option>
                {facilities.map(f => (
                  <Option key={f.id} value={f.id}>{f.name} ({f.code})</Option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Text strong>Select Report Type</Text>
            <div style={{ marginTop: 4 }}>
              <Select
                placeholder="Select Report Type"
                style={{ width: 300 }}
                value={selectedReportType}
                onChange={setSelectedReportType}
              >
                {REPORT_TYPES.map(rt => (
                  <Option key={rt.key} value={rt.key}>{rt.label}</Option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <Form form={form} layout="vertical">
          <Divider orientation="left">Header</Divider>
          <Form.Item name="companyName" label="Company Name">
            <Input />
          </Form.Item>
          <Form.Item name="reportTitle" label="Report Title">
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Logo">
                <Upload accept="image/*" showUploadList={false} beforeUpload={handleLogoUpload}>
                  <Button icon={<UploadOutlined />}>Upload Logo</Button>
                </Upload>
                {logoPath && (
                  <img
                    src={`${SERVER_BASE_URL}${logoPath}`}
                    alt="logo"
                    style={{ maxWidth: 100, marginTop: 8 }}
                  />
                )}
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="logoAlignment" label="Logo Alignment">
                <Radio.Group>
                  <Radio value="LEFT">Left</Radio>
                  <Radio value="RIGHT">Right</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Approval Section (Optional)</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="showPreparedBy" label="Prepared By" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="showReviewedBy" label="Reviewed By" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="showApprovedBy" label="Approved By" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="preparedByLabel" label="Prepared By Label">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="reviewedByLabel" label="Reviewed By Label">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="approvedByLabel" label="Approved By Label">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Table Columns</Divider>
          <Form.Item name="tableColumns" label="Select Columns">
            <Checkbox.Group
              options={COLUMN_OPTIONS[selectedReportType].map(c => ({ label: c.label, value: c.key }))}
            />
          </Form.Item>

          <Divider orientation="left">Footer</Divider>
          <Form.Item name="footerText" label="SOP / Footer Text">
            <TextArea rows={2} placeholder="Enter SOP number or custom footer text" />
          </Form.Item>

          <Divider orientation="left">Page Orientation</Divider>
          <Form.Item name="orientation" label="Orientation">
            <Select>
              <Option value="PORTRAIT">Portrait</Option>
              <Option value="LANDSCAPE">Landscape</Option>
            </Select>
          </Form.Item>

          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
              Save Template
            </Button>
            <Button icon={<EyeOutlined />} onClick={() => setPreviewVisible(true)}>
              Preview
            </Button>
          </Space>
        </Form>

        <Divider>Copy Template</Divider>
        <Space>
          <Select
            placeholder="From"
            style={{ width: 200 }}
            value={copyFrom}
            onChange={setCopyFrom}
            allowClear
          >
            <Option value={null}>Global</Option>
            {facilities.map(f => <Option key={f.id} value={f.id}>{f.name}</Option>)}
          </Select>
          <Select
            placeholder="To"
            style={{ width: 200 }}
            value={copyTo}
            onChange={setCopyTo}
            allowClear
          >
            <Option value={null}>Global</Option>
            {facilities.map(f => <Option key={f.id} value={f.id}>{f.name}</Option>)}
          </Select>
          <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy</Button>
        </Space>
      </Space>

      <Modal
        title="Template Preview"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width="90%"
        style={{ top: 20 }}
      >
        <iframe
          srcDoc={getPreviewHtml()}
          style={{
            width: form.getFieldValue('orientation') === 'LANDSCAPE' ? '100%' : '70%',
            height: '80vh',
            border: 'none',
            margin: '0 auto',
            display: 'block',
          }}
          title="Preview"
        />
      </Modal>
    </Card>
  );
};

export default ReportTemplate;