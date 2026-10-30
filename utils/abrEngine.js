/**
 * abrEngine.js – Custom ABR Quality-Selection Algorithm
 *
 * Implements the StreamSmart buffer-occupancy + bandwidth-safety-margin
 * heuristic. Both the browser-side controller (client/src/utils/abrEngine.js)
 * and this backend module use the same decision rules so that simulated
 * ABR decisions can be validated server-side.
 *
 * Decision interval: 1500 ms
 * Safety margin: 75% of available bandwidth
 *
 * Rules:
 *  1. B < 3.5 s  → step down one level  (BUFFER_RISK_DOWNSHIFT)
 *  2. B > 10 s AND next bitrate ≤ safeBandwidth → step up one level (STABLE_BANDWIDTH_UPSHIFT)
 *  3. Otherwise → hold current level (STEADY_STATE_HOLD)
 */

const QUALITY_LADDER = [
  { level: 0, label: '240p',  bitrateKbps: 400  },
  { level: 1, label: '360p',  bitrateKbps: 800  },
  { level: 2, label: '480p',  bitrateKbps: 1400 },
  { level: 3, label: '720p',  bitrateKbps: 2800 },
  { level: 4, label: '1080p', bitrateKbps: 5000 }
];

const ABR_INTERVAL_MS       = 1500;
const BUFFER_LOW_THRESHOLD  = 3.5;   // seconds – trigger downshift
const BUFFER_HIGH_THRESHOLD = 10.0;  // seconds – allow upshift
const BANDWIDTH_SAFETY      = 0.75;  // 75% safety margin

/**
 * Recommend the next quality level given current state.
 *
 * @param {object} params
 * @param {number} params.currentLevel    - Current zero-based level index (into hlsLevels if provided)
 * @param {number} params.bufferSec       - Current buffer occupancy in seconds
 * @param {number} params.bandwidthKbps   - Available/simulated bandwidth in Kbps
 * @param {Array}  [params.hlsLevels]     - Actual HLS.js levels [{bitrate, ...}].
 *                                          If omitted, QUALITY_LADDER is used.
 * @returns {{ nextLevel: number, reason: string, spec: object }}
 */
function recommendQuality({ currentLevel, bufferSec, bandwidthKbps, hlsLevels }) {
  const ladder = hlsLevels
    ? hlsLevels.map((l, i) => ({ level: i, label: `Level ${i}`, bitrateKbps: Math.round(l.bitrate / 1000) }))
    : QUALITY_LADDER;

  const maxLevel = ladder.length - 1;
  const safeLevel = Math.max(0, Math.min(currentLevel, maxLevel));
  const safeBandwidthKbps = bandwidthKbps * BANDWIDTH_SAFETY;

  // 1. Emergency downshift – buffer running dry
  if (bufferSec < BUFFER_LOW_THRESHOLD && safeLevel > 0) {
    const nextLevel = safeLevel - 1;
    return {
      nextLevel,
      reason: 'BUFFER_RISK_DOWNSHIFT',
      spec: ladder[nextLevel]
    };
  }

  // 2. Conservative upshift – buffer healthy and bandwidth supports next tier
  if (bufferSec > BUFFER_HIGH_THRESHOLD && safeLevel < maxLevel) {
    const candidate = ladder[safeLevel + 1];
    if (candidate.bitrateKbps <= safeBandwidthKbps) {
      return {
        nextLevel: safeLevel + 1,
        reason: 'STABLE_BANDWIDTH_UPSHIFT',
        spec: candidate
      };
    }
  }

  // 3. Steady state – hold current level
  return {
    nextLevel: safeLevel,
    reason: 'STEADY_STATE_HOLD',
    spec: ladder[safeLevel]
  };
}

module.exports = {
  QUALITY_LADDER,
  ABR_INTERVAL_MS,
  BUFFER_LOW_THRESHOLD,
  BUFFER_HIGH_THRESHOLD,
  BANDWIDTH_SAFETY,
  recommendQuality
};

