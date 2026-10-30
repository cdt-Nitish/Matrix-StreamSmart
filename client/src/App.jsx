import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import ComparisonReport from './pages/ComparisonReport';
import AdminConfig from './pages/AdminConfig';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="workbench" element={<Dashboard />} />
          <Route path="analytics" element={<ComparisonReport />} />
          <Route path="history" element={<History />} />
          <Route path="report" element={<Navigate to="/report/demo" replace />} />
          <Route path="report/:sessionId" element={<ComparisonReport />} />
          <Route path="admin" element={<AdminConfig />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
