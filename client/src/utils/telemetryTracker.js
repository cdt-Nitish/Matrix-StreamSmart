/**
 * telemetryTracker.js – Client-side playback telemetry collection
 *
 * Attaches to an HTML5 video element and HLS.js instance.
 * Measures: startup delay, stall count, stall duration, buffer occupancy,
 * average bitrate, quality switches, and cache metrics.
 *
 * Call tracker.getMetrics() to read the current snapshot.
 * Call tracker.getTimeSeries() for chart data.
 */

export function createTelemetryTracker({ playerType, sessionId, onMetricsUpdate }) {
  const state = {
    playerType,
    sessionId,
    // Timing
    initTime: null,
    startTime: null,
    startupDelayMs: 0,
    started: false,
    // Stalls
    stallCount: 0,
    stallStart: null,
    totalStallDurationMs: 0,
    currentlyStalled: false,
    // Bitrate
    bitrateSamples: [],
    currentBitrateKbps: 0,
    currentResolution: 'N/A',
    // Quality
    qualitySwitches: 0,
    // Cache (simulated – reported from segment simulation)
    cacheHits: 0,
    cacheMisses: 0,
    // Buffer
    currentBufferSec: 0,
    // Time series for charts (sampled every second)
    timeSeries: [],
  };

  let video = null;
  let hls   = null;
  let tickInterval = null;

  // ── Video event listeners ─────────────────────────────────────────

  function onLoadedData() {
    if (!state.started) {
      state.startTime    = performance.now();
      state.startupDelayMs = Math.round(state.startTime - (state.initTime || state.startTime));
      state.started      = true;
    }
  }

  function onWaiting() {
    if (!state.currentlyStalled) {
      state.currentlyStalled = true;
      state.stallStart       = performance.now();
      state.stallCount++;
    }
  }

  function onPlaying() {
    if (state.currentlyStalled) {
      state.currentlyStalled  = false;
      const dur               = performance.now() - (state.stallStart || performance.now());
      state.totalStallDurationMs += dur;
      state.stallStart        = null;
    }
    if (!state.started) {
      state.startTime = performance.now();
      state.startupDelayMs = Math.round(state.startTime - (state.initTime || state.startTime));
      state.started   = true;
    }
  }

  function readBuffer() {
    if (!video || !video.buffered || video.buffered.length === 0) return 0;
    const ct = video.currentTime;
    for (let i = 0; i < video.buffered.length; i++) {
      if (ct >= video.buffered.start(i) && ct <= video.buffered.end(i)) {
        return Math.max(0, video.buffered.end(i) - ct);
      }
    }
    return 0;
  }

  function tickMetrics() {
    if (!video) return;
    const bufferSec = readBuffer();
    state.currentBufferSec = bufferSec;

    const elapsed = state.started && state.startTime
      ? (performance.now() - state.startTime) / 1000
      : 0;

    // Sample bitrate
    if (state.currentBitrateKbps > 0) {
      state.bitrateSamples.push(state.currentBitrateKbps);
    }

    // Push to time series (keep last 120 points = 2 min at 1s interval)
    state.timeSeries.push({
      elapsed: parseFloat(elapsed.toFixed(1)),
      buffer:  parseFloat(bufferSec.toFixed(2)),
      bitrate: state.currentBitrateKbps,
      resolution: state.currentResolution,
    });
    if (state.timeSeries.length > 120) state.timeSeries.shift();

    onMetricsUpdate && onMetricsUpdate(getMetrics());
  }

  // ── HLS.js event handlers ─────────────────────────────────────────

  function onManifestParsed(event, data) {
    state.initTime = performance.now();
  }

  function onFragLoaded(event, data) {
    const bitrateKbps = Math.round((data.frag.bitrate || 0) / 1000);
    if (bitrateKbps > 0) {
      state.currentBitrateKbps = bitrateKbps;
    }
  }

  function onLevelSwitched(event, data) {
    state.qualitySwitches++;
    if (hls && hls.levels && hls.levels[data.level]) {
      const lv = hls.levels[data.level];
      state.currentBitrateKbps   = Math.round((lv.bitrate || 0) / 1000);
      state.currentResolution     = lv.height ? `${lv.height}p` : `L${data.level}`;
    }
  }

  function onError(event, data) {
    // Non-fatal errors are handled by HLS.js itself
    if (data.fatal) {
      console.error(`[${playerType}] Fatal HLS error:`, data.type, data.details);
    }
  }

  // ── Public API ────────────────────────────────────────────────────

  function attach(videoEl, hlsInstance) {
    video = videoEl;
    hls   = hlsInstance;

    // HTML5 video events
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('waiting',    onWaiting);
    video.addEventListener('playing',    onPlaying);

    // HLS.js events
    if (hls) {
      const Hls = hls.constructor;
      hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      hls.on(Hls.Events.FRAG_LOADED,     onFragLoaded);
      hls.on(Hls.Events.LEVEL_SWITCHED,  onLevelSwitched);
      hls.on(Hls.Events.ERROR,           onError);
    }

    // 1-second polling tick
    tickInterval = setInterval(tickMetrics, 1000);
  }

  function detach() {
    if (video) {
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('waiting',    onWaiting);
      video.removeEventListener('playing',    onPlaying);
    }
    if (hls) {
      const Hls = hls.constructor;
      hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      hls.off(Hls.Events.FRAG_LOADED,     onFragLoaded);
      hls.off(Hls.Events.LEVEL_SWITCHED,  onLevelSwitched);
      hls.off(Hls.Events.ERROR,           onError);
    }
    if (tickInterval) clearInterval(tickInterval);
  }

  function recordCacheEvent(isHit) {
    if (isHit) state.cacheHits++; else state.cacheMisses++;
  }

  function getMetrics() {
    const avgBitrate = state.bitrateSamples.length > 0
      ? Math.round(state.bitrateSamples.reduce((a, b) => a + b, 0) / state.bitrateSamples.length)
      : state.currentBitrateKbps;

    return {
      playerType:            state.playerType,
      startupDelayMs:        state.startupDelayMs,
      stallCount:            state.stallCount,
      totalStallDurationSec: parseFloat((state.totalStallDurationMs / 1000).toFixed(2)),
      avgBitrateKbps:        avgBitrate,
      currentBitrateKbps:    state.currentBitrateKbps,
      currentResolution:     state.currentResolution,
      qualitySwitches:       state.qualitySwitches,
      cacheHits:             state.cacheHits,
      cacheMisses:           state.cacheMisses,
      currentBufferSec:      parseFloat(state.currentBufferSec.toFixed(2)),
      currentlyStalled:      state.currentlyStalled,
      isStarted:             state.started,
    };
  }

  function getTimeSeries() {
    return [...state.timeSeries];
  }

  function reset() {
    Object.assign(state, {
      initTime: null, startTime: null, startupDelayMs: 0, started: false,
      stallCount: 0, stallStart: null, totalStallDurationMs: 0, currentlyStalled: false,
      bitrateSamples: [], currentBitrateKbps: 0, currentResolution: 'N/A',
      qualitySwitches: 0, cacheHits: 0, cacheMisses: 0, currentBufferSec: 0, timeSeries: [],
    });
  }

  return { attach, detach, recordCacheEvent, getMetrics, getTimeSeries, reset };
}

