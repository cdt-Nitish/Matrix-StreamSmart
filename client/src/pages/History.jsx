import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const PROFILE_COLORS = {
  'Rural 3G':      'chip-red',
  'Train':         'chip-orange',
  '4G':            'chip-blue',
  'Fiber':         'chip-green',
};

function getProfileChip(name) {
  for (const [key, cls] of Object.entries(PROFILE_COLORS)) {
    if (name?.includes(key)) return cls;
  }
  return 'chip-blue';
}

export default function History() {
  const [sessions,    setSessions]    = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [profiles,    setProfiles]    = useState([]);
  const [page,        setPage]        = useState(0);
  const limit = 10;
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [histRes, profRes] = await Promise.all([
        api.getHistory({ limit, offset: page * limit, search, profileId: profileFilter || undefined }),
        api.getProfiles().catch(() => ({ profiles: [] }))
      ]);
      setSessions(histRes.sessions || []);
      setTotal(histRes.total || 0);
      setProfiles(profRes.profiles || []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search, profileFilter]);

  const formatDate = (dt) => dt ? new Date(dt).toLocaleString() : '—';
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Test History</div>
        <div className="page-subtitle">Browse all recorded benchmark sessions – click View Report to open a detailed analysis</div>
      </div>

      {/* Filters */}
      <div className="card" style={{marginBottom:'16px'}}>
        <div style={{display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap'}}>
          <div className="form-group" style={{flex:1, minWidth:'200px', marginBottom:0}}>
            <input
              className="form-control"
              placeholder="🔍  Search by video, profile, session ID…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <div className="form-group" style={{minWidth:'200px', marginBottom:0}}>
            <select
              className="form-control"
              value={profileFilter}
              onChange={e => { setProfileFilter(e.target.value); setPage(0); }}
            >
              <option value="">All Network Profiles</option>
              {profiles.map(p => (
                <option key={p.profile_id} value={p.profile_id}>{p.profile_name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={() => { setSearch(''); setProfileFilter(''); setPage(0); }}>
            Clear
          </button>
          <button className="btn btn-primary" onClick={load}>
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div className="card-title-lg">Sessions</div>
          <span className="text-muted text-sm">{total} total</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Video</th>
                <th>Profile</th>
                <th>Bandwidth</th>
                <th>Latency</th>
                <th>Duration</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{textAlign:'center', padding:'32px'}}>
                    <span className="spinner" /> &nbsp; Loading sessions…
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📋</div>
                      <div className="empty-state-text">No sessions found</div>
                      <div className="empty-state-sub">Run a benchmark on the Dashboard to start recording</div>
                    </div>
                  </td>
                </tr>
              ) : sessions.map(s => (
                <tr key={s.session_id}>
                  <td className="td-mono td-primary">#{s.session_id}</td>
                  <td className="td-primary" style={{maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {s.video_title || '—'}
                  </td>
                  <td>
                    {s.profile_name
                      ? <span className={`chip ${getProfileChip(s.profile_name)}`}>{s.profile_name}</span>
                      : '—'}
                  </td>
                  <td className="td-mono">{s.sim_bandwidth_kbps} Kbps</td>
                  <td className="td-mono">{s.sim_latency_ms} ms</td>
                  <td className="td-mono">{s.test_duration_sec}s</td>
                  <td><span className="simulated-tag">{s.measurement_mode}</span></td>
                  <td>
                    <span className={`chip ${s.status === 'completed' ? 'chip-green' : s.status === 'running' ? 'chip-orange' : 'chip-blue'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="td-mono" style={{fontSize:'11px'}}>{formatDate(s.created_at)}</td>
                  <td>
                    <button
                      className="btn btn-outline-cyan btn-sm"
                      onClick={() => navigate(`/report/${s.session_id}`)}
                    >
                      View Report →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:'8px', justifyContent:'center'}}>
            <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{padding:'5px 12px', color:'var(--text-muted)', fontSize:'12px'}}>
              Page {page + 1} of {totalPages}
            </span>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

