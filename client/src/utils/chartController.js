/**
 * chartController.js – Chart.js data adapters for StreamSmart analytics
 *
 * Provides helpers to build/update Chart.js dataset objects from
 * live telemetry time-series and stored session data.
 */

export const CHART_COLORS = {
  baseline:       '#f5a623',
  baselineAlpha:  'rgba(245,166,35,0.15)',
  optimized:      '#00c9e0',
  optimizedAlpha: 'rgba(0,201,224,0.12)',
  cacheHit:       '#00d68f',
  cacheMiss:      '#e84040',
  bitrate:        '#1d72e8',
};

/**
 * Build dataset arrays for the Buffer + Bitrate timeline chart.
 * Returns a Chart.js data object ready for react-chartjs-2.
 */
export function buildTimelineChartData(baselineSeries, optimizedSeries) {
  const labels = [...new Set([
    ...(baselineSeries?.map(p => p.elapsed) || []),
    ...(optimizedSeries?.map(p => p.elapsed) || []),
  ])].sort((a, b) => a - b).map(t => `${t.toFixed(0)}s`);

  const interpolate = (series, times) =>
    times.map(t => {
      const pt = series?.find(p => parseFloat(p.elapsed?.toFixed(0)) === parseFloat(t));
      return pt ? pt.buffer : null;
    });

  return {
    labels,
    datasets: [
      {
        label: 'Baseline Buffer (s)',
        data: interpolate(baselineSeries, labels.map(l => parseFloat(l))),
        borderColor: CHART_COLORS.baseline,
        backgroundColor: CHART_COLORS.baselineAlpha,
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        yAxisID: 'yBuffer',
        spanGaps: true,
      },
      {
        label: 'Optimized Buffer (s)',
        data: interpolate(optimizedSeries, labels.map(l => parseFloat(l))),
        borderColor: CHART_COLORS.optimized,
        backgroundColor: CHART_COLORS.optimizedAlpha,
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        yAxisID: 'yBuffer',
        spanGaps: true,
      },
      {
        label: 'Baseline Bitrate (Kbps)',
        data: interpolate(
          baselineSeries?.map(p => ({ ...p, buffer: p.bitrate })),
          labels.map(l => parseFloat(l))
        ),
        borderColor: CHART_COLORS.baseline,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [4, 3],
        tension: 0.2,
        fill: false,
        yAxisID: 'yBitrate',
        spanGaps: true,
        pointRadius: 0,
      },
      {
        label: 'Optimized Bitrate (Kbps)',
        data: interpolate(
          optimizedSeries?.map(p => ({ ...p, buffer: p.bitrate })),
          labels.map(l => parseFloat(l))
        ),
        borderColor: CHART_COLORS.optimized,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [4, 3],
        tension: 0.2,
        fill: false,
        yAxisID: 'yBitrate',
        spanGaps: true,
        pointRadius: 0,
      },
    ]
  };
}

/**
 * Build grouped bar chart data for startup / stall comparison.
 */
export function buildComparisonBarData(baselineMetrics, optimizedMetrics) {
  return {
    labels: ['Startup Delay (s)', 'Total Rebuffering (s)', 'Stall Events'],
    datasets: [
      {
        label: 'Baseline',
        data: [
          parseFloat(((baselineMetrics?.startup_delay_ms  || baselineMetrics?.startupDelayMs  || 0) / 1000).toFixed(2)),
          parseFloat((baselineMetrics?.total_stall_duration_sec  || baselineMetrics?.totalStallDurationSec  || 0)),
          parseInt(baselineMetrics?.stall_count  || baselineMetrics?.stallCount  || 0),
        ],
        backgroundColor: CHART_COLORS.baseline,
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: 'Optimized',
        data: [
          parseFloat(((optimizedMetrics?.startup_delay_ms || optimizedMetrics?.startupDelayMs || 0) / 1000).toFixed(2)),
          parseFloat((optimizedMetrics?.total_stall_duration_sec || optimizedMetrics?.totalStallDurationSec || 0)),
          parseInt(optimizedMetrics?.stall_count || optimizedMetrics?.stallCount || 0),
        ],
        backgroundColor: CHART_COLORS.optimized,
        borderRadius: 4,
        borderSkipped: false,
      },
    ]
  };
}

/**
 * Build doughnut chart data for cache efficiency.
 */
export function buildCacheDoughnutData(hits, misses) {
  const total = (hits || 0) + (misses || 0);
  return {
    labels: ['Cache Hits', 'Cache Misses'],
    datasets: [{
      data: [hits || 0, misses || 0],
      backgroundColor: [CHART_COLORS.cacheHit, CHART_COLORS.cacheMiss],
      borderColor: ['rgba(0,214,143,0.3)', 'rgba(232,64,64,0.3)'],
      borderWidth: 1,
      hoverOffset: 4,
    }]
  };
}

// Common Chart.js options for dark theme
export const DARK_CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  plugins: {
    legend: {
      labels: { color: '#7a94b8', font: { size: 11 }, boxWidth: 10, padding: 12 }
    },
    tooltip: {
      backgroundColor: '#111c30',
      borderColor: '#1e2d45',
      borderWidth: 1,
      titleColor: '#e4eaf5',
      bodyColor: '#7a94b8',
      padding: 10,
    }
  },
  scales: {
    x: {
      ticks:  { color: '#3d5170', font: { size: 10 } },
      grid:   { color: 'rgba(30,45,69,0.6)' },
    },
    y: {
      ticks:  { color: '#3d5170', font: { size: 10 } },
      grid:   { color: 'rgba(30,45,69,0.6)' },
    }
  }
};

export function getTimelineOptions() {
  return {
    ...DARK_CHART_DEFAULTS,
    scales: {
      x:       { ...DARK_CHART_DEFAULTS.scales.x },
      yBuffer: {
        type:     'linear',
        position: 'left',
        title:    { display: true, text: 'Buffer (s)', color: '#3d5170', font: { size: 10 } },
        ticks:    { color: '#3d5170', font: { size: 10 } },
        grid:     { color: 'rgba(30,45,69,0.6)' },
        min: 0,
      },
      yBitrate: {
        type:     'linear',
        position: 'right',
        title:    { display: true, text: 'Bitrate (Kbps)', color: '#3d5170', font: { size: 10 } },
        ticks:    { color: '#3d5170', font: { size: 10 } },
        grid:     { drawOnChartArea: false },
        min: 0,
      }
    }
  };
}

export function getBarOptions() {
  return {
    ...DARK_CHART_DEFAULTS,
    plugins: {
      ...DARK_CHART_DEFAULTS.plugins,
      legend: { ...DARK_CHART_DEFAULTS.plugins.legend, position: 'top' }
    },
    scales: { ...DARK_CHART_DEFAULTS.scales }
  };
}

export function getDoughnutOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#7a94b8', font: { size: 11 }, boxWidth: 10, padding: 10 }
      },
      tooltip: DARK_CHART_DEFAULTS.plugins.tooltip,
    }
  };
}

