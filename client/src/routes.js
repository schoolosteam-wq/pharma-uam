import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Auth/Login';
import ForgotPassword from './pages/Auth/ForgotPassword';
import Dashboard from './pages/Dashboard/Dashboard';
import FacilityList from './pages/facilities/FacilityList';
import UserList from './pages/users/UserList';
import ApplicationList from './pages/applications/ApplicationList';
import ApplicationCsvUpload from './pages/applications/ApplicationCsvUpload';
import InstrumentList from './pages/instruments/InstrumentList';
import InstrumentCsvUpload from './pages/instruments/InstrumentCsvUpload';
import ComputerList from './pages/computers/ComputerList';
import ComputerCsvUpload from './pages/computers/ComputerCsvUpload';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppLayout from './AppLayout';
import RequestList from './pages/requests/RequestList';
import NewRequest from './pages/requests/NewRequest';
import RequestDetails from './pages/requests/RequestDetails';
import FacilityAccessRequest from './pages/requests/FacilityAccessRequest';
import GroupList from './pages/groups/GroupList';
import WorkflowConfig from './pages/settings/ActivityWorkflowConfig';
import MasterActivities from './pages/settings/MasterActivities';   // ✅ import
import ApplicationActivityMapping from './pages/settings/ApplicationActivityMapping';
import ApplicationAdminGroups from './pages/settings/ApplicationAdminGroups';
import AuditTrailViewer from './pages/reports/AuditTrailViewer';
import ApplicationDetail from './pages/applications/ApplicationDetail';
import FacilityTypeList from './pages/facilities/FacilityTypeList';
import PermissionsMatrix from './pages/settings/PermissionsMatrix';
import ADConfig from './pages/settings/ADConfig';
import EmailConfig from './pages/settings/EmailConfig';
import ActiveUserList from './pages/reports/ActiveUserList';
import ActiveUserCsvUpload from './pages/reports/ActiveUserCsvUpload';
import LogoUpload from './pages/settings/LogoUpload';
import ReportTemplate from './pages/settings/ReportTemplate';
import ReportsCenter from './pages/reports/ReportsCenter';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="facilities" element={<FacilityList />} />
        <Route path="facilities/type/:type" element={<FacilityTypeList />} />
        <Route path="users" element={<UserList />} />
        <Route path="applications" element={<ApplicationList />} />
        <Route path="applications/csv" element={<ApplicationCsvUpload />} />
        <Route path="applications/:id" element={<ApplicationDetail />} />
        <Route path="instruments" element={<InstrumentList />} />
        <Route path="instruments/csv" element={<InstrumentCsvUpload />} />
        <Route path="computers" element={<ComputerList />} />
        <Route path="computers/csv" element={<ComputerCsvUpload />} />
        <Route path="requests" element={<RequestList />} />
        <Route path="requests/new" element={<NewRequest />} />
        <Route path="requests/:id" element={<RequestDetails />} />
        <Route path="requests/facility-access" element={<FacilityAccessRequest />} />
        <Route path="groups" element={<GroupList />} />
        <Route path="settings/ad-config" element={<ADConfig />} />
        <Route path="settings/activity-workflow" element={<WorkflowConfig />} />
        <Route path="settings/permissions" element={<PermissionsMatrix />} />
        <Route path="settings/master-activities" element={<MasterActivities />} />
        <Route path="settings/application-activity-mapping" element={<ApplicationActivityMapping />} />
        <Route path="settings/application-admin-groups" element={<ApplicationAdminGroups />} />
        <Route path="settings/email-config" element={<EmailConfig />} />
        <Route path="audit" element={<AuditTrailViewer />} />
        <Route path="active-users" element={<ActiveUserList />} />
        <Route path="active-users/csv" element={<ActiveUserCsvUpload />} />
        <Route path="settings/logo" element={<LogoUpload />} />
        <Route path="settings/report-template" element={<ReportTemplate />} />
        <Route path="reports-center" element={<ReportsCenter />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;