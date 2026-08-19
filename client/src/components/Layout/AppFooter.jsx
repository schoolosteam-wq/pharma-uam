import React from 'react';
import { Layout } from 'antd';

const { Footer } = Layout;

const AppFooter = () => {
  return (
    <Footer style={{ textAlign: 'center' }}>
      Pharma User Management ©{new Date().getFullYear()} | 21 CFR Part 11 Ready
    </Footer>
  );
};

export default AppFooter;