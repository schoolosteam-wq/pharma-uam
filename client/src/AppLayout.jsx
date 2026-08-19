import React from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import AppHeader from './components/Layout/AppHeader';
import AppSidebar from './components/Layout/AppSidebar';
import AppFooter from './components/Layout/AppFooter';
import { useIdleTimer } from './hooks/useIdleTimer';

const { Content } = Layout;

const AppLayout = () => {
  useIdleTimer();
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Layout>
        <AppSidebar />
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
            }}
          >
            <Outlet />
          </Content>
          <AppFooter />
        </Layout>
      </Layout>
    </Layout>
  );
};

export default AppLayout;