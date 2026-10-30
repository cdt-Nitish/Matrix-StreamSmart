/**
 * client/src/utils/dualPlayer.js – Dual HLS.js Player Controller
 *
 * Manages two independent HLS.js instances (Baseline + Optimized).
 *  - Player 1 (Baseline): Fixed-quality streaming. Locked to the highest available
 *    rendition (or user-chosen fixed quality). Built-in and custom ABR are disabled.
 *  - Player 2 (Optimized): Custom Adaptive Bitrate (ABR) Streaming.
 *    Monitors real buffer occupancy and available bandwidth every 1500 ms.
 *    Applies emergency downshifts and conservative upshifts directly to HLS.js.
 */

import Hls from 'hls.js';
import { createTelemetryTracker } from './telemetryTracker';
import {
  recommendQuality,
  calculateBufferOccupancy,
  calculateSafeBandwidth,
  mapHlsLevels,
  ABR_INTERVAL_MS
} from '../algorithms/abrEngine';
import { logQualitySwitchEvent } from '../services/telemetryService';

// ── Custom HLS.js Loader Factory ───────────────────────────────────────────
// Simulates network bandwidth constraints, latency, and edge cache hit/miss delays
// directly on segment delivery to HLS.js MSE buffers.

function createThrottledLoader(config, networkConfig) {
  const DefaultLoader = config.loader;

  class ThrottledLoader extends DefaultLoader {
    load(context, loaderConfig, callbacks) {
      if (!networkConfig || !networkConfig.enabled || context.type !== 'fragment') {
        return super.load(context, loaderConfig, callbacks);
      }

      const originalOnSuccess = callbacks.onSuccess;

      // Wrap onSuccess to inject simulated network & edge cache delays
      const wrappedCallbacks = {
        ...callbacks,
        onSuccess: (response, stats, ctx, networkDetails) => {
          try {
            // Packet loss simulation: drop segment if packetLossPct condition met
            if (networkConfig.packetLossPct > 0 && Math.random() * 100 < networkConfig.packetLossPct) {
              if (callbacks.onError) {
                callbacks.onError({ code: 408, text: 'Simulated Packet Loss' }, ctx, networkDetails);
                return;
              }
            }

            // Segment size in bits
            const segmentBytes = stats?.total || stats?.loaded || response?.data?.byteLength || 500000;
            const segmentBits = segmentBytes * 8;
            const bwKbps = Math.max(100, networkConfig.bandwidthKbps || 4500);
            const bwBps = bwKbps * 1000;

            // Transfer time = (segmentBits / bwBps) * 1000
            const transferTimeMs = Math.round((segmentBits / bwBps) * 1000);
            const latencyMs = Math.max(0, networkConfig.latencyMs || 0);

            // Edge cache simulation: hit = 12ms, miss = 260ms
            const isHit = Math.random() < (networkConfig.cacheHitProb ?? 0.5);
            const cacheDelayMs = isHit ? 12 : 260;

            // Total simulated delay
            const totalDelayMs = transferTimeMs + latencyMs + cacheDelayMs;
            const delayToApply = Math.min(totalDelayMs, 8000);

            setTimeout(() => {
              originalOnSuccess.call(this, response, stats, ctx, networkDetails);
            }, delayToApply);
          } catch {
            originalOnSuccess.call(this, response, stats, ctx, networkDetails);
          }
        }
      };

      super.load(context, loaderConfig, wrappedCallbacks);
    }
  }

  return ThrottledLoader;
}

// ── Baseline Player (Fixed Quality Comparison) ─────────────────────────────

export function createBaselinePlayer({ videoEl, src, networkConfig, onMetrics, onLevels, onError }) {
  if (!Hls.isSupported()) {
    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = src;
      return { destroy: () => { videoEl.src = ''; }, getHls: () => null };
    }
    throw new Error('HLS is not supported in this browser');
  }

  const hls = new Hls({
    startLevel: -1,
    autoStartLoad: true,
    autoLevelEnabled: false,
    loader: createThrottledLoader(Hls.DefaultConfig, networkConfig),
  });

  const tracker = createTelemetryTracker({
    playerType: 'BASELINE',
    sessionId: networkConfig?.sessionId,
    onMetricsUpdate: onMetrics,
  });

  hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
    // Lock to the highest available rendition (preferably 1080p)
    const highest = hls.levels.length - 1;
    hls.currentLevel      = highest;
    hls.loadLevel         = highest;
    hls.autoLevelEnabled  = false;
    console.log(`[Baseline] Locked to highest level ${highest}:`, hls.levels[highest]);
    videoEl.play().catch(e => console.warn('[Baseline] Autoplay caught:', e.message));
    if (onLevels && hls.levels) {
      onLevels(hls.levels);
    }
  });

  hls.on(Hls.Events.ERROR, (event, data) => {
    if (data.fatal) {
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.warn('[Baseline] Fatal network error – attempting recovery');
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          console.warn('[Baseline] Fatal media error – attempting recovery');
          hls.recoverMediaError();
          break;
        default:
          console.error('[Baseline] Unrecoverable error:', data);
          onError && onError(data);
          break;
      }
    }
  });

  hls.loadSource(src);
  hls.attachMedia(videoEl);
  tracker.attach(videoEl, hls);

  return {
    destroy() {
      tracker.detach();
      hls.destroy();
    },
    getHls:     () => hls,
    getTracker: () => tracker,
    setQuality(levelIndex) {
      if (!hls || !hls.levels) return;
      const target = Math.max(0, Math.min(levelIndex, hls.levels.length - 1));
      hls.currentLevel = target;
      hls.loadLevel = target;
      hls.autoLevelEnabled = false;
      console.log(`[Baseline] Fixed quality locked to level ${target}:`, hls.levels[target]);
    }
  };
}

// ── Optimized Player (Custom ABR Heuristic) ────────────────────────────────

export function createOptimizedPlayer({
  videoEl,
  src,
  networkConfig,
  onMetrics,
  onLevels,
  onABRStateChange,
  onQualitySwitch,
  onError
}) {
  if (!Hls.isSupported()) {
    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = src;
      return { destroy: () => { videoEl.src = ''; }, getHls: () => null };
    }
    throw new Error('HLS is not supported in this browser');
  }

  const hls = new Hls({
    startLevel:       0,     // Start at lowest quality tier for rapid startup
    autoStartLoad:    true,
    autoLevelEnabled: false, // Explicitly disable built-in ABR
    loader: createThrottledLoader(Hls.DefaultConfig, networkConfig),
  });

  const tracker = createTelemetryTracker({
    playerType: 'OPTIMIZED',
    sessionId: networkConfig?.sessionId,
    onMetricsUpdate: onMetrics,
  });

  let abrInterval = null;
  let isAutoMode = true;
  let currentTargetLevel = 0;
  const startTime = Date.now();

  function runABRTick() {
    if (!hls.levels || hls.levels.length === 0) return;

    // 1. Calculate actual buffer occupancy ahead of current playback position
    const buffer = calculateBufferOccupancy(videoEl);

    // 2. Determine bandwidth: simulated bandwidth vs HLS.js EWMA estimate
    const hlsBwEstimate = hls.bandwidthEstimate
      ? Math.round(hls.bandwidthEstimate / 1000)
      : 0;
    const simBw = networkConfig?.bandwidthKbps || 4500;
    const availableBw = simBw;
    const safeBw = calculateSafeBandwidth(availableBw);

    const activeLevelIndex = hls.currentLevel >= 0 ? hls.currentLevel : currentTargetLevel;

    // If user selected manual resolution override, pause automatic switches
    if (!isAutoMode) {
      if (onABRStateChange) {
        onABRStateChange({
          decision: 'MANUAL_OVERRIDE',
          reasonDetail: `Manual override locked to Level ${activeLevelIndex}`,
          bufferSec: buffer,
          availableBandwidthKbps: availableBw,
          safeBandwidthKbps: Math.round(safeBw),
          estimatedBandwidthKbps: hlsBwEstimate,
          simulatedBandwidthKbps: simBw,
          isAuto: false,
          currentLevelIndex: activeLevelIndex
        });
      }
      return;
    }

    // Ensure built-in HLS.js ABR remains disabled
    if (hls.autoLevelEnabled) {
      hls.autoLevelEnabled = false;
    }

    // 3. Evaluate Custom ABR Heuristic
    const recommendation = recommendQuality({
      currentLevel: activeLevelIndex,
      bufferSec: buffer,
      bandwidthKbps: availableBw,
      hlsLevels: hls.levels,
    });

    // Notify React component of live ABR diagnostic state
    if (onABRStateChange) {
      onABRStateChange({
        decision: recommendation.reason,
        reasonDetail: recommendation.reasonDetail,
        bufferSec: buffer,
        availableBandwidthKbps: availableBw,
        safeBandwidthKbps: Math.round(safeBw),
        estimatedBandwidthKbps: hlsBwEstimate,
        simulatedBandwidthKbps: simBw,
        isAuto: true,
        currentLevelIndex: activeLevelIndex
      });
    }

    // 4. Apply actual HLS.js quality change if target differs
    if (recommendation.nextLevel !== currentTargetLevel) {
      const ladder = mapHlsLevels(hls.levels);
      const fromSpec = ladder[currentTargetLevel] || { label: `Level ${currentTargetLevel}` };
      const toSpec = ladder[recommendation.nextLevel] || { label: `Level ${recommendation.nextLevel}` };

      console.log(
        `[Optimized ABR] ${recommendation.reason}: ${fromSpec.label} → ${toSpec.label} | Buffer: ${buffer.toFixed(1)}s | Safe BW: ${Math.round(safeBw)}Kbps`
      );

      // Instruct HLS.js to switch level at fragment boundary
      hls.nextLevel = recommendation.nextLevel;

      // In emergency downshift, also set currentLevel to immediately drop quality
      if (recommendation.reason === 'BUFFER_RISK_DOWNSHIFT') {
        hls.currentLevel = recommendation.nextLevel;
      }

      currentTargetLevel = recommendation.nextLevel;

      const elapsedSec = (Date.now() - startTime) / 1000;
      const switchData = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        elapsedSec: parseFloat(elapsedSec.toFixed(1)),
        fromLevel: fromSpec.label,
        toLevel: toSpec.label,
        reason: recommendation.reason,
        reasonDetail: recommendation.reasonDetail,
        bufferSec: parseFloat(buffer.toFixed(1)),
        bandwidthKbps: availableBw,
        safeBandwidthKbps: Math.round(safeBw)
      };

      if (onQualitySwitch) {
        onQualitySwitch(switchData);
      }

      // Record to MySQL database asynchronously
      logQualitySwitchEvent({
        sessionId: networkConfig?.sessionId,
        playerType: 'OPTIMIZED',
        elapsedSec,
        previousResolution: fromSpec.label,
        newResolution: toSpec.label,
        bufferLevelSec: buffer,
        bandwidthKbps: availableBw,
        reason: recommendation.reason
      });
    }
  }

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    // Start at lowest level for rapid first-frame delivery
    hls.currentLevel     = 0;
    currentTargetLevel   = 0;
    hls.autoLevelEnabled = false;

    // Run decision loop every 1500 ms
    if (abrInterval) clearInterval(abrInterval);
    abrInterval = setInterval(runABRTick, ABR_INTERVAL_MS);

    console.log('[Optimized] Manifest parsed – custom ABR controller active');
    videoEl.play().catch(e => console.warn('[Optimized] Autoplay caught:', e.message));

    if (onLevels && hls.levels) {
      onLevels(hls.levels);
    }
  });

  hls.on(Hls.Events.ERROR, (event, data) => {
    if (data.fatal) {
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          console.warn('[Optimized] Fatal network error – starting load recovery');
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          console.warn('[Optimized] Fatal media error – recovering media');
          hls.recoverMediaError();
          break;
        default:
          console.error('[Optimized] Unrecoverable error:', data);
          onError && onError(data);
          break;
      }
    }
  });

  hls.loadSource(src);
  hls.attachMedia(videoEl);
  tracker.attach(videoEl, hls);

  return {
    destroy() {
      if (abrInterval) clearInterval(abrInterval);
      tracker.detach();
      hls.destroy();
    },
    getHls:     () => hls,
    getTracker: () => tracker,
    setQuality(levelIndex) {
      if (!hls) return;
      if (levelIndex === -1) {
        isAutoMode = true;
        console.log('[Optimized] Switched to Auto (Custom ABR active)');
      } else {
        isAutoMode = false;
        const target = Math.max(0, Math.min(levelIndex, hls.levels.length - 1));
        hls.currentLevel = target;
        hls.loadLevel = target;
        currentTargetLevel = target;
        console.log(`[Optimized] Manual quality override to level ${target}:`, hls.levels[target]);
      }
    }
  };
}
