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
  animation: { duration: 300 },
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
 * Normalizes point data across varied schemas
 */
function normalizePoint(p) {
  if (!p) return null;
  const elapsed = Number(
    p.elapsed !== undefined
      ? p.elapsed
      : (p.elapsed_sec !== undefined
          ? p.elapsed_sec
          : (typeof p.timestamp === 'string' ? parseFloat(p.timestamp) : p.timestamp || 0))
  );

  const buffer = Number(
    p.buffer !== undefined
      ? p.buffer
      : (p.bufferSec !== undefined
          ? p.bufferSec
          : (p.buffer_level_sec !== undefined ? p.buffer_level_sec : 0))
  );

  const bitrate = Number(
    p.bitrate !== undefined
      ? p.bitrate
      : (p.bitrateKbps !== undefined
          ? p.bitrateKbps
          : (p.avg_bitrate_kbps !== undefined ? p.avg_bitrate_kbps : 0))
  );

  return { elapsed, buffer, bitrate };
}

/**
 * Build dataset arrays for the Buffer + Bitrate timeline chart.
 * Blue & Slate corporate styling.
 */
export function buildTimelineChartData(baselineSeries = [], optimizedSeries = []) {
  const normBase = (baselineSeries || []).map(normalizePoint).filter(Boolean);
  const normOpt  = (optimizedSeries || []).map(normalizePoint).filter(Boolean);

  const rawTimes = [
    ...normBase.map(p => p.elapsed),
    ...normOpt.map(p => p.elapsed)
  ].filter(t => !isNaN(t) && t >= 0);

  const uniqueTimes = [...new Set(rawTimes.map(t => Math.round(t)))].sort((a, b) => a - b);
  const labels = uniqueTimes.length > 0 ? uniqueTimes.map(t => `${t}s`) : ['0s'];

  const interpolate = (series, times, key) =>
    times.map(t => {
      if (!series || series.length === 0) return null;
      let best = null;
      let minDiff = 1.5;
      for (const p of series) {
        const diff = Math.abs(p.elapsed - t);
        if (diff <= minDiff) {
          minDiff = diff;
          best = p;
        }
      }
      return best ? best[key] : null;
    });

  return {
    labels,
    datasets: [
      {
        label: 'Baseline Buffer (Fixed)',
        data: interpolate(normBase, uniqueTimes, 'buffer'),
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
        data: interpolate(normOpt, uniqueTimes, 'buffer'),
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
        data: interpolate(normBase, uniqueTimes, 'bitrate'),
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
        data: interpolate(normOpt, uniqueTimes, 'bitrate'),
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
  const bStartup = parseFloat(((baselineMetrics?.startup_delay_ms  || baselineMetrics?.startupDelayMs  || 0) / 1000).toFixed(2));
  const bStallDur = parseFloat(Number(baselineMetrics?.total_stall_duration_sec  || baselineMetrics?.totalStallDurationSec  || 0).toFixed(2));
  const bStalls = parseInt(baselineMetrics?.stall_count  || baselineMetrics?.stallCount  || 0, 10);

  const oStartup = parseFloat(((optimizedMetrics?.startup_delay_ms || optimizedMetrics?.startupDelayMs || 0) / 1000).toFixed(2));
  const oStallDur = parseFloat(Number(optimizedMetrics?.total_stall_duration_sec || optimizedMetrics?.totalStallDurationSec || 0).toFixed(2));
  const oStalls = parseInt(optimizedMetrics?.stall_count || optimizedMetrics?.stallCount || 0, 10);

  return {
    labels: ['Startup Delay (s)', 'Total Rebuffering (s)', 'Stall Count'],
    datasets: [
      {
        label: 'Baseline (Fixed 1080p)',
        data: [bStartup, bStallDur, bStalls],
        backgroundColor: '#94A3B8',
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: 'Optimized (Adaptive ABR)',
        data: [oStartup, oStallDur, oStalls],
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
export function buildCacheDoughnutData(hits = 0, misses = 0) {
  const h = Math.max(0, parseInt(hits, 10) || 0);
  const m = Math.max(0, parseInt(misses, 10) || 0);

  if (h === 0 && m === 0) {
    return {
      labels: ['No Cache Requests'],
      datasets: [{
        data: [1],
        backgroundColor: ['#E2E8F0'],
        borderColor: ['#FFFFFF'],
        borderWidth: 2,
      }]
    };
  }

  return {
    labels: ['Cache Hits (12ms)', 'Cache Misses (260ms)'],
    datasets: [{
      data: [h, m],
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
    animation: { duration: 300 },
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
