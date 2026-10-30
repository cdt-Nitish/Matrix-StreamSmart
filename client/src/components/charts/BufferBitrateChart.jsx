import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { buildTimelineChartData, getTimelineOptions } from '../../utils/chartController';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function BufferBitrateChart({ baselineSeries, optimizedSeries }) {
  const data    = useMemo(() => buildTimelineChartData(baselineSeries, optimizedSeries), [baselineSeries, optimizedSeries]);
  const options = useMemo(() => getTimelineOptions(), []);

  const hasData = baselineSeries?.length > 0 || optimizedSeries?.length > 0;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-lg">Buffer & Bitrate Timeline</div>
        <span className="simulated-tag">⚡ Live</span>
      </div>
      <div style={{fontSize:'11px', color:'var(--text-muted)', marginBottom:'12px'}}>
        Buffer occupancy (solid) and bitrate (dashed) – Baseline vs Optimized
      </div>
      <div className="chart-container-lg">
        {hasData
          ? <Line data={data} options={options} />
          : (
            <div className="empty-state">
              <div className="empty-state-icon">📈</div>
              <div className="empty-state-text">No data yet</div>
              <div className="empty-state-sub">Start a benchmark to see live buffer & bitrate data</div>
            </div>
          )}
      </div>
    </div>
  );
}

