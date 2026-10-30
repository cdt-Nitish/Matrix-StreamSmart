/**
 * client/src/utils/chartController.js
 *
 * Chart.js data adapters for StreamSmart – SaaS Blue & White Design System
 *
 * Provides clean, professional dataset builders with high-contrast,
 * accessible typography, subtle grids, and corporate blue/slate palettes.
 */

// ── SaaS Blue & White Chart Palette (No purple/violet) ─────────────────────
export const CHART_COLORS = {
  primary:        '#2563EB', // Primary Blue
  primaryAlpha:   'rgba(37, 99, 235, 0.12)',
  primaryDark:    '#1E40AF',
  baseline:       '#64748B', // Neutral Slate (Fixed Baseline)
  baselineAlpha:  'rgba(100, 116, 139, 0.10)',
  optimized:      '#2563EB', // Primary Blue (Optimized ABR)
  optimizedAlpha: 'rgba(37, 99, 235, 0.14)',
  cacheHit:       '#16A34A', // Success Green
  cacheMiss:      '#DC2626', // Error Red
  gridLine:       '#F1F5F9', // Very subtle slate grid
  axisTick:       '#64748B', // Slate 500
  tooltipBg:      '#0F172A', // Dark Slate 900
};

// Common Chart.js options for Clean White SaaS theme
export const SAAS_CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 350 },
  plugins: {
    legend: {
      labels: {
        color: '#475569',
        font: { size: 12, weight: '500', family: "'Inter', system-ui, sans-serif" },
        boxWidth: 10,
        boxHeight: 10,
        padding: 14,
        usePointStyle: true,
      }
    },
    tooltip: {
      backgroundColor: '#0F172A',
      borderColor: '#E2E8F0',
      borderWidth: 1,
      titleColor: '#FFFFFF',
      bodyColor: '#F8FAFC',
      padding: 10,
      cornerRadius: 6,
      displayColors: true,
      titleFont: { size: 12, weight: '600', family: "'Inter', sans-serif" },
      bodyFont: { size: 11, family: "'Inter', sans-serif" },
    }
  },
  scales: {
    x: {
      ticks: {
        color: '#64748B',
        font: { size: 10, family: "'Inter', sans-serif" }
      },
      grid: {
        color: '#F1F5F9',
        tickColor: 'transparent'
      },
      border: { color: '#E2E8F0' }
    },
    y: {
      ticks: {
        color: '#64748B',
        font: { size: 10, family: "'Inter', sans-serif" }
      },
      grid: {
        color: '#F1F5F9',
        tickColor: 'transparent'
      },
      border: { color: '#E2E8F0' }
    }
  }
};

/**
 * Build dataset arrays for the Buffer + Bitrate timeline chart.
 * Blue & Slate corporate styling.
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
        label: 'Baseline Buffer (Fixed)',
        data: interpolate(baselineSeries, labels.map(l => parseFloat(l))),
        borderColor: CHART_COLORS.baseline,
        backgroundColor: CHART_COLORS.baselineAlpha,
        borderWidth: 2,
        tension: 0.25,
        fill: true,
        yAxisID: 'yBuffer',
        spanGaps: true,
        pointRadius: 0,
      },
      {
        label: 'Optimized Buffer (ABR)',
        data: interpolate(optimizedSeries, labels.map(l => parseFloat(l))),
        borderColor: CHART_COLORS.optimized,
        backgroundColor: CHART_COLORS.optimizedAlpha,
        borderWidth: 2.2,
        tension: 0.25,
        fill: true,
        yAxisID: 'yBuffer',
        spanGaps: true,
        pointRadius: 0,
      },
      {
        label: 'Baseline Bitrate (1080p)',
        data: interpolate(
          baselineSeries?.map(p => ({ ...p, buffer: p.bitrate })),
          labels.map(l => parseFloat(l))
        ),
        borderColor: '#94A3B8',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [4, 4],
        tension: 0.2,
        fill: false,
        yAxisID: 'yBitrate',
        spanGaps: true,
        pointRadius: 0,
      },
      {
        label: 'Optimized Bitrate (Dynamic)',
        data: interpolate(
          optimizedSeries?.map(p => ({ ...p, buffer: p.bitrate })),
          labels.map(l => parseFloat(l))
        ),
        borderColor: '#1D4ED8',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [3, 2],
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
    labels: ['Startup Delay (s)', 'Total Rebuffering (s)', 'Stall Count'],
    datasets: [
      {
        label: 'Baseline (Fixed 1080p)',
        data: [
          parseFloat(((baselineMetrics?.startup_delay_ms  || baselineMetrics?.startupDelayMs  || 0) / 1000).toFixed(2)),
          parseFloat((baselineMetrics?.total_stall_duration_sec  || baselineMetrics?.totalStallDurationSec  || 0)),
          parseInt(baselineMetrics?.stall_count  || baselineMetrics?.stallCount  || 0),
        ],
        backgroundColor: '#94A3B8',
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: 'Optimized (Adaptive ABR)',
        data: [
          parseFloat(((optimizedMetrics?.startup_delay_ms || optimizedMetrics?.startupDelayMs || 0) / 1000).toFixed(2)),
          parseFloat((optimizedMetrics?.total_stall_duration_sec || optimizedMetrics?.totalStallDurationSec || 0)),
          parseInt(optimizedMetrics?.stall_count || optimizedMetrics?.stallCount || 0),
        ],
        backgroundColor: '#2563EB',
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
  return {
    labels: ['Cache Hits (12ms)', 'Cache Misses (260ms)'],
    datasets: [{
      data: [hits || 0, misses || 0],
      backgroundColor: [CHART_COLORS.cacheHit, '#E2E8F0'],
      borderColor: ['#FFFFFF', '#FFFFFF'],
      borderWidth: 2,
      hoverOffset: 4,
    }]
  };
}

export function getTimelineOptions() {
  return {
    ...SAAS_CHART_DEFAULTS,
    scales: {
      x: { ...SAAS_CHART_DEFAULTS.scales.x },
      yBuffer: {
        type:     'linear',
        position: 'left',
        title:    { display: true, text: 'Buffer (s)', color: '#64748B', font: { size: 10, weight: '600' } },
        ticks:    { color: '#64748B', font: { size: 10 } },
        grid:     { color: '#F1F5F9' },
        min: 0,
      },
      yBitrate: {
        type:     'linear',
        position: 'right',
        title:    { display: true, text: 'Bitrate (Kbps)', color: '#64748B', font: { size: 10, weight: '600' } },
        ticks:    { color: '#64748B', font: { size: 10 } },
        grid:     { drawOnChartArea: false },
        min: 0,
      }
    }
  };
}

export function getBarOptions() {
  return {
    ...SAAS_CHART_DEFAULTS,
    plugins: {
      ...SAAS_CHART_DEFAULTS.plugins,
      legend: { ...SAAS_CHART_DEFAULTS.plugins.legend, position: 'top' }
    },
    scales: { ...SAAS_CHART_DEFAULTS.scales }
  };
}

export function getDoughnutOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    animation: { duration: 350 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#475569',
          font: { size: 11, family: "'Inter', sans-serif" },
          boxWidth: 10,
          boxHeight: 10,
          padding: 12,
          usePointStyle: true,
        }
      },
      tooltip: SAAS_CHART_DEFAULTS.plugins.tooltip,
    }
  };
}

export default {
  CHART_COLORS,
  SAAS_CHART_DEFAULTS,
  buildTimelineChartData,
  buildComparisonBarData,
  buildCacheDoughnutData,
  getTimelineOptions,
  getBarOptions,
  getDoughnutOptions
};
