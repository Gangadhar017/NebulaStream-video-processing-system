import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Film, Loader2, Play, Trash2, Settings, 
  RefreshCw, CheckCircle, AlertCircle, Clock, Database, 
  BarChart, Sparkles, Video, Volume2, Image, Layers, ArrowRight
} from 'lucide-react';
import VideoPlayerModal from './components/VideoPlayerModal';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Upload States
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Modal / Selection States
  const [playingVideo, setPlayingVideo] = useState(null);
  const [selectedVideoForConfig, setSelectedVideoForConfig] = useState(null);
  
  // Job settings state
  const [jobSettings, setJobSettings] = useState({
    resolutions: ['720p', '480p'],
    formats: ['mp4'],
    watermarkText: 'AETHERFLOW',
    extractAudio: true,
    thumbnailsCount: 3
  });

  const connectedIds = useRef(new Set());
  const fileInputRef = useRef(null);

  // Fetch all videos
  const fetchVideos = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/videos`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setVideos(data);
      }
    } catch (err) {
      console.error('Error fetching videos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Live SSE connection for progress updates
  useEffect(() => {
    const activeJobs = videos.filter(v => v.status === 'QUEUED' || v.status === 'PROCESSING');

    activeJobs.forEach(job => {
      if (connectedIds.current.has(job.id)) return;

      connectedIds.current.add(job.id);
      const es = new EventSource(`${API_BASE}/api/videos/${job.id}/progress-stream`);
      
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          setVideos(prevVideos => prevVideos.map(v => {
            if (v.id === job.id) {
              if (data.status === 'COMPLETED' || data.status === 'FAILED') {
                connectedIds.current.delete(job.id);
                es.close();
              }
              return {
                ...v,
                status: data.status,
                progress: data.progress,
                error: data.error,
                assets: data.assets || v.assets
              };
            }
            return v;
          }));
        } catch (err) {
          console.error('Error parsing SSE data:', err);
          es.close();
          connectedIds.current.delete(job.id);
        }
      };

      es.onerror = () => {
        es.close();
        connectedIds.current.delete(job.id);
      };
    });
  }, [videos]);

  // Handle file upload via XHR
  const handleFileUpload = (file) => {
    if (!file) return;
    
    // Size check (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      alert('File size exceeds the 500MB limit.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadingFile({ name: file.name, size: file.size });

    const formData = new FormData();
    formData.append('video', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/videos/upload`, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 201) {
        const newVideo = JSON.parse(xhr.responseText);
        setVideos(prev => [newVideo, ...prev]);
        setSelectedVideoForConfig(newVideo);
      } else {
        alert('Upload failed: ' + xhr.responseText);
      }
      setUploading(false);
      setUploadingFile(null);
    };

    xhr.onerror = () => {
      alert('Upload network error occurred.');
      setUploading(false);
      setUploadingFile(null);
    };

    xhr.send(formData);
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Delete video handler
  const handleDeleteVideo = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this video and all processed files?')) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/videos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setVideos(prev => prev.filter(v => v.id !== id));
        if (selectedVideoForConfig?.id === id) {
          setSelectedVideoForConfig(null);
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Submit transcode job
  const handleStartProcessing = async () => {
    if (!selectedVideoForConfig) return;

    try {
      const res = await fetch(`${API_BASE}/api/videos/${selectedVideoForConfig.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobSettings)
      });

      if (res.ok) {
        const data = await res.json();
        setVideos(prev => prev.map(v => {
          if (v.id === selectedVideoForConfig.id) {
            return { ...v, status: 'QUEUED', progress: 0 };
          }
          return v;
        }));
        setSelectedVideoForConfig(null); // Clear panel
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to dispatch job');
      }
    } catch (err) {
      console.error('Process error:', err);
    }
  };

  // Toggle option checkboxes
  const toggleResolution = (res) => {
    setJobSettings(prev => {
      const resolutions = prev.resolutions.includes(res)
        ? prev.resolutions.filter(r => r !== res)
        : [...prev.resolutions, res];
      return { ...prev, resolutions };
    });
  };

  const toggleFormat = (fmt) => {
    setJobSettings(prev => {
      const formats = prev.formats.includes(fmt)
        ? prev.formats.filter(f => f !== fmt)
        : [...prev.formats, fmt];
      return { ...prev, formats };
    });
  };

  // Helper formats
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Compute stats metrics
  const totalVideos = videos.length;
  const processingCount = videos.filter(v => v.status === 'PROCESSING' || v.status === 'QUEUED').length;
  const completedCount = videos.filter(v => v.status === 'COMPLETED').length;
  
  // Calculate total original size and total saved size
  const totalOriginalSize = videos.reduce((sum, v) => sum + v.size, 0);
  let totalProcessedSize = 0;
  videos.forEach(v => {
    if (v.status === 'COMPLETED') {
      v.assets.forEach(a => {
        totalProcessedSize += a.size;
      });
    }
  });

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon">
            <Sparkles size={22} />
          </div>
          <div className="logo-text">
            <h1>AetherFlow</h1>
            <p>Cloud Transcode System</p>
          </div>
        </div>
        <button className="refresh-btn" onClick={fetchVideos} title="Refresh Dashboard">
          <RefreshCw size={18} />
        </button>
      </header>

      {/* Stats Board */}
      <div className="stats-grid">
        <div className="stat-card videos">
          <div className="stat-icon-wrapper">
            <Film size={20} />
          </div>
          <div className="stat-info">
            <h3>Library Volume</h3>
            <p>{totalVideos} {totalVideos === 1 ? 'Video' : 'Videos'}</p>
          </div>
        </div>

        <div className="stat-card processing">
          <div className="stat-icon-wrapper">
            <Loader2 size={20} className={processingCount > 0 ? 'animate-spin' : ''} />
          </div>
          <div className="stat-info">
            <h3>Active Queue</h3>
            <p>{processingCount} Processing</p>
          </div>
        </div>

        <div className="stat-card completed">
          <div className="stat-icon-wrapper">
            <CheckCircle size={20} />
          </div>
          <div className="stat-info">
            <h3>Transcoded</h3>
            <p>{completedCount} Complete</p>
          </div>
        </div>

        <div className="stat-card storage">
          <div className="stat-icon-wrapper">
            <Database size={20} />
          </div>
          <div className="stat-info">
            <h3>Original Storage</h3>
            <p>{formatBytes(totalOriginalSize)}</p>
          </div>
        </div>
      </div>

      {/* Layout Split */}
      <div className="dashboard-layout">
        
        {/* Left Side: Upload & Job Panel */}
        <div className="sidebar-panel">
          
          {/* Uploader Box */}
          <div 
            className={`panel uploader-box ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="video/*"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              disabled={uploading}
            />
            <div className="upload-icon">
              {uploading ? <Loader2 size={28} className="animate-spin" /> : <Upload size={28} />}
            </div>
            <div className="upload-text">
              {uploading ? (
                <>
                  <h4>Uploading Media...</h4>
                  <p>{uploadingFile?.name} ({formatBytes(uploadingFile?.size)})</p>
                </>
              ) : (
                <>
                  <h4>Select Video File</h4>
                  <p>Drag and drop or click to upload</p>
                </>
              )}
            </div>

            {uploading && (
              <div className="upload-progress-container">
                <div className="upload-progress-info">
                  <span>Progress</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div 
                    className="progress-bar-fill animated" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Job Configuration Options */}
          {selectedVideoForConfig ? (
            <div className="panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h3 className="panel-title">
                <Settings size={18} />
                Configure Job pipeline
              </h3>
              
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                Applying parameters to: <strong style={{ color: '#fff' }}>{selectedVideoForConfig.title}</strong>
              </div>

              {/* Resolution options */}
              <div className="form-group">
                <label>Target Resolutions</label>
                <div className="checkbox-group">
                  {['1080p', '720p', '480p'].map(res => (
                    <div 
                      key={res} 
                      className={`checkbox-card ${jobSettings.resolutions.includes(res) ? 'selected' : ''}`}
                      onClick={() => toggleResolution(res)}
                    >
                      <input 
                        type="checkbox" 
                        checked={jobSettings.resolutions.includes(res)}
                        onChange={() => {}} // handled by click
                      />
                      <span className="checkbox-label">{res}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formats options */}
              <div className="form-group">
                <label>Container Formats</label>
                <div className="checkbox-group">
                  {['mp4', 'webm', 'mkv'].map(fmt => (
                    <div 
                      key={fmt} 
                      className={`checkbox-card ${jobSettings.formats.includes(fmt) ? 'selected' : ''}`}
                      onClick={() => toggleFormat(fmt)}
                    >
                      <input 
                        type="checkbox" 
                        checked={jobSettings.formats.includes(fmt)}
                        onChange={() => {}}
                      />
                      <span className="checkbox-label">{fmt.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Watermark overlay */}
              <div className="form-group">
                <label>Watermark Text</label>
                <input 
                  type="text" 
                  className="text-input" 
                  value={jobSettings.watermarkText}
                  onChange={(e) => setJobSettings(prev => ({ ...prev, watermarkText: e.target.value }))}
                  placeholder="e.g. AETHERFLOW"
                />
              </div>

              {/* Add-ons options */}
              <div className="form-group">
                <label>Extra Processing Steps</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div 
                    className={`checkbox-card ${jobSettings.extractAudio ? 'selected' : ''}`}
                    onClick={() => setJobSettings(prev => ({ ...prev, extractAudio: !prev.extractAudio }))}
                  >
                    <input 
                      type="checkbox" 
                      checked={jobSettings.extractAudio} 
                      onChange={() => {}}
                    />
                    <Volume2 size={16} style={{ color: 'var(--color-warning)' }} />
                    <span className="checkbox-label">Isolate MP3 Audio track</span>
                  </div>

                  <div 
                    className={`checkbox-card ${jobSettings.thumbnailsCount > 0 ? 'selected' : ''}`}
                    onClick={() => setJobSettings(prev => ({ ...prev, thumbnailsCount: prev.thumbnailsCount > 0 ? 0 : 3 }))}
                  >
                    <input 
                      type="checkbox" 
                      checked={jobSettings.thumbnailsCount > 0} 
                      onChange={() => {}}
                    />
                    <Image size={16} style={{ color: 'var(--color-success)' }} />
                    <span className="checkbox-label">Extract 3 thumbnail frames</span>
                  </div>
                </div>
              </div>

              <button 
                className="btn-primary"
                onClick={handleStartProcessing}
                disabled={jobSettings.resolutions.length === 0 && jobSettings.formats.length === 0 && !jobSettings.extractAudio}
              >
                <span>Dispatch Job Queue</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="panel" style={{ textAlign: 'center', padding: '2rem 1.5rem', color: 'var(--color-text-muted)' }}>
              <Settings size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
              <p style={{ fontSize: '0.85rem' }}>Upload or select a video from library to configure transcoding parameters.</p>
            </div>
          )}
        </div>

        {/* Right Side: Video Library */}
        <div className="library-panel">
          <div className="library-header">
            <h2>Video Library</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {videos.length} total items
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '5rem 0' }}>
              <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--color-primary)' }} />
              <p>Loading database library...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Video size={28} />
              </div>
              <div>
                <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No videos in library</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Get started by uploading your first video.</p>
              </div>
            </div>
          ) : (
            <div className="videos-grid">
              {videos.map((video) => {
                const isProcessing = video.status === 'PROCESSING' || video.status === 'QUEUED';
                
                // Get one thumbnail if available
                const thumbAsset = video.assets.find(a => a.assetType === 'THUMBNAIL');
                
                return (
                  <div key={video.id} className="video-card">
                    {/* Thumbnail preview /fallback */}
                    <div className="video-preview">
                      {thumbAsset ? (
                        <img src={thumbAsset.url} alt={video.title} />
                      ) : (
                        <div className="video-preview-fallback">
                          <Film size={32} style={{ opacity: 0.4 }} />
                          <span>No Preview</span>
                        </div>
                      )}
                      
                      {/* Duration badge */}
                      {video.duration && (
                        <span className="duration-badge">
                          {parseFloat(video.duration.toFixed(1))}s
                        </span>
                      )}

                      {/* Status indicator overlay */}
                      <span className={`status-overlay ${video.status.toLowerCase()}`}>
                        <span className="status-indicator"></span>
                        {video.status}
                      </span>
                    </div>

                    {/* Metadata body */}
                    <div className="video-card-body">
                      <div className="video-card-title" title={video.title}>
                        {video.title}
                      </div>

                      <div className="video-card-meta">
                        <span>{formatBytes(video.size)}</span>
                        <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                      </div>

                      {/* Progress bar or assets */}
                      {isProcessing ? (
                        <div className="video-card-progress">
                          <div className="video-progress-text">
                            <span>Transcoding pipeline</span>
                            <span>{video.progress}%</span>
                          </div>
                          <div className="progress-bar-bg">
                            <div 
                              className="progress-bar-fill animated" 
                              style={{ width: `${video.progress}%`, background: 'var(--color-secondary)' }}
                            ></div>
                          </div>
                        </div>
                      ) : video.status === 'COMPLETED' ? (
                        <div className="video-assets-tags">
                          {video.assets.map(asset => (
                            <span key={asset.id} className={`asset-tag ${asset.assetType.toLowerCase()}`}>
                              {asset.assetType === 'VIDEO' ? asset.resolution : asset.assetType}
                            </span>
                          ))}
                        </div>
                      ) : video.status === 'FAILED' ? (
                        <div className="video-error-text" title={video.error || ''}>
                          <AlertCircle size={12} style={{ verticalAlign: 'text-bottom', marginRight: '0.25rem' }} />
                          {video.error || 'Job processing failed'}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          Upload complete. Ready to process.
                        </div>
                      )}

                      {/* Card actions footer */}
                      <div className="video-card-actions">
                        <div>
                          {video.status === 'UPLOADED' && (
                            <button 
                              className="btn-card-action play"
                              onClick={() => setSelectedVideoForConfig(video)}
                            >
                              <Settings size={14} />
                              Configure
                            </button>
                          )}
                          {video.status === 'COMPLETED' && (
                            <button 
                              className="btn-card-action play"
                              onClick={() => setPlayingVideo(video)}
                            >
                              <Play size={14} />
                              Watch & Download
                            </button>
                          )}
                        </div>
                        <button 
                          className="btn-card-action delete"
                          onClick={(e) => handleDeleteVideo(video.id, e)}
                          title="Delete Video"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Watch Modal Overlay */}
      {playingVideo && (
        <VideoPlayerModal 
          video={playingVideo} 
          onClose={() => setPlayingVideo(null)} 
        />
      )}
    </div>
  );
}
