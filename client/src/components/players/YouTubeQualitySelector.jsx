import React, { useState, useRef, useEffect } from 'react';

/**
 * YouTubeQualitySelector – YouTube-style Quality Settings Menu
 *
 * Provides a gear settings button (⚙️) with a popover menu showing
 * all available video quality renditions parsed from the HLS stream,
 * complete with checkmark indicators and HD badges.
 */
export default function YouTubeQualitySelector({
  levels = [],
  currentLevelIndex = -1,
  activeResolution = '--',
  isAuto = true,
  allowAuto = false,
  onSelectQuality,
  playerType = 'BASELINE'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Format label for button
  const buttonLabel = allowAuto
    ? (isAuto ? `Auto (${activeResolution !== '--' ? activeResolution : 'ABR'})` : activeResolution)
    : (activeResolution !== '--' ? activeResolution : '1080p HD');

  // Parse and sort levels from highest to lowest
  const parsedLevels = (levels && levels.length > 0)
    ? levels.map((lvl, idx) => {
        const height = lvl.height || (lvl.attrs?.RESOLUTION ? parseInt(lvl.attrs.RESOLUTION.split('x')[1]) : 0);
        const bitrateKbps = Math.round((lvl.bitrate || 0) / 1000);
        return {
          index: idx,
          height: height || (idx === 0 ? 240 : idx === 1 ? 360 : idx === 2 ? 480 : idx === 3 ? 720 : 1080),
          bitrateKbps,
          label: height ? `${height}p` : `Level ${idx + 1}`,
          isHD: height >= 720
        };
      }).sort((a, b) => b.height - a.height)
    : [
        { index: 4, height: 1080, label: '1080p', isHD: true, bitrateKbps: 5000 },
        { index: 3, height: 720,  label: '720p',  isHD: true, bitrateKbps: 2800 },
        { index: 2, height: 480,  label: '480p',  isHD: false, bitrateKbps: 1400 },
        { index: 1, height: 360,  label: '360p',  isHD: false, bitrateKbps: 800 },
        { index: 0, height: 240,  label: '240p',  isHD: false, bitrateKbps: 400 },
      ];

  const handleSelect = (idx) => {
    onSelectQuality && onSelectQuality(idx);
    setIsOpen(false);
  };

  return (
    <div className="yt-quality-container" ref={popoverRef}>
      <button
        type="button"
        className={`yt-quality-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Change video quality (YouTube style)"
      >
        <span className="yt-gear-icon">⚙️</span>
        <span className="yt-quality-btn-text">{buttonLabel}</span>
        <span className="yt-caret">▾</span>
      </button>

      {isOpen && (
        <div className="yt-quality-popover">
          <div className="yt-popover-header">
            <span style={{fontSize:'12px', fontWeight:600}}>⚙️ Quality for this player</span>
            <span style={{fontSize:'10px', color:'var(--text-muted)'}}>{playerType}</span>
          </div>

          <div className="yt-popover-body">
            {allowAuto && (
              <button
                type="button"
                className={`yt-quality-item ${isAuto ? 'selected' : ''}`}
                onClick={() => handleSelect(-1)}
              >
                <span className="yt-item-check">{isAuto ? '✓' : ''}</span>
                <div className="yt-item-content">
                  <span className="yt-item-title">
                    Auto <span className="yt-auto-tag">Recommended</span>
                  </span>
                  <span className="yt-item-sub">
                    Adapts to buffer & bandwidth in real time
                  </span>
                </div>
              </button>
            )}

            <div className="yt-popover-divider" />
            <div className="yt-popover-section-label">SELECT SPECIFIC RESOLUTION</div>

            {parsedLevels.map((lvl) => {
              const isSelected = !isAuto && (
                currentLevelIndex === lvl.index ||
                activeResolution.startsWith(`${lvl.height}p`)
              );

              return (
                <button
                  key={lvl.index}
                  type="button"
                  className={`yt-quality-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(lvl.index)}
                >
                  <span className="yt-item-check">{isSelected ? '✓' : ''}</span>
                  <div className="yt-item-content">
                    <span className="yt-item-title">
                      {lvl.label}
                      {lvl.isHD && <span className="yt-hd-badge">HD</span>}
                    </span>
                    {lvl.bitrateKbps > 0 && (
                      <span className="yt-item-sub">
                        ~{lvl.bitrateKbps >= 1000 ? `${(lvl.bitrateKbps / 1000).toFixed(1)} Mbps` : `${lvl.bitrateKbps} Kbps`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="yt-popover-footer">
            {playerType === 'BASELINE'
              ? 'Fixed quality demonstrates network constraint effects'
              : 'Auto mode utilizes the custom 3-rule ABR algorithm'}
          </div>
        </div>
      )}
    </div>
  );
}

