import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { buildCacheDoughnutData, getDoughnutOptions } from '../../utils/chartController';

ChartJS.register(ArcElement, Tooltip, Legend);

const CACHE_HIT_DELAY_MS  = 12;
const CACHE_MISS_DELAY_MS = 260;

export default function CacheEfficiencyChart({ hits = 0, misses = 0 }) {
  const data    = useMemo(() => buildCacheDoughnutData(hits, misses), [hits, misses]);
  const options = useMemo(() => getDoughnutOptions(), []);

  const total       = hits + misses;
  const hitPct      = total > 0 ? Math.round((hits / total) * 100) : 0;
  const savedMs     = hits * CACHE_MISS_DELAY_MS - hits * CACHE_HIT_DELAY_MS;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-lg">Edge Cache Efficiency</div>
        <span className="simulated-tag">SIMULATED</span>
      </div>
      <div className="chart-container" style={{height:'160px'}}>
        {total > 0
          ? <Doughnut data={data} options={options} />
          : (
            <div className="empty-state" style={{height:'100%'}}>
              <div className="empty-state-icon">🗄️</div>
              <div className="empty-state-sub">No cache data yet</div>
            </div>
          )}
      </div>
      <div style={{marginTop:'12px', display:'flex', flexDirection:'column', gap:'6px'}}>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}>
          <span style={{color:'var(--text-muted)'}}>Hit Rate</span>
          <span style={{color:'var(--accent-green)', fontWeight:700}}>{hitPct}%</span>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}>
          <span style={{color:'var(--text-muted)'}}>Hits / Misses</span>
          <span style={{color:'var(--text-secondary)'}}>{hits} / {misses}</span>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}>
          <span style={{color:'var(--text-muted)'}}>Est. Latency Saved</span>
          <span style={{color:'var(--accent-cyan)', fontWeight:600}}>{savedMs > 0 ? `${savedMs} ms` : '--'}</span>
        </div>
        <div style={{fontSize:'10px', color:'var(--text-muted)', marginTop:'2px', fontStyle:'italic'}}>
          ※ Simulated values (12ms hit / 260ms miss)
        </div>
      </div>
    </div>
  );
}

