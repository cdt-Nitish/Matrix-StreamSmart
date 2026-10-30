import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import api from '../services/api';
import {
  buildTimelineChartData, buildComparisonBarData, buildCacheDoughnutData,
  getTimelineOptions, getBarOptions, getDoughnutOptions,
  CHART_COLORS
} from '../utils/chartController';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

function MetricRow({ label, baseline, optimized, lowerIsBetter = true, unit = '' }) {
  const bVal = parseFloat(baseline) || 0;
  const oVal = parseFloat(optimized) || 0;
  const baselineWins = lowerIsBetter ? bVal <= oVal : bVal >= oVal;
  const diff = bVal > 0 ? Math.abs(((oVal - bVal) / bVal) * 100).toFixed(1) : null;

  return (
    <tr>
      <td className="metric-name">{label}</td>
      <td className={baselineWins ? 'winner' : 'loser'} style={{textAlign:'right', fontFamily:'var(--font-mono)'}}>
        {bVal.toFixed(2)}{unit}
      </td>
      <td className={!baselineWins ? 'winner' : 'loser'} style={{textAlign:'right', fontFamily:'var(--font-mono)'}}>
        {oVal.toFixed(2)}{unit}
      </td>
      <td style={{textAlign:'right', fontSize:'11px', color: !baselineWins ? 'var(--accent-green)' : 'var(--accent-red)'}}>
        {diff !== null ? (lowerIsBetter
          ? (oVal < bVal ? `−${diff}%` : `+${diff}%`)
          : (oVal > bVal ? `+${diff}%` : `−${diff}%`)) : '—'}
      </td>
    </tr>
  );
}

// Demo data when no real session exists
const DEMO_REPORT = {
  session: {
    session_id: 'demo',
    video_title: 'Big Buck Bunny (Mux Multi-Bitrate)',
    profile_name: 'Rural 3G (Congested)',
    sim_bandwidth_kbps: 850,
    sim_latency_ms: 220,
    sim_cache_hit_prob: '0.20',
    test_duration_sec: 60,
    measurement_mode: 'SIMULATED',
    created_at: new Date().toISOString(),
  },
  baseline: {
    startup_delay_ms: 3200, stall_count: 7, total_stall_duration_sec: '18.50',
    avg_bitrate_kbps: 5000, quality_switches: 0, cache_hits: 3, cache_misses: 12,
  },
  optimized: {
    startup_delay_ms: 1100, stall_count: 1, total_stall_duration_sec: '2.30',
    avg_bitrate_kbps: 1200, quality_switches: 5, cache_hits: 9, cache_misses: 6,
  },
  timeSeries: {
    baseline:  Array.from({length:30}, (_,i) => ({ elapsed: i*2, buffer: Math.max(0, 4 - i*0.3 + Math.sin(i)*2), bitrate: 5000 })),
    optimized: Array.from({length:30}, (_,i) => ({ elapsed: i*2, buffer: Math.max(0, 8 + Math.sin(i*0.5)*3),       bitrate: [400,800,1400,2800,1200][i%5] })),
  },
  cacheStats: { totalHits: 12, totalMisses: 18, latencySavedMs: 2952, note: 'SIMULATED cache statistics' },
};

export default function ComparisonReport() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const isDemo = sessionId === 'demo';

  useEffect(() => {
    if (isDemo) { setReport(DEMO_REPORT); setLoading(false); return; }
    (async () => {
      try {
        const data = await api.getReport(sessionId);
        setReport(data);
      } catch (err) {
        setError(err.message);
        setReport(DEMO_REPORT); // fallback
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const timelineData = useMemo(() => {
    if (!report) return null;
    let bs = report.timeSeries?.baseline || [];
    let os = report.timeSeries?.optimized || [];

    // Normalize if backend returned object format { timestamps, bufferLevels }
    if (!Array.isArray(bs) && bs.timestamps) {
      bs = bs.timestamps.map((t, idx) => ({
        elapsed: t,
        buffer: bs.bufferLevels?.[idx] || 0,
        bitrate: report.baseline?.avg_bitrate_kbps || 0
      }));
    }
    if (!Array.isArray(os) && os.timestamps) {
      os = os.timestamps.map((t, idx) => ({
        elapsed: t,
        buffer: os.bufferLevels?.[idx] || 0,
        bitrate: report.optimized?.avg_bitrate_kbps || 0
      }));
    }

    return buildTimelineChartData(bs, os);
  }, [report]);

  const barData = useMemo(() => {
    if (!report) return null;
    return buildComparisonBarData(report.baseline, report.optimized);
  }, [report]);

  const cacheData = useMemo(() => {
    if (!report) return null;
    const { totalHits = 0, totalMisses = 0 } = report.cacheStats || {};
    return buildCacheDoughnutData(totalHits, totalMisses);
  }, [report]);

  if (loading) return (
    <div className="empty-state" style={{height:'60vh'}}>
      <span className="spinner" style={{width:30,height:30,borderWidth:3}} />
      <div>Loading report…</div>
    </div>
  );

  const { session, baseline, optimized, cacheStats } = report || {};

  return (
    <div>
      <div className="page-header" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div>
          <div className="page-title">
            Comparison Report
            {isDemo && <span className="chip chip-orange" style={{marginLeft:'10px', fontSize:'11px'}}>DEMO DATA</span>}
          </div>
          <div className="page-subtitle">
            Session #{session?.session_id} · {session?.video_title || 'N/A'}
          </div>
        </div>
        <div style={{display:'flex', gap:'8px'}}>
          <button className="btn btn-secondary" onClick={() => navigate('/history')}>← Back to History</button>
          {!isDemo && (
            <button className="btn btn-secondary" onClick={() => navigate(`/report/demo`)}>View Demo</button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-warning" style={{marginBottom:'16px'}}>
          ⚠️ Could not load session {sessionId}: {error}. Showing demo data.
        </div>
      )}

      {/* Session Info */}
      <div className="grid-4" style={{marginBottom:'16px'}}>
        {[
          { label: 'Network Profile', value: session?.profile_name || 'Custom' },
          { label: 'Bandwidth',       value: `${session?.sim_bandwidth_kbps} Kbps` },
          { label: 'Latency',         value: `${session?.sim_latency_ms} ms` },
          { label: 'Mode',            value: session?.measurement_mode || 'SIMULATED' },
        ].map(({ label, value }) => (
          <div className="card card-sm" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{fontSize:'18px'}}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main comparison table */}
      <div className="card" style={{marginBottom:'16px'}}>
        <div className="card-header">
          <div className="card-title-lg">Head-to-Head Metrics</div>
          <span className="simulated-tag">SIMULATED</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="comparison-table" style={{width:'100%'}}>
            <thead>
              <tr style={{borderBottom:'1px solid var(--border)'}}>
                <th style={{textAlign:'left', padding:'10px 16px', color:'var(--text-muted)', fontSize:'11px'}}>Metric</th>
                <th style={{textAlign:'right', padding:'10px 16px'}}>Baseline (Fixed 1080p)</th>
                <th style={{textAlign:'right', padding:'10px 16px'}}>Optimized (ABR)</th>
                <th style={{textAlign:'right', padding:'10px 16px', color:'var(--text-muted)', fontSize:'11px'}}>Δ Change</th>
              </tr>
            </thead>
            <tbody>
              <MetricRow label="Startup Delay" baseline={(baseline?.startup_delay_ms||0)/1000} optimized={(optimized?.startup_delay_ms||0)/1000} lowerIsBetter unit="s" />
              <MetricRow label="Stall Events"  baseline={baseline?.stall_count||0} optimized={optimized?.stall_count||0} lowerIsBetter />
              <MetricRow label="Total Rebuffering" baseline={baseline?.total_stall_duration_sec||0} optimized={optimized?.total_stall_duration_sec||0} lowerIsBetter unit="s" />
              <MetricRow label="Avg Bitrate"   baseline={baseline?.avg_bitrate_kbps||0} optimized={optimized?.avg_bitrate_kbps||0} lowerIsBetter={false} unit=" Kbps" />
              <MetricRow label="Quality Switches" baseline={baseline?.quality_switches||0} optimized={optimized?.quality_switches||0} lowerIsBetter={false} />
              <MetricRow label="Cache Hits"    baseline={baseline?.cache_hits||0} optimized={optimized?.cache_hits||0} lowerIsBetter={false} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row */}
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'16px', marginBottom:'16px'}}>
        {/* Timeline */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-lg">Buffer & Bitrate Timeline</div>
          </div>
          <div className="chart-container-lg">
            {timelineData && <Line data={timelineData} options={getTimelineOptions()} />}
          </div>
        </div>

        {/* Bar */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-lg">Performance</div>
          </div>
          <div className="chart-container">
            {barData && <Bar data={barData} options={getBarOptions()} />}
          </div>
        </div>

        {/* Doughnut */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-lg">Cache</div>
            <span className="simulated-tag">SIM</span>
          </div>
          <div className="chart-container" style={{height:'160px'}}>
            {cacheData && <Doughnut data={cacheData} options={getDoughnutOptions()} />}
          </div>
          {cacheStats && (
            <div style={{marginTop:'10px', fontSize:'11px', color:'var(--text-muted)'}}>
              <div>Hits: <strong style={{color:'var(--accent-green)'}}>{cacheStats.totalHits}</strong> &nbsp;|&nbsp; Misses: <strong style={{color:'var(--accent-red)'}}>{cacheStats.totalMisses}</strong></div>
              <div>Est. saved: <strong style={{color:'var(--accent-cyan)'}}>{cacheStats.latencySavedMs} ms</strong></div>
              <div style={{marginTop:'4px', fontStyle:'italic', fontSize:'10px'}}>{cacheStats.note}</div>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="card">
        <div className="card-title-lg" style={{marginBottom:'12px'}}>Analysis Summary</div>
        <div style={{fontSize:'13px', color:'var(--text-secondary)', lineHeight:'1.8'}}>
          {(() => {
            const baseStalls = parseInt(baseline?.stall_count || 0);
            const optStalls  = parseInt(optimized?.stall_count || 0);
            const baseStart  = parseInt(baseline?.startup_delay_ms || 0);
            const optStart   = parseInt(optimized?.startup_delay_ms || 0);
            const baseRebuf  = parseFloat(baseline?.total_stall_duration_sec || 0);
            const optRebuf   = parseFloat(optimized?.total_stall_duration_sec || 0);
            const stalImprove= baseStalls > 0 ? Math.round(((baseStalls - optStalls) / baseStalls) * 100) : 0;
            const winner     = optStalls < baseStalls || optRebuf < baseRebuf ? 'Optimized ABR' : 'Baseline';
            return (
              <>
                <p>
                  Under <strong>{session?.profile_name || 'the tested network conditions'}</strong>,
                  the <strong style={{color:'var(--accent-cyan)'}}>Optimized ABR player</strong> recorded{' '}
                  <strong style={{color: optStalls < baseStalls ? 'var(--accent-green)' : 'var(--accent-red)'}}>
                    {optStalls} buffering event{optStalls !== 1 ? 's' : ''}
                  </strong>{' '}
                  vs the Baseline's{' '}
                  <strong style={{color:'var(--accent-orange)'}}>{baseStalls}</strong>.
                  {stalImprove > 0 && ` That's a ${stalImprove}% reduction in stall events.`}
                </p>
                <p style={{marginTop:'8px'}}>
                  Startup delay was{' '}
                  <strong>{(optStart / 1000).toFixed(2)}s (ABR)</strong> vs{' '}
                  <strong>{(baseStart / 1000).toFixed(2)}s (Baseline)</strong>.
                  Total rebuffering: <strong style={{color:'var(--accent-cyan)'}}>{optRebuf}s (ABR)</strong> vs{' '}
                  <strong style={{color:'var(--accent-orange)'}}>{baseRebuf}s (Baseline)</strong>.
                </p>
                <p style={{marginTop:'8px', color:'var(--text-muted)', fontSize:'11px', fontStyle:'italic'}}>
                  ※ These metrics are {session?.measurement_mode === 'SIMULATED' ? 'simulated values based on configured network parameters' : 'browser-observed measurements'}. Cache statistics are always simulated (12ms hit / 260ms miss delays). Actual performance varies with real network conditions.
                </p>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

