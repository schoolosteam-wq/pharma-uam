import React from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  BankOutlined,
  UserOutlined,
  AppstoreOutlined,
  ExperimentOutlined,
  DesktopOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  UsergroupAddOutlined,
  SettingOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const { Sider } = Layout;

const AppSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { permissions, currentUser } = useAuth();

  const isAdmin = () => {
    if (!currentUser || !currentUser.roles) return false;
    const adminRoles = ['ROLE_DEFAULT ADMINISTRATOR', 'ROLE_ADMINISTRATOR'];
    return currentUser.roles.some(r => adminRoles.includes(r));
  };

  const hasPermission = (perm) => !perm || permissions.includes(perm);

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'organization',
      icon: <BankOutlined />,
      label: 'Organization',
      children: [
        { key: '/facilities/type/COMPANY', label: 'Company' },
        { key: '/facilities/type/FACTORY', label: 'Factory' },
        { key: '/facilities/type/UNIT', label: 'Units' },
        { key: '/facilities/type/DEPARTMENT', label: 'Departments' },
      ],
    },
    {
      key: 'master-data',
      icon: <AppstoreOutlined />,
      label: 'Master Data',
      children: [
        { key: '/instruments', label: 'Instruments' },
        { key: '/computers', label: 'Computers' },
        { key: '/applications', label: 'Applications' },
        ...(isAdmin()
          ? [{ key: '/active-users/csv', label: 'Active User Bulk Upload' }]
          : []),
      ],
    },
    {
      key: '/requests',
      icon: <FileTextOutlined />,
      label: 'Requests',
    },
    // Administration
    {
      key: 'administration',
      icon: <SettingOutlined />,
      label: 'Administration',
      children: [
        { key: '/users', label: 'Users' },
        ...(isAdmin()
          ? [
              { key: '/settings/email-config', label: 'Email Config' },
              { key: '/settings/ad-config', label: 'AD Configuration' },
              { key: '/settings/logo', label: 'Company Logo' },
              { key: '/settings/report-template', label: 'Report Template' },
            ]
          : []),
      ],
    },
    // Privilege
    ...(hasPermission('MANAGE_ROLES') || hasPermission('MANAGE_GROUPS')
      ? [{
          key: 'privilege',
          icon: <SafetyCertificateOutlined />,
          label: 'Privilege',
          children: [
            { key: '/settings/permissions', label: 'Roles & Permissions' },
            { key: '/groups', label: 'Groups' },
          ],
        }]
      : []),
    // Master Workflow – सही जगह
    ...(isAdmin()
      ? [{
          key: 'master-workflow',
          icon: <UsergroupAddOutlined />,
          label: 'Master Workflow',
          children: [
            { key: '/settings/master-activities', label: 'Master Activities' },
            { key: '/settings/application-activity-mapping', label: 'Application Activity Mapping' },
            { key: '/settings/activity-workflow', label: 'Activity Workflow' },
            { key: '/settings/application-admin-groups', label: 'Application Admin Groups' },
          ],
        }]
      : []),
    // Reports
    {
      key: 'reports',
      icon: <HistoryOutlined />,
      label: 'Reports',
      children: [
        { key: '/audit', label: 'Audit Trail' },
        { key: '/active-users', label: 'Active Users' },
        { key: '/reports-center', label: 'Reports Center' },
      ],
    },
  ];

  // openKeys – सही logic
  const openKeys = [];
  if (location.pathname.startsWith('/facilities')) openKeys.push('organization');
  if (location.pathname.startsWith('/applications') || location.pathname.startsWith('/instruments') || location.pathname.startsWith('/computers')) openKeys.push('master-data');
  if (location.pathname.startsWith('/users') || location.pathname.startsWith('/settings/email-config') || location.pathname.startsWith('/settings/ad-config') || location.pathname.startsWith('/settings/logo')) openKeys.push('administration');
  if (location.pathname.startsWith('/settings/permissions') || location.pathname.startsWith('/groups')) openKeys.push('privilege');
  if (location.pathname.startsWith('/settings/master-activities') || location.pathname.startsWith('/settings/application-activity-mapping') || location.pathname.startsWith('/settings/activity-workflow')) openKeys.push('master-workflow');
  if (location.pathname.startsWith('/audit') || location.pathname.startsWith('/active-users')) openKeys.push('reports');

  return (
    <Sider width={250} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
        <h3 style={{ margin: 0, color: '#1a5c3e' }}>Pharma UAM</h3>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        defaultOpenKeys={openKeys}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ height: 'calc(100% - 64px)', borderRight: 0, paddingTop: 8 }}
      />
    </Sider>
  );
};

export default AppSidebar;