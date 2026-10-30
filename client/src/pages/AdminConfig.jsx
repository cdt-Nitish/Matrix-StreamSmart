import React, { useState, useEffect } from 'react';
import api from '../services/api';

// ── Generic Modal form ─────────────────────────────────────────────────────
function Modal({ title, fields, values, onChange, onSave, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:'14px'}}>
          {fields.map(f => (
            <div className="form-group" key={f.key}>
              <label className="form-label">{f.label}</label>
              <input
                className="form-control"
                type={f.type || 'text'}
                step={f.step}
                min={f.min}
                max={f.max}
                value={values[f.key] ?? ''}
                onChange={e => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
              {f.hint && <div style={{fontSize:'11px', color:'var(--text-muted)'}}>{f.hint}</div>}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Field definitions ──────────────────────────────────────────────────────
const PROFILE_FIELDS = [
  { key: 'profileName',   label: 'Profile Name',           placeholder: 'e.g. Rural 3G' },
  { key: 'bandwidthKbps', label: 'Bandwidth (Kbps)',       type: 'number', min: 100, max: 100000 },
  { key: 'latencyMs',     label: 'Latency (ms)',           type: 'number', min: 0,   max: 5000 },
  { key: 'packetLossPct', label: 'Packet Loss (%)',        type: 'number', step: 0.1, min: 0, max: 100 },
  { key: 'cacheHitProb',  label: 'Cache Hit Probability',  type: 'number', step: 0.05, min: 0, max: 1, hint: '0.00–1.00' },
];

const VIDEO_FIELDS = [
  { key: 'title',          label: 'Video Title',            placeholder: 'e.g. My HLS Stream' },
  { key: 'streamUrl',      label: 'HLS Manifest URL (.m3u8)', placeholder: 'https://…/master.m3u8' },
  { key: 'availableTiers', label: 'Available Tiers',        placeholder: '240p,360p,480p,720p,1080p', hint: 'Comma-separated' },
  { key: 'durationSec',    label: 'Duration (seconds)',     type: 'number', min: 1 },
];

export default function AdminConfig() {
  const [profiles, setProfiles] = useState([]);
  const [videos,   setVideos]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null); // { type, mode, values }
  const [saving,   setSaving]   = useState(false);
  const [notice,   setNotice]   = useState(null);

  const showNotice = (msg, kind = 'success') => {
    setNotice({ msg, kind });
    setTimeout(() => setNotice(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, vRes] = await Promise.all([api.getAdminProfiles(), api.getAdminVideos()]);
      setProfiles(pRes.profiles || []);
      setVideos(vRes.videos || []);
    } catch {
      showNotice('Could not reach backend API – showing cached data', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Open modal ────────────────────────────────────────────────────────
  const openProfileModal = (profile = null) => {
    setModal({
      type: 'profile',
      mode: profile ? 'edit' : 'add',
      id:   profile?.profile_id,
      values: profile ? {
        profileName:   profile.profile_name,
        bandwidthKbps: profile.bandwidth_kbps,
        latencyMs:     profile.latency_ms,
        packetLossPct: profile.packet_loss_pct,
        cacheHitProb:  profile.cache_hit_prob,
      } : { profileName:'', bandwidthKbps: 1000, latencyMs: 50, packetLossPct: 0, cacheHitProb: 0.5 },
    });
  };

  const openVideoModal = (video = null) => {
    setModal({
      type: 'video',
      mode: video ? 'edit' : 'add',
      id:   video?.video_id,
      values: video ? {
        title:          video.title,
        streamUrl:      video.stream_url,
        availableTiers: video.available_tiers,
        durationSec:    video.duration_sec,
      } : { title:'', streamUrl:'', availableTiers:'240p,360p,480p,720p,1080p', durationSec: 60 },
    });
  };

  const handleModalChange = (key, value) => {
    setModal(m => ({ ...m, values: { ...m.values, [key]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.type === 'profile') {
        if (modal.mode === 'add') {
          await api.createProfile(modal.values);
          showNotice('Network profile created');
        } else {
          await api.updateProfile(modal.id, modal.values);
          showNotice('Network profile updated');
        }
      } else {
        if (modal.mode === 'add') {
          await api.createVideo(modal.values);
          showNotice('Video sample added');
        } else {
          await api.updateVideo(modal.id, modal.values);
          showNotice('Video sample updated');
        }
      }
      setModal(null);
      await load();
    } catch (err) {
      showNotice(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async (id) => {
    if (!confirm('Delete this network profile?')) return;
    try {
      await api.deleteProfile(id);
      showNotice('Profile deleted');
      load();
    } catch (err) {
      showNotice(`Delete failed: ${err.message}`, 'error');
    }
  };

  const deleteVideo = async (id) => {
    if (!confirm('Deactivate this video sample?')) return;
    try {
      await api.deleteVideo(id);
      showNotice('Video deactivated');
      load();
    } catch (err) {
      showNotice(`Failed: ${err.message}`, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Admin Configuration</div>
        <div className="page-subtitle">Manage network profiles, video samples, and benchmark presets</div>
      </div>

      {notice && (
        <div className={`alert alert-${notice.kind}`} style={{marginBottom:'16px'}}>
          {notice.msg}
        </div>
      )}

      <div className="admin-grid">
        {/* ── Network Profiles ──────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-lg">Network Profiles</div>
            <button className="btn btn-primary btn-sm" onClick={() => openProfileModal()}>+ Add Profile</button>
          </div>

          {loading ? <div style={{textAlign:'center',padding:'20px'}}><span className="spinner"/></div>
          : profiles.length === 0
            ? <div className="empty-state"><div>No profiles found. Add one above.</div></div>
            : profiles.map(p => (
              <div className="admin-list-item" key={p.profile_id}>
                <div className="admin-item-info">
                  <div className="admin-item-name">{p.profile_name}</div>
                  <div className="admin-item-detail">
                    {p.bandwidth_kbps} Kbps · {p.latency_ms} ms · {p.packet_loss_pct}% loss · {Math.round(p.cache_hit_prob * 100)}% cache
                  </div>
                </div>
                <div className="admin-item-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => openProfileModal(p)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteProfile(p.profile_id)}>Del</button>
                </div>
              </div>
            ))}
        </div>

        {/* ── Video Samples ─────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-lg">Video Samples</div>
            <button className="btn btn-primary btn-sm" onClick={() => openVideoModal()}>+ Add Video</button>
          </div>

          {loading ? <div style={{textAlign:'center',padding:'20px'}}><span className="spinner"/></div>
          : videos.length === 0
            ? <div className="empty-state"><div>No video samples. Add one above.</div></div>
            : videos.map(v => (
              <div className="admin-list-item" key={v.video_id}>
                <div className="admin-item-info">
                  <div className="admin-item-name">{v.title}</div>
                  <div className="admin-item-detail" style={{wordBreak:'break-all'}}>
                    {v.available_tiers} · {v.duration_sec}s
                  </div>
                  <div style={{fontSize:'10px', color:'var(--text-muted)', marginTop:'2px', wordBreak:'break-all'}}>
                    {v.stream_url}
                  </div>
                </div>
                <div className="admin-item-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => openVideoModal(v)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteVideo(v.video_id)}>Del</button>
                </div>
              </div>
            ))}
        </div>

        {/* ── ABR Algorithm Reference ───────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-lg">ABR Algorithm Reference</div>
          </div>
          <table className="data-table" style={{fontSize:'12px'}}>
            <thead>
              <tr>
                <th>Quality</th>
                <th>Bitrate</th>
                <th>Condition</th>
              </tr>
            </thead>
            <tbody>
              {[
                {q:'240p', b:'400 Kbps'},
                {q:'360p', b:'800 Kbps'},
                {q:'480p', b:'1,400 Kbps'},
                {q:'720p', b:'2,800 Kbps'},
                {q:'1080p',b:'5,000 Kbps'},
              ].map(r => (
                <tr key={r.q}>
                  <td className="td-primary">{r.q}</td>
                  <td className="td-mono">{r.b}</td>
                  <td style={{fontSize:'11px',color:'var(--text-muted)'}}>
                    {r.q==='240p' ? 'Minimum' : r.q==='1080p' ? 'Maximum (Baseline locked here)' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{marginTop:'14px', fontSize:'12px', color:'var(--text-muted)', lineHeight:'1.7'}}>
            <div><strong style={{color:'var(--accent-cyan)'}}>Decision interval:</strong> 1,500 ms</div>
            <div><strong style={{color:'var(--accent-cyan)'}}>Safety margin:</strong> 75% of available bandwidth</div>
            <div><strong style={{color:'var(--accent-red)'}}>Downshift trigger:</strong> Buffer &lt; 3.5 s</div>
            <div><strong style={{color:'var(--accent-green)'}}>Upshift trigger:</strong> Buffer &gt; 10 s AND bitrate fits 75% BW</div>
          </div>
        </div>

        {/* ── Cache Simulator Reference ─────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-lg">Edge Cache Simulator</div>
            <span className="simulated-tag">SIMULATED</span>
          </div>
          <div style={{fontSize:'13px', color:'var(--text-secondary)', lineHeight:'1.8'}}>
            <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)'}}>
              <span>Cache Hit Delay</span>
              <strong className="text-mono text-green">12 ms</strong>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)'}}>
              <span>Cache Miss Delay (Origin)</span>
              <strong className="text-mono text-red">260 ms</strong>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)'}}>
              <span>LRU Cache Capacity</span>
              <strong className="text-mono">200 segments</strong>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', padding:'8px 0'}}>
              <span>Jitter Range</span>
              <strong className="text-mono">0–25 ms</strong>
            </div>
          </div>
          <div style={{marginTop:'10px', fontSize:'11px', color:'var(--text-muted)', fontStyle:'italic'}}>
            Transfer Time = (Segment Bits / Available BW) × 1000 ms<br/>
            Total Delay = Transfer + Latency + Cache Delay + Jitter
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={`${modal.mode === 'add' ? 'Add' : 'Edit'} ${modal.type === 'profile' ? 'Network Profile' : 'Video Sample'}`}
          fields={modal.type === 'profile' ? PROFILE_FIELDS : VIDEO_FIELDS}
          values={modal.values}
          onChange={handleModalChange}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

