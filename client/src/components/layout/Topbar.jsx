import React from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/dashboard': 'Benchmark Workbench',
  '/history':   'Test History',
  '/admin':     'Admin Configuration',
};

export default function Topbar() {
  const location = useLocation();
  const title = location.pathname.startsWith('/report')
    ? 'Comparison Report'
    : (PAGE_TITLES[location.pathname] || 'StreamSmart');

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>

      <div className="topbar-badges">
        <div className="mode-badge simulated">
          <span className="dot" />
          Simulation Mode
        </div>

        <div className="user-chip">
          <div className="user-avatar">N</div>
          <span>nitish_tester</span>
          <span className="role-badge tester">Tester</span>
        </div>
      </div>
    </header>
  );
}

