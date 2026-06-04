import React, { useState, useRef, useEffect } from 'react';
import { X, Download, BarChart2, Image, Film, Music } from 'lucide-react';
import { API_BASE } from '../App';

export default function VideoPlayerModal({ video, onClose }) {
  const videoRef = useRef(null);
  
  // Filter video assets
  const videoAssets = video.assets.filter(a => a.assetType === 'VIDEO');
  const thumbnailAssets = video.assets.filter(a => a.assetType === 'THUMBNAIL');
  const audioAssets = video.assets.filter(a => a.assetType === 'AUDIO');
  
  // Set up resolution choices
  // Include original video as a choice
  const originalUrl = video.originalPath.startsWith('http') 
    ? video.originalPath 
    : `${API_BASE}/uploads/${video.originalPath}`;
    
  const initialResolutions = [
    { label: 'Original', url: originalUrl, id: 'original', format: video.mimeType.split('/')[1] || 'mp4', size: video.size }
  ];
  
  videoAssets.forEach(asset => {
    initialResolutions.push({
      label: asset.resolution,
      url: asset.url,
      id: asset.id,
      format: asset.format,
      size: asset.size
    });
  });

  const [resolutions] = useState(initialResolutions);
  const [activeRes, setActiveRes] = useState(initialResolutions[0]);

  // Handle resolution change without resetting play state or time
  const handleResolutionChange = (resolution) => {
    if (!videoRef.current || resolution.id === activeRes.id) return;

    const currentTime = videoRef.current.currentTime;
    const isPaused = videoRef.current.paused;

    setActiveRes(resolution);

    // In React/HTML5, we must load the source change, seek, and resume if playing
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.currentTime = currentTime;
        if (!isPaused) {
          videoRef.current.play().catch(err => console.log('Auto-play error on switch:', err));
        }
      }
    }, 50);
  };

  // Format File Size
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Calculate Compression/Savings
  const totalProcessedSize = videoAssets.reduce((sum, a) => sum + a.size, 0) + 
                            audioAssets.reduce((sum, a) => sum + a.size, 0) + 
                            thumbnailAssets.reduce((sum, a) => sum + a.size, 0);

  const savingsPercentage = video.size > 0 && totalProcessedSize > 0
    ? Math.max(0, Math.round(((video.size - totalProcessedSize) / video.size) * 100))
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{video.title}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Source: {video.originalName} ({formatBytes(video.size)})
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Custom Video Player Wrapper */}
          <div className="custom-player-wrapper">
            <video 
              ref={videoRef} 
              controls 
              autoPlay
              crossOrigin="anonymous"
            >
              <source src={activeRes.url} type={`video/${activeRes.format === 'mkv' ? 'mp4' : activeRes.format}`} />
              Your browser does not support the video tag.
            </video>

            {/* Resolution Selector overlay */}
            <div className="player-res-selector">
              {resolutions.map((res) => (
                <button
                  key={res.id}
                  className={`res-btn ${activeRes.id === res.id ? 'active' : ''}`}
                  onClick={() => handleResolutionChange(res)}
                >
                  {res.label}
                </button>
              ))}
            </div>
          </div>

          <div className="assets-grid">
            {/* Download Links Panel */}
            <div>
              <h4 className="assets-section-title">
                <Film size={16} style={{ verticalAlign: 'text-bottom', marginRight: '0.4rem' }} /> 
                Processed Output Assets
              </h4>
              <div className="download-list">
                {/* Videos */}
                {videoAssets.map((asset) => (
                  <div className="download-item" key={asset.id}>
                    <div className="download-item-info">
                      <span className="download-item-title">Transcode ({asset.resolution})</span>
                      <span className="download-item-meta">{asset.format.toUpperCase()} • {formatBytes(asset.size)}</span>
                    </div>
                    <a 
                      href={asset.url} 
                      download={pathName => pathName.split('/').pop()} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="download-action-btn"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                ))}

                {/* Audio Track */}
                {audioAssets.map((asset) => (
                  <div className="download-item" key={asset.id}>
                    <div className="download-item-info">
                      <span className="download-item-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Music size={14} className="text-warning" /> Isolated Audio
                      </span>
                      <span className="download-item-meta">MP3 Track • {formatBytes(asset.size)}</span>
                    </div>
                    <a 
                      href={asset.url} 
                      download 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="download-action-btn"
                      style={{ background: 'var(--color-warning)' }}
                    >
                      <Download size={16} />
                    </a>
                  </div>
                ))}
              </div>

              {/* Thumbnails Section */}
              {thumbnailAssets.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 className="assets-section-title">
                    <Image size={16} style={{ verticalAlign: 'text-bottom', marginRight: '0.4rem' }} /> 
                    Extracted Thumbnails ({thumbnailAssets.length})
                  </h4>
                  <div className="thumbnails-scroll-container">
                    {thumbnailAssets.map((asset) => (
                      <div className="thumb-preview-item" key={asset.id}>
                        <a href={asset.url} target="_blank" rel="noopener noreferrer">
                          <img src={asset.url} alt="Video Thumbnail" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Statistics Sidebar Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h4 className="assets-section-title">
                <BarChart2 size={16} style={{ verticalAlign: 'text-bottom', marginRight: '0.4rem' }} />
                Compression Performance
              </h4>
              
              <div className="stats-info-box">
                <div className="stats-row">
                  <span className="stats-label">Original Video Size</span>
                  <span className="stats-val">{formatBytes(video.size)}</span>
                </div>
                <div className="stats-row">
                  <span className="stats-label">Combined Outputs Size</span>
                  <span className="stats-val">{formatBytes(totalProcessedSize)}</span>
                </div>
                <div className="stats-divider"></div>
                <div className="stats-row">
                  <span className="stats-label">Video Duration</span>
                  <span className="stats-val">
                    {video.duration ? `${parseFloat(video.duration.toFixed(1))}s` : 'Unknown'}
                  </span>
                </div>
                <div className="stats-row">
                  <span className="stats-label">Mime Type</span>
                  <span className="stats-val">{video.mimeType}</span>
                </div>
                
                {savingsPercentage > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div className="savings-highlight">
                      <span className="savings-pill">{savingsPercentage}%</span>
                      <span className="savings-label">Storage Optimization</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
