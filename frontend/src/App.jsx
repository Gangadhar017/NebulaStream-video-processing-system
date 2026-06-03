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
  const [activeTab, setActiveTab] = useState('library');
  
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

  // Webcam States
  const [devices, setDevices] = useState({ video: [], audio: [] });
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [webcamTitle, setWebcamTitle] = useState('Webcam Capture');
  const [webcamDescription, setWebcamDescription] = useState('');

  // Stream URL Import States
  const [streamUrl, setStreamUrl] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [isImportingStream, setIsImportingStream] = useState(false);

  const connectedIds = useRef(new Set());
  const fileInputRef = useRef(null);
  const webcamVideoRef = useRef(null);

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

  // Handle webcam tab init and cleanups
  useEffect(() => {
    if (activeTab === 'webcam') {
      initWebcamTab();
    } else {
      stopCameraFeed();
    }
  }, [activeTab]);

  // Auto restart camera feed when active devices change
  useEffect(() => {
    if (cameraStream && activeTab === 'webcam') {
      startCameraFeed();
    }
  }, [selectedVideoDevice, selectedAudioDevice]);

  // Recording timer increment
  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Initialize webcam devices selection
  const initWebcamTab = async () => {
    try {
      // Request initial permission to enumerate labeled devices
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      permissionStream.getTracks().forEach(t => t.stop()); // turn off immediately
      
      const devicesList = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devicesList.filter(d => d.kind === 'videoinput');
      const audioDevs = devicesList.filter(d => d.kind === 'audioinput');
      setDevices({ video: videoDevs, audio: audioDevs });
      
      if (videoDevs.length > 0) setSelectedVideoDevice(videoDevs[0].deviceId);
      if (audioDevs.length > 0) setSelectedAudioDevice(audioDevs[0].deviceId);
    } catch (err) {
      console.warn('Media devices access or labels blocked:', err);
    }
  };

  // Start Camera Feed
  const startCameraFeed = async () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }

    try {
      const constraints = {
        video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Failed to start camera feed:', err);
      alert('Could not access camera/mic stream: ' + err.message);
    }
  };

  // Stop Camera Feed
  const stopCameraFeed = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setIsRecording(false);
  };

  // Start Media Recording
  const handleStartRecording = () => {
    if (!cameraStream) return;
    setRecordedBlob(null);
    setRecordingPreviewUrl(null);

    const chunks = [];
    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8,opus' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
    }

    const recorder = new MediaRecorder(cameraStream, options);
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setRecordedBlob(blob);
      setRecordingPreviewUrl(URL.createObjectURL(blob));
    };

    recorder.start(1000);
    setMediaRecorder(recorder);
    setIsRecording(true);
  };

  // Stop Media Recording
  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  // Format recording seconds to MM:SS
  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Submit Webcam Recording Upload
  const handleUploadWebcam = () => {
    if (!recordedBlob) return;
    
    const file = new File(
      [recordedBlob], 
      `webcam-record-${Date.now()}.webm`, 
      { type: 'video/webm' }
    );
    
    handleFileUpload(file, webcamTitle, webcamDescription);
    
    // Reset webcam form fields
    setRecordedBlob(null);
    setRecordingPreviewUrl(null);
    setWebcamTitle('Webcam Capture');
    setWebcamDescription('');
    stopCameraFeed();
  };

  // Submit Stream URL Import
  const handleImportStreamSubmit = async (e) => {
    e.preventDefault();
    if (!streamUrl) return;

    setIsImportingStream(true);
    try {
      const res = await fetch(`${API_BASE}/api/videos/import-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: streamUrl,
          title: streamTitle,
          description: streamDescription
        })
      });

      if (res.ok) {
        const newVideo = await res.json();
        setVideos(prev => [newVideo, ...prev]);
        setSelectedVideoForConfig(newVideo);
        setStreamUrl('');
        setStreamTitle('');
        setStreamDescription('');
        setActiveTab('library'); // Switch back to configure
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to import stream URL');
      }
    } catch (err) {
      console.error('Import Stream URL Error:', err);
      alert('Network error occurred while importing stream URL.');
    } finally {
      setIsImportingStream(false);
    }
  };

  // Handle file upload via XHR (supports custom title and description)
  const handleFileUpload = (file, customTitle = '', customDescription = '') => {
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
    if (customTitle) formData.append('title', customTitle);
    if (customDescription) formData.append('description', customDescription);

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
        setActiveTab('library');
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
    if (bytes === undefined || bytes === null || bytes === 0) return 'Stream Source';
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
  
  // Calculate total original size
  const totalOriginalSize = videos.reduce((sum, v) => sum + (v.size || 0), 0);

  return (
    <div className="dashboard-wrapper">
      
      {/* Left Sidebar Navigation */}
      <aside className="app-sidebar">
        <div>
          <div className="sidebar-brand">
            <div className="brand-logo">
              <Sparkles size={22} />
            </div>
            <div className="brand-text">
              <h2>AetherFlow</h2>
              <span>Transcode Matrix</span>
            </div>
          </div>

          <nav className="sidebar-menu">
            <button 
              className={`menu-item ${activeTab === 'library' ? 'active' : ''}`}
              onClick={() => setActiveTab('library')}
            >
              <Film size={18} />
              <span>Video Library</span>
              {processingCount > 0 && <span className="badge-pulse">{processingCount}</span>}
            </button>

            <button 
              className={`menu-item ${activeTab === 'webcam' ? 'active' : ''}`}
              onClick={() => setActiveTab('webcam')}
            >
              <Video size={18} />
              <span>Webcam Recorder</span>
            </button>

            <button 
              className={`menu-item ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveTab('import')}
            >
              <Layers size={18} />
              <span>Import Stream</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="footer-status">
            <div className="status-dot online"></div>
            <span>Transcoder Active</span>
          </div>
          <div className="footer-meta">
            <span>AWS Fargate Engine cluster</span>
          </div>
        </div>
      </aside>

      {/* Right Content Panel */}
      <main className="main-content">
        <header className="content-header">
          <div className="header-title-area">
            <h1>
              {activeTab === 'library' ? 'Dashboard Overview' : 
               activeTab === 'webcam' ? 'Live Webcam Recording' : 
               'Import Network Stream'}
            </h1>
            <p className="header-subtitle">
              {activeTab === 'library' ? 'Transcode, isolate audio tracks, and manage watermarks' : 
               activeTab === 'webcam' ? 'Capture video directly in browser and upload to transcoder' : 
               'Ingest and process remote HTTP/HLS live video links'}
            </p>
          </div>

          <button className="btn-refresh" onClick={fetchVideos} title="Refresh Assets">
            <RefreshCw size={16} />
            <span>Sync Library</span>
          </button>
        </header>

        {/* Global uploading display at top of content area */}
        {uploading && (
          <div className="panel global-upload-banner">
            <div className="upload-banner-info">
              <div className="upload-banner-desc">
                <Loader2 size={18} className="animate-spin text-primary" />
                <span>Uploading <strong>{uploadingFile?.name}</strong> ({formatBytes(uploadingFile?.size)})</span>
              </div>
              <span className="upload-banner-pct">{uploadProgress}%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill animated" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </div>
        )}

        {/* Library Dashboard Tab */}
        {activeTab === 'library' && (
          <>
            {/* Stats Summary Panel */}
            <div className="stats-grid">
              <div className="stat-card videos">
                <div className="stat-icon-wrapper">
                  <Film size={20} />
                </div>
                <div className="stat-info">
                  <h3>Library Size</h3>
                  <p>{totalVideos} {totalVideos === 1 ? 'Video' : 'Videos'}</p>
                </div>
              </div>

              <div className="stat-card processing">
                <div className="stat-icon-wrapper">
                  <Loader2 size={20} className={processingCount > 0 ? 'animate-spin' : ''} />
                </div>
                <div className="stat-info">
                  <h3>Active Jobs</h3>
                  <p>{processingCount} Queueing</p>
                </div>
              </div>

              <div className="stat-card completed">
                <div className="stat-icon-wrapper">
                  <CheckCircle size={20} />
                </div>
                <div className="stat-info">
                  <h3>Processed Assets</h3>
                  <p>{completedCount} Transcoded</p>
                </div>
              </div>

              <div className="stat-card storage">
                <div className="stat-icon-wrapper">
                  <Database size={20} />
                </div>
                <div className="stat-info">
                  <h3>Original Volume</h3>
                  <p>{formatBytes(totalOriginalSize)}</p>
                </div>
              </div>
            </div>

            {/* Dashboard Split Grid */}
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
                        <h4>Uploading Video...</h4>
                        <p>{uploadingFile?.name} ({formatBytes(uploadingFile?.size)})</p>
                      </>
                    ) : (
                      <>
                        <h4>Upload Video File</h4>
                        <p>Drag & drop or click to browse</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Transcode Configuration settings */}
                {selectedVideoForConfig ? (
                  <div className="panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <h3 className="panel-title">
                      <Settings size={18} />
                      Transcode Engine Config
                    </h3>
                    
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                      Target asset: <strong style={{ color: '#fff' }}>{selectedVideoForConfig.title}</strong>
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
                              onChange={() => {}}
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
                      <span>Dispatch transcode job</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="panel" style={{ textAlign: 'center', padding: '2rem 1.5rem', color: 'var(--color-text-muted)' }}>
                    <Settings size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                    <p style={{ fontSize: '0.85rem' }}>Select a video from the library to configure parameters and dispatch transcoding.</p>
                  </div>
                )}
              </div>

              {/* Right Side: Video Library */}
              <div className="library-panel">
                <div className="library-header">
                  <h2>Video Library</h2>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {videos.length} total assets
                  </span>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '5rem 0' }}>
                    <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--color-primary)' }} />
                    <p>Syncing library...</p>
                  </div>
                ) : videos.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Video size={28} />
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Library is empty</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Begin by uploading a video or importing a live stream URL.</p>
                    </div>
                  </div>
                ) : (
                  <div className="videos-grid">
                    {videos.map((video) => {
                      const isProcessing = video.status === 'PROCESSING' || video.status === 'QUEUED';
                      const thumbAsset = video.assets.find(a => a.assetType === 'THUMBNAIL');
                      
                      return (
                        <div key={video.id} className="video-card">
                          <div className="video-preview">
                            {thumbAsset ? (
                              <img src={thumbAsset.url} alt={video.title} />
                            ) : (
                              <div className="video-preview-fallback">
                                <Film size={32} style={{ opacity: 0.4 }} />
                                <span>{video.streamUrl ? 'Stream Link' : 'No Thumbnail'}</span>
                              </div>
                            )}
                            
                            {video.duration ? (
                              <span className="duration-badge">
                                {parseFloat(video.duration.toFixed(1))}s
                              </span>
                            ) : video.streamUrl ? (
                              <span className="duration-badge" style={{ color: 'var(--color-secondary)' }}>
                                Live Stream
                              </span>
                            ) : null}

                            <span className={`status-overlay ${video.status.toLowerCase()}`}>
                              <span className="status-indicator"></span>
                              {video.status}
                            </span>
                          </div>

                          <div className="video-card-body">
                            <div className="video-card-title" title={video.title}>
                              {video.title}
                            </div>

                            <div className="video-card-meta">
                              <span>{video.size ? formatBytes(video.size) : 'Stream Source'}</span>
                              <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                            </div>

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
                                Ready to transcode.
                              </div>
                            )}

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
          </>
        )}

        {/* Webcam recording tab */}
        {activeTab === 'webcam' && (
          <div className="webcam-tab-container panel">
            <div className="webcam-booth">
              
              {/* Webcam Live Viewport / Preview */}
              <div>
                <div className="webcam-viewport-wrapper">
                  {recordingPreviewUrl ? (
                    <video 
                      src={recordingPreviewUrl} 
                      controls 
                      className="webcam-video" 
                    />
                  ) : cameraStream ? (
                    <video 
                      ref={webcamVideoRef} 
                      autoPlay 
                      muted 
                      playsInline 
                      className="webcam-video" 
                    />
                  ) : (
                    <div className="webcam-placeholder">
                      <div className="webcam-placeholder-icon">
                        <Video size={36} />
                      </div>
                      <h3>Live Feed Offline</h3>
                      <p>Enable the camera stream using the controls panel to get started.</p>
                    </div>
                  )}

                  {/* Indicators overlay */}
                  {isRecording && (
                    <>
                      <div className="webcam-overlay">
                        <span className="rec-dot active"></span>
                        <span>REC</span>
                      </div>
                      <div className="webcam-timer">
                        {formatTimer(recordingSeconds)}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Controls panel */}
              <div className="webcam-controls-panel">
                <h3 className="panel-title" style={{ borderLeftColor: 'var(--color-danger)' }}>
                  Recording Studio Control
                </h3>

                {/* Device selection dropdowns (only shown when camera isn't actively recording) */}
                {!isRecording && !recordingPreviewUrl && (
                  <div className="devices-deck">
                    <div className="device-select-wrapper">
                      <label>Video Input Source</label>
                      <select 
                        className="select-input"
                        value={selectedVideoDevice}
                        onChange={(e) => setSelectedVideoDevice(e.target.value)}
                      >
                        {devices.video.length === 0 ? (
                          <option value="">No Camera Found</option>
                        ) : (
                          devices.video.map(dev => (
                            <option key={dev.deviceId} value={dev.deviceId}>{dev.label || `Camera ${dev.deviceId.slice(0, 5)}`}</option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="device-select-wrapper">
                      <label>Microphone Source</label>
                      <select 
                        className="select-input"
                        value={selectedAudioDevice}
                        onChange={(e) => setSelectedAudioDevice(e.target.value)}
                      >
                        {devices.audio.length === 0 ? (
                          <option value="">No Microphone Found</option>
                        ) : (
                          devices.audio.map(dev => (
                            <option key={dev.deviceId} value={dev.deviceId}>{dev.label || `Mic ${dev.deviceId.slice(0, 5)}`}</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="webcam-btn-deck">
                  {!cameraStream && !recordingPreviewUrl && (
                    <button 
                      className="btn-webcam-action start-stream"
                      onClick={startCameraFeed}
                    >
                      <Video size={18} />
                      <span>Start Camera Feed</span>
                    </button>
                  )}

                  {cameraStream && !isRecording && !recordingPreviewUrl && (
                    <>
                      <button 
                        className="btn-webcam-action record-trigger"
                        onClick={handleStartRecording}
                      >
                        <Play size={18} />
                        <span>Start Recording</span>
                      </button>
                      
                      <button 
                        className="btn-webcam-action stop-stream"
                        onClick={stopCameraFeed}
                      >
                        <span>Disable Camera</span>
                      </button>
                    </>
                  )}

                  {isRecording && (
                    <button 
                      className="btn-webcam-action record-trigger recording"
                      onClick={handleStopRecording}
                    >
                      <Clock size={18} className="animate-spin" />
                      <span>Stop Recording ({formatTimer(recordingSeconds)})</span>
                    </button>
                  )}
                </div>

                {/* Upload Form details when preview is ready */}
                {recordingPreviewUrl && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', animation: 'slideUp 0.3s ease-out' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#fff' }}>
                      Review & Upload recorded clip
                    </h4>
                    
                    <div className="form-group">
                      <label>Video Title</label>
                      <input 
                        type="text" 
                        className="text-input" 
                        value={webcamTitle} 
                        onChange={(e) => setWebcamTitle(e.target.value)}
                        placeholder="My Webcam Video"
                      />
                    </div>

                    <div className="form-group">
                      <label>Video Description</label>
                      <textarea 
                        className="textarea-input"
                        value={webcamDescription}
                        onChange={(e) => setWebcamDescription(e.target.value)}
                        placeholder="Recorded live from the webcam interface."
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button 
                        className="btn-primary"
                        onClick={handleUploadWebcam}
                      >
                        <Upload size={16} />
                        <span>Upload to Library</span>
                      </button>
                      <button 
                        className="btn-refresh" 
                        onClick={() => {
                          setRecordingPreviewUrl(null);
                          setRecordedBlob(null);
                          startCameraFeed();
                        }}
                      >
                        <span>Discard</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* Stream URL Import Tab */}
        {activeTab === 'import' && (
          <div className="import-stream-container panel">
            <h3 className="panel-title" style={{ borderLeftColor: 'var(--color-secondary)' }}>
              Import Live Stream URL
            </h3>
            
            <div className="stream-guide-card">
              <AlertCircle size={20} className="guide-icon" />
              <div className="guide-text">
                <h4>HLS & HTTP Video streams Supported</h4>
                <p>
                  Paste public Apple HTTP Live Streaming (HLS) playlists (.m3u8) or static HTTP mp4/webm stream files. 
                  AetherFlow's queue workers will transcode and compile them into static download outputs directly to AWS S3.
                </p>
                <span 
                  className="guide-sample-badge"
                  onClick={() => {
                    setStreamUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
                    setStreamTitle('Bigger Blazes Sample HTTP stream');
                    setStreamDescription('Sample network stream file for cloud transcode testing.');
                  }}
                  title="Click to copy sample link"
                >
                  Use sample mp4 stream link
                </span>
              </div>
            </div>

            <form onSubmit={handleImportStreamSubmit}>
              <div className="form-group">
                <label>Stream URL (m3u8, mp4, etc.)</label>
                <input 
                  type="url" 
                  required
                  className="text-input" 
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="https://example.com/live/playlist.m3u8"
                />
              </div>

              <div className="form-group">
                <label>Video Title</label>
                <input 
                  type="text" 
                  className="text-input" 
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="My Imported Stream"
                />
              </div>

              <div className="form-group">
                <label>Video Description</label>
                <textarea 
                  className="textarea-input"
                  value={streamDescription}
                  onChange={(e) => setStreamDescription(e.target.value)}
                  placeholder="Imported remote network feed."
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ background: 'linear-gradient(135deg, var(--color-secondary), #0891b2)' }}
                disabled={isImportingStream}
              >
                {isImportingStream ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Importing URL...</span>
                  </>
                ) : (
                  <>
                    <Layers size={16} />
                    <span>Import Stream & Configure</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

      </main>

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
