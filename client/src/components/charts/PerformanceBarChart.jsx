import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend
} from 'chart.js';
import { buildComparisonBarData, getBarOptions } from '../../utils/chartController';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PerformanceBarChart({ baselineMetrics, optimizedMetrics }) {
  const data    = useMemo(() => buildComparisonBarData(baselineMetrics, optimizedMetrics), [baselineMetrics, optimizedMetrics]);
  const options = useMemo(() => getBarOptions(), []);

  const hasData = baselineMetrics || optimizedMetrics;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-lg">Performance Comparison</div>
      </div>
      <div style={{fontSize:'11px', color:'var(--text-muted)', marginBottom:'12px'}}>
        Startup delay · Rebuffering · Interruptions
      </div>
      <div className="chart-container">
        {hasData
          ? <Bar data={data} options={options} />
          : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">No data yet</div>
              <div className="empty-state-sub">Run a benchmark to compare players</div>
            </div>
          )}
      </div>
    </div>
  );
}

