import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard',         icon: '⚡', section: 'Workbench' },
  { to: '/history',   label: 'Test History',      icon: '📋', section: 'Analytics'  },
  { to: '/report/demo', label: 'Comparison Report', icon: '📊', section: 'Analytics' },
  { to: '/admin',     label: 'Admin Config',      icon: '⚙️', section: 'Settings'  },
];

export default function Sidebar() {
  const location = useLocation();
  const sections = [...new Set(navItems.map(n => n.section))];

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">▶</div>
        <div className="sidebar-logo-text">
          Stream<span>Smart</span>
        </div>
      </div>

      <div className="sidebar-nav">
        {sections.map(section => (
          <div key={section}>
            <div className="nav-section-label">{section}</div>
            {navItems
              .filter(n => n.section === section)
              .map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="nav-item-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-footer-version">
          <span>StreamSmart v1.0</span>
          <span className="chip chip-green" style={{padding:'1px 6px',fontSize:'9px'}}>LIVE</span>
        </div>
        <div style={{marginTop:'4px', fontSize:'10px'}}>INNOVISTA Hackathon 2024</div>
      </div>
    </nav>
  );
}

