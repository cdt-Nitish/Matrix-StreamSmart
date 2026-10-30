/**
 * abrEngine.js (client-side) – Custom ABR Quality-Selection Algorithm
 *
 * Mirrors the backend utils/abrEngine.js logic exactly.
 * Applied to the Optimized HLS.js instance every ABR_INTERVAL_MS.
 *
 * Decision rules:
 *  1. bufferSec < 3.5 s        → step down one level
 *  2. bufferSec > 10 s AND next bitrate ≤ safeBandwidth → step up one level
 *  3. otherwise                → hold current level
 */

export const ABR_INTERVAL_MS       = 1500;
export const BUFFER_LOW_THRESHOLD  = 3.5;
export const BUFFER_HIGH_THRESHOLD = 10.0;
export const BANDWIDTH_SAFETY      = 0.75;

export const QUALITY_LADDER = [
  { level: 0, label: '240p',  bitrateKbps: 400  },
  { level: 1, label: '360p',  bitrateKbps: 800  },
  { level: 2, label: '480p',  bitrateKbps: 1400 },
  { level: 3, label: '720p',  bitrateKbps: 2800 },
  { level: 4, label: '1080p', bitrateKbps: 5000 },
];

/**
 * @param {object} params
 * @param {number} params.currentLevel    – current zero-based HLS.js level index
 * @param {number} params.bufferSec       – current buffer occupancy (seconds)
 * @param {number} params.bandwidthKbps   – available/simulated bandwidth (Kbps)
 * @param {Array}  [params.hlsLevels]     – actual hls.levels array
 * @returns {{ nextLevel: number, reason: string, label: string }}
 */
export function recommendQuality({ currentLevel, bufferSec, bandwidthKbps, hlsLevels }) {
  const ladder = hlsLevels && hlsLevels.length > 0
    ? hlsLevels.map((l, i) => ({
        level: i,
        label: l.height ? `${l.height}p` : `Level ${i}`,
        bitrateKbps: Math.round((l.bitrate || l.averageBitrate || 0) / 1000)
      }))
    : QUALITY_LADDER;

  const maxLevel = ladder.length - 1;
  const cur = Math.max(0, Math.min(currentLevel, maxLevel));
  const safeBW = bandwidthKbps * BANDWIDTH_SAFETY;

  // 1. Emergency downshift
  if (bufferSec < BUFFER_LOW_THRESHOLD && cur > 0) {
    return { nextLevel: cur - 1, reason: 'BUFFER_RISK_DOWNSHIFT', label: ladder[cur - 1].label };
  }

  // 2. Conservative upshift
  if (bufferSec > BUFFER_HIGH_THRESHOLD && cur < maxLevel) {
    const next = ladder[cur + 1];
    if (next.bitrateKbps <= safeBW) {
      return { nextLevel: cur + 1, reason: 'STABLE_BANDWIDTH_UPSHIFT', label: next.label };
    }
  }

  // 3. Steady state
  return { nextLevel: cur, reason: 'STEADY_STATE_HOLD', label: ladder[cur].label };
}

