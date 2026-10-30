import React, { useRef, useState } from 'react';

/**
 * YouTubeVideoRail – YouTube-style Horizontal Scrollable Video Rail
 *
 * Displays 10+ benchmark video streams with rich thumbnails, duration badges,
 * resolution tags, category filtering, and smooth horizontal scrolling navigation.
 */
export default function YouTubeVideoRail({
  videos = [],
  selectedVideo,
  onSelectVideo,
  disabled = false
}) {
  const trackRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique categories
  const categories = ['All', ...new Set(videos.map(v => v.category || 'General').filter(Boolean))];

  // Filter videos based on category and search query
  const filteredVideos = videos.filter(v => {
    const matchesCategory = activeCategory === 'All' || (v.category || 'General') === activeCategory;
    const matchesSearch = !searchQuery || (
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.category && v.category.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return matchesCategory && matchesSearch;
  });

  const scroll = (direction) => {
    if (trackRef.current) {
      const scrollAmount = direction === 'left' ? -360 : 360;
      trackRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="yt-video-rail-container">
      {/* ── Header: Title, Category Chips & Search ─────────────────── */}
      <div className="yt-rail-header">
        <div style={{display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap'}}>
          <div className="yt-rail-title">
            <span style={{color:'var(--accent-red)'}}>▶</span> Video Catalog
            <span className="yt-count-badge">{videos.length} Streams</span>
          </div>
          <span style={{fontSize:'12px', color:'var(--text-secondary)'}}>
            Scroll horizontally to choose any benchmark video
          </span>
        </div>

        {/* Scroll arrows and search */}
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <input
            type="text"
            className="yt-search-input"
            placeholder="Search streams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="button"
            className="yt-scroll-arrow"
            onClick={() => scroll('left')}
            title="Scroll left"
          >
            ◀
          </button>
          <button
            type="button"
            className="yt-scroll-arrow"
            onClick={() => scroll('right')}
            title="Scroll right"
          >
            ▶
          </button>
        </div>
      </div>

      {/* ── Category Filter Chips ───────────────────────────────────── */}
      <div className="yt-category-chips">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`yt-chip ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Horizontal Scroll Track (At least 10-12 videos) ─────────── */}
      <div className="yt-rail-track" ref={trackRef}>
        {filteredVideos.map((video) => {
          const isSelected = selectedVideo?.video_id === video.video_id;

          return (
            <div
              key={video.video_id}
              className={`yt-video-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => !disabled && onSelectVideo(video)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                  onSelectVideo(video);
                }
              }}
            >
              {/* Thumbnail Container */}
              <div className="yt-card-thumb-wrap">
                <img
                  src={video.thumbnail_url || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=480&auto=format&fit=crop&q=80'}
                  alt={video.title}
                  className="yt-card-thumb"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to high-contrast tech gradient thumbnail if image fails
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.parentElement.style.background = 'linear-gradient(135deg, #0d1e38, #1a3860)';
                    }
                  }}
                />

                {/* Badges on Thumbnail */}
                <div className="yt-card-badge-top-left">
                  {video.category || 'General'}
                </div>

                <div className="yt-card-badge-top-right">
                  {video.badge || '1080p HD'}
                </div>

                <div className="yt-card-duration">
                  {video.duration_formatted || `${video.duration_sec || 60}s`}
                </div>

                {/* Hover Play Overlay */}
                <div className="yt-card-hover-overlay">
                  <span className="yt-play-icon">▶</span>
                </div>

                {/* Selected Status Ribbon */}
                {isSelected && (
                  <div className="yt-card-selected-ribbon">
                    ✓ ACTIVE BENCHMARK
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="yt-card-info">
                <div className="yt-card-title" title={video.title}>
                  {video.title}
                </div>
                <div className="yt-card-tiers">
                  {video.available_tiers || '240p, 360p, 480p, 720p, 1080p'}
                </div>
                <div className="yt-card-meta">
                  <span className="text-cyan">HLS .m3u8</span>
                  <span>•</span>
                  <span>{video.duration_formatted || `${video.duration_sec}s`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

