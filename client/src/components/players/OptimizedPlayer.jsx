import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { createOptimizedPlayer } from '../../utils/dualPlayer';
import YouTubeQualitySelector from './YouTubeQualitySelector';

const OptimizedPlayer = forwardRef(function OptimizedPlayer(
  { src, networkConfig, onMetrics, sessionId },
  ref
) {
  const videoRef  = useRef(null);
  const playerRef = useRef(null);
  const [status, setStatus]   = useState('idle');
  const [levels, setLevels]   = useState([]);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [selectedLevelIndex, setSelectedLevelIndex] = useState(-1);
  const [metrics, setMetrics] = useState({
    currentResolution: '--',
    currentBitrateKbps: 0,
    currentBufferSec: 0,
    startupDelayMs: 0,
    stallCount: 0,
    totalStallDurationSec: 0,
    qualitySwitches: 0,
    isStarted: false,
    currentlyStalled: false,
  });

  useImperativeHandle(ref, () => ({
    getTracker: () => playerRef.current?.getTracker(),
    destroy: ()    => playerRef.current?.destroy(),
    setQuality: (idx) => handleSelectQuality(idx),
  }));

  const handleSelectQuality = (levelIndex) => {
    if (levelIndex === -1) {
      setIsAutoMode(true);
      setSelectedLevelIndex(-1);
    } else {
      setIsAutoMode(false);
      setSelectedLevelIndex(levelIndex);
    }
    if (playerRef.current?.setQuality) {
      playerRef.current.setQuality(levelIndex);
    }
  };

  useEffect(() => {
    if (!src || !videoRef.current) return;

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    setStatus('loading');
    setMetrics(m => ({ ...m, isStarted: false }));

    try {
      playerRef.current = createOptimizedPlayer({
        videoEl: videoRef.current,
        src,
        networkConfig: { ...networkConfig, sessionId },
        onMetrics: (m) => {
          setMetrics(m);
          setStatus(m.currentlyStalled ? 'stalled' : m.isStarted ? 'playing' : 'loading');
          onMetrics && onMetrics(m);
        },
        onLevels: (lvls) => {
          setLevels(lvls || []);
        },
        onError: (err) => {
          setStatus('error');
          console.error('[OptimizedPlayer] Error:', err);
        },
      });
    } catch (err) {
      setStatus('error');
      console.error('[OptimizedPlayer] Init error:', err);
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [src]);

  const statusLabel = { idle: 'Idle', loading: 'Loading…', playing: 'Playing', stalled: 'Buffering', error: 'Error' }[status] || status;

  return (
    <div className="player-card optimized">
      <div className="player-header">
        <div className="player-title">
          <span className="player-badge optimized">ABR</span>
          Adaptive Optimized Streaming
        </div>

        {/* YouTube-style Quality Selector */}
        <YouTubeQualitySelector
          levels={levels}
          currentLevelIndex={selectedLevelIndex}
          activeResolution={metrics.currentResolution}
          isAuto={isAutoMode}
          allowAuto={true}
          onSelectQuality={handleSelectQuality}
          playerType="OPTIMIZED"
        />
      </div>

      <div className="player-video-wrap">
        <video
          ref={videoRef}
          controls
          playsInline
          muted
          style={{ width: '100%', height: '100%' }}
        />

        <div className="player-overlay">
          <span className="player-overlay-badge">{metrics.currentResolution}</span>
          {metrics.currentBitrateKbps > 0 && (
            <span className="player-overlay-badge">{metrics.currentBitrateKbps} Kbps</span>
          )}
          {metrics.qualitySwitches > 0 && (
            <span className="player-overlay-badge" style={{color:'var(--accent-cyan)'}}>
              ↕ {metrics.qualitySwitches}
            </span>
          )}
        </div>

        <div className="player-status-indicator">
          <span className={`status-dot ${status}`} />
          {statusLabel}
        </div>
      </div>

      <div className="player-metrics-grid">
        <div className="player-metric-cell">
          <div className="player-metric-value">{metrics.currentResolution}</div>
          <div className="player-metric-label">Resolution</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value">
            {metrics.currentBitrateKbps > 0 ? `${metrics.currentBitrateKbps}` : '--'}
            <span style={{fontSize:'10px',color:'var(--text-muted)'}}> Kbps</span>
          </div>
          <div className="player-metric-label">Bitrate</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value">
            {metrics.currentBufferSec.toFixed(1)}
            <span style={{fontSize:'10px',color:'var(--text-muted)'}}> s</span>
          </div>
          <div className="player-metric-label">Buffer</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value" style={{color:'var(--accent-cyan)'}}>
            {metrics.qualitySwitches}
          </div>
          <div className="player-metric-label">Quality Switches</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value">
            {metrics.startupDelayMs > 0 ? (metrics.startupDelayMs / 1000).toFixed(2) : '--'}
            <span style={{fontSize:'10px',color:'var(--text-muted)'}}> s</span>
          </div>
          <div className="player-metric-label">Startup Delay</div>
        </div>
        <div className="player-metric-cell">
          <div className="player-metric-value" style={{color: metrics.stallCount > 0 ? 'var(--accent-orange)' : 'var(--text-primary)'}}>
            {metrics.stallCount}
          </div>
          <div className="player-metric-label">Stalls</div>
        </div>
      </div>
    </div>
  );
});

export default OptimizedPlayer;

