/**
 * dualPlayer.js – Dual HLS.js player controller
 *
 * Manages two independent HLS.js instances (Baseline + Optimized).
 * The Baseline player locks to the highest available rendition.
 * The Optimized player uses the custom ABR engine for quality selection.
 */

import Hls from 'hls.js';
import { createTelemetryTracker } from './telemetryTracker';
import { recommendQuality, ABR_INTERVAL_MS } from './abrEngine';

// ── Custom HLS.js loader factory ───────────────────────────────────────────
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

      // Wrap onSuccess to inject real network & edge cache simulation delay
      const wrappedCallbacks = {
        ...callbacks,
        onSuccess: (response, stats, ctx, networkDetails) => {
          try {
            // Packet loss simulation: randomly drop segment if packetLossPct > 0
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
            const delayToApply = Math.min(totalDelayMs, 6000);

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

// ── Baseline Player ────────────────────────────────────────────────────────

export function createBaselinePlayer({ videoEl, src, networkConfig, onMetrics, onLevels, onError }) {
  if (!Hls.isSupported()) {
    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = src;
      return { destroy: () => { videoEl.src = ''; }, getHls: () => null };
    }
    throw new Error('HLS is not supported in this browser');
  }

  const hls = new Hls({
    startLevel: -1,      // Will be set after MANIFEST_PARSED
    autoStartLoad: true,
    loader: createThrottledLoader(Hls.DefaultConfig, networkConfig),
  });

  const tracker = createTelemetryTracker({
    playerType: 'BASELINE',
    sessionId: networkConfig?.sessionId,
    onMetricsUpdate: onMetrics,
  });

  hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
    // Lock to the highest available level
    const highest = hls.levels.length - 1;
    hls.currentLevel      = highest;
    hls.loadLevel         = highest;
    hls.autoLevelEnabled  = false;
    console.log(`[Baseline] Locked to level ${highest}:`, hls.levels[highest]);
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
      console.log(`[Baseline] Manual quality locked to level ${target}:`, hls.levels[target]);
    }
  };
}

// ── Optimized Player with custom ABR ──────────────────────────────────────

export function createOptimizedPlayer({ videoEl, src, networkConfig, onMetrics, onLevels, onError }) {
  if (!Hls.isSupported()) {
    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = src;
      return { destroy: () => { videoEl.src = ''; }, getHls: () => null };
    }
    throw new Error('HLS is not supported in this browser');
  }

  const hls = new Hls({
    startLevel:      0,    // Start at lowest quality
    autoStartLoad:   true,
    autoLevelEnabled: false, // Disable built-in ABR; custom controller takes over
    loader: createThrottledLoader(Hls.DefaultConfig, networkConfig),
  });

  const tracker = createTelemetryTracker({
    playerType: 'OPTIMIZED',
    sessionId: networkConfig?.sessionId,
    onMetricsUpdate: onMetrics,
  });

  let abrInterval = null;
  let isAutoMode = true;

  function runABRTick() {
    if (!isAutoMode) return; // Respect manual user override
    if (!hls.levels || hls.levels.length === 0) return;

    const buffer = readBuffer(videoEl);
    const bwKbps = networkConfig?.bandwidthKbps
      || Math.round((hls.bandwidthEstimate || 2000000) / 1000);

    const { nextLevel, reason } = recommendQuality({
      currentLevel:  hls.currentLevel < 0 ? 0 : hls.currentLevel,
      bufferSec:     buffer,
      bandwidthKbps: bwKbps,
      hlsLevels:     hls.levels,
    });

    if (nextLevel !== hls.nextLevel) {
      console.log(`[Optimized ABR] ${reason} → Level ${nextLevel} | Buffer: ${buffer.toFixed(1)}s | BW: ${bwKbps}Kbps`);
      hls.nextLevel = nextLevel;
    }
  }

  function readBuffer(el) {
    if (!el || !el.buffered || el.buffered.length === 0) return 0;
    const ct = el.currentTime;
    for (let i = 0; i < el.buffered.length; i++) {
      if (ct >= el.buffered.start(i) && ct <= el.buffered.end(i)) {
        return Math.max(0, el.buffered.end(i) - ct);
      }
    }
    return 0;
  }

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    hls.currentLevel     = 0;
    hls.autoLevelEnabled = false;
    // Start ABR decision loop
    abrInterval = setInterval(runABRTick, ABR_INTERVAL_MS);
    console.log('[Optimized] Manifest parsed – custom ABR controller started');
    videoEl.play().catch(e => console.warn('[Optimized] Autoplay caught:', e.message));
    if (onLevels && hls.levels) {
      onLevels(hls.levels);
    }
  });

  hls.on(Hls.Events.ERROR, (event, data) => {
    if (data.fatal) {
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError();
          break;
        default:
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
        console.log('[Optimized] Switched to Auto (Custom ABR mode)');
      } else {
        isAutoMode = false;
        const target = Math.max(0, Math.min(levelIndex, hls.levels.length - 1));
        hls.currentLevel = target;
        hls.loadLevel = target;
        console.log(`[Optimized] Manual quality override to level ${target}:`, hls.levels[target]);
      }
    }
  };
}

