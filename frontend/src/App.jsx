import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Film, Loader2, Play, Trash2, Settings, 
  RefreshCw, CheckCircle, AlertCircle, Clock, Database, 
  BarChart, Sparkles, Video, Volume2, Image, Layers, ArrowRight,
  HelpCircle, Activity, DollarSign, Terminal, Plus, ShieldCheck, Search, SlidersHorizontal, Eye, Lock, Mail, UserPlus, LogIn, LogOut
} from 'lucide-react';
import VideoPlayerModal from './components/VideoPlayerModal';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  // Authentication & Navigation Root States
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('aether_session') ? 'console' : 'landing';
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [userSession, setUserSession] = useState(() => {
    const email = localStorage.getItem('aether_email');
    return email ? { email } : null;
  });

  // Auth form states
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Main Dashboard active tab
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Videos Library database states
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state for Library
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCodec, setFilterCodec] = useState('all');
  const [filterFormat, setFilterFormat] = useState('all');

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
    thumbnailsCount: 3,
    internalTitle: '',
    descriptionNotes: '',
    autoColorGrading: false,
    frameInterpolation: true
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

  // Live FFMPEG Logs Console States (Ops page)
  const [consoleLogs, setConsoleLogs] = useState([
    "[2026-06-03 14:01:14] INFO: FFmpeg v7.0.1 engine initialization success on node-fargate-018.",
    "[2026-06-03 14:01:15] frame=  240 fps= 48 q=28.0 size=  1024kB time=00:00:10.00 bitrate= 838.8kbits/s speed=  2x"
  ]);

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
    if (currentView === 'console') {
      fetchVideos();
    }
  }, [currentView]);

  // Live SSE connection for progress updates
  useEffect(() => {
    if (currentView !== 'console') return;
    
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
  }, [videos, currentView]);

  // Clean camera feed on leaving webcam view
  useEffect(() => {
    if (currentView === 'console' && activeTab === 'webcam') {
      initWebcamTab();
    } else {
      stopCameraFeed();
    }
  }, [activeTab, currentView]);

  // Auto restart camera feed when devices choice changes
  useEffect(() => {
    if (cameraStream && activeTab === 'webcam' && currentView === 'console') {
      startCameraFeed();
    }
  }, [selectedVideoDevice, selectedAudioDevice]);

  // Record timer increment
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

  // Generate simulated FFmpeg logs periodically in Ops Tab
  useEffect(() => {
    let timer = null;
    if (activeTab === 'ops' && currentView === 'console') {
      timer = setInterval(() => {
        const timestamp = new Date().toLocaleTimeString();
        const randFrame = Math.floor(Math.random() * 1000) + 120;
        const randFps = Math.floor(Math.random() * 15) + 38;
        const randSize = Math.floor(Math.random() * 4000) + 500;
        const randSpeed = (Math.random() * 1.5 + 1.2).toFixed(1);
        const timestampMarker = `[${new Date().toISOString().split('T')[0]} ${timestamp}]`;
        
        let newLog = `${timestampMarker} frame= ${randFrame} fps= ${randFps} q=28.0 size= ${randSize}kB time=00:00:30.00 bitrate= 838.8kbits/s speed= ${randSpeed}x`;
        if (Math.random() > 0.85) {
          newLog = `${timestampMarker} [WARNING] non-monotonous DTS in output stream 0:1; previous: 1420, current: 1420; changing to 1421.`;
        }
        
        setConsoleLogs(prev => [...prev.slice(-18), newLog]);
      }, 2500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeTab, currentView]);

  // Authenticate submit handler
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthError('');

    if (!authEmail || !authPassword) {
      setAuthError('All credentials are required.');
      return;
    }

    if (authEmail.length < 5 || !authEmail.includes('@')) {
      setAuthError('Please enter a valid enterprise operator email.');
      return;
    }

    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    if (authMode === 'signup' && authPassword !== authConfirmPassword) {
      setAuthError('Confirm password does not match.');
      return;
    }

    setAuthLoading(true);

    // Simulate database lookup / generation delay
    setTimeout(() => {
      localStorage.setItem('aether_session', 'active');
      localStorage.setItem('aether_email', authEmail);
      setUserSession({ email: authEmail });
      
      setAuthLoading(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setCurrentView('console');
      setActiveTab('dashboard');
    }, 1200);
  };

  const handleLogout = () => {
    stopCameraFeed();
    localStorage.removeItem('aether_session');
    localStorage.removeItem('aether_email');
    setUserSession(null);
    setCurrentView('landing');
  };

  // Initialize webcam devices selection
  const initWebcamTab = async () => {
    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      permissionStream.getTracks().forEach(t => t.stop());
      
      const devicesList = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devicesList.filter(d => d.kind === 'videoinput');
      const audioDevs = devicesList.filter(d => d.kind === 'audioinput');
      setDevices({ video: videoDevs, audio: audioDevs });
      
      if (videoDevs.length > 0) setSelectedVideoDevice(videoDevs[0].deviceId);
      if (audioDevs.length > 0) setSelectedAudioDevice(audioDevs[0].deviceId);
    } catch (err) {
      console.warn('Media devices enumeration blocked:', err);
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
        setJobSettings(prev => ({
          ...prev,
          internalTitle: newVideo.title,
          descriptionNotes: newVideo.description || ''
        }));
        setStreamUrl('');
        setStreamTitle('');
        setStreamDescription('');
        setActiveTab('studios'); // Switch to Studios for transcode
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
        
        setJobSettings(prev => ({
          ...prev,
          internalTitle: newVideo.title,
          descriptionNotes: newVideo.description || ''
        }));
        setActiveTab('studios');
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
        body: JSON.stringify({
          resolutions: jobSettings.resolutions,
          formats: jobSettings.formats,
          watermarkText: jobSettings.watermarkText,
          extractAudio: jobSettings.extractAudio,
          thumbnailsCount: jobSettings.thumbnailsCount
        })
      });

      if (res.ok) {
        setVideos(prev => prev.map(v => {
          if (v.id === selectedVideoForConfig.id) {
            return { ...v, status: 'QUEUED', progress: 0, title: jobSettings.internalTitle || v.title };
          }
          return v;
        }));
        setSelectedVideoForConfig(null);
        setActiveTab('dashboard'); // Redirect to live Active Jobs list
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to dispatch job');
      }
    } catch (err) {
      console.error('Process error:', err);
    }
  };

  // Toggle options checkboxes
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

  // Size calculations helper
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === undefined || bytes === null || bytes === 0) return 'Stream Source';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Compute active db details
  const totalVideos = videos.length;
  const processingCount = videos.filter(v => v.status === 'PROCESSING' || v.status === 'QUEUED').length;
  const completedCount = videos.filter(v => v.status === 'COMPLETED').length;

  const totalOriginalSize = videos.reduce((sum, v) => sum + (v.size || 0), 0);
  const activeJobsList = videos.filter(v => v.status === 'QUEUED' || v.status === 'PROCESSING');
  
  // Library filters
  const filteredVideos = videos.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesCodec = true;
    if (filterCodec !== 'all') {
      if (filterCodec === 'h264' && !video.mimeType.includes('mp4')) matchesCodec = false;
      if (filterCodec === 'vp9' && !video.mimeType.includes('webm')) matchesCodec = false;
    }

    let matchesFormat = true;
    if (filterFormat !== 'all') {
      if (filterFormat === 'mp4' && !video.mimeType.includes('mp4')) matchesFormat = false;
      if (filterFormat === 'webm' && !video.mimeType.includes('webm')) matchesFormat = false;
      if (filterFormat === 'stream' && !video.streamUrl) matchesFormat = false;
    }

    return matchesSearch && matchesCodec && matchesFormat;
  });

  return (
    <>
      {/* VIEW 1: LANDING PAGE (Home) */}
      {currentView === 'landing' && (
        <div className="landing-wrapper">
          <header className="landing-header">
            <div className="sidebar-brand" style={{ margin: 0, padding: 0 }}>
              <div className="brand-logo">
                <Sparkles size={20} />
              </div>
              <div className="brand-text">
                <h2>AetherFlow</h2>
                <span>Transcode Matrix</span>
              </div>
            </div>

            <nav className="landing-nav-links">
              <span className="landing-nav-link" onClick={() => alert('Scale video transcoding parallel clusters on demand.')}>Core Engine</span>
              <span className="landing-nav-link" onClick={() => alert('Ingest, transcode, isolate audio tracks and burn-in overlays.')}>Features</span>
              <span className="landing-nav-link" onClick={() => alert('Connect via AWS Fargate ECS containers.')}>Infrastructure</span>
              <button 
                className="btn-action-primary" 
                style={{ fontSize: '0.8rem', padding: '0.45rem 1.1rem' }}
                onClick={() => { setAuthMode('login'); setCurrentView('auth'); }}
              >
                Launch Console
              </button>
            </nav>
          </header>

          <main className="landing-hero-section">
            <span className="landing-hero-badge">Enterprise Video Transcoding</span>
            <h1 className="landing-hero-title">The Enterprise Cloud Transcode Matrix</h1>
            <p className="landing-hero-sub">
              Pipelined on AWS ECS Fargate, stored in highly secured S3 buckets, and indexed via MongoDB. Ingest remote HLS feeds, record browser webcam clips, isolate MP3 audio layers, and automate watermarking with active telemetry dashboard controls.
            </p>
            <div className="landing-cta-deck">
              <button 
                className="btn-landing-cta-primary"
                onClick={() => { setAuthMode('signup'); setCurrentView('auth'); }}
              >
                Get Started Free
              </button>
              <button 
                className="btn-landing-cta-secondary"
                onClick={() => { setAuthMode('login'); setCurrentView('auth'); }}
              >
                Sign In to Console
              </button>
            </div>
          </main>

          <section className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon-box">
                <Activity size={18} />
              </div>
              <h3>Active Queue Telemetry</h3>
              <p>Monitor your parallel BullMQ processes on a high-tech dashboard. SSE data streams progress live.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box">
                <Video size={18} />
              </div>
              <h3>Live Webcam Recording</h3>
              <p>Record camera feeds straight from the browser client, review the footage locally, and upload instantly.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box">
                <Layers size={18} />
              </div>
              <h3>Ingest Network Feeds</h3>
              <p>Inject public stream links, direct files, or HLS .m3u8 playlists. Decoded straight from the packet network.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon-box">
                <Terminal size={18} />
              </div>
              <h3>FFmpeg Logging Console</h3>
              <p>Review real-time shell logs from transcoding worker engines in Fargate. Instantly troubleshoot corrupted files.</p>
            </div>
          </section>

          <footer className="landing-footer">
            <span>AetherFlow System Overhaul Inc. © 2026. All rights reserved. Designed with Obsidian Glassmorphism.</span>
          </footer>
        </div>
      )}

      {/* VIEW 2: AUTH PAGE (Login & Signup) */}
      {currentView === 'auth' && (
        <div className="auth-page-wrapper">
          <div className="auth-glass-card">
            <div className="auth-header-area">
              <div className="auth-header-logo">
                <Sparkles size={22} />
              </div>
              <h2>AetherFlow Matrix</h2>
              <p>{authMode === 'login' ? 'Authenticate credentials to connect to console' : 'Deploy new operator credentials'}</p>
            </div>

            <div className="auth-tab-row">
              <button 
                className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
              >
                Sign In
              </button>
              <button 
                className={`auth-tab-btn ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => { setAuthMode('signup'); setAuthError(''); }}
              >
                Register
              </button>
            </div>

            {authError && (
              <div className="video-error-text" style={{ margin: 0, padding: '0.6rem' }}>
                <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input 
                    type="email" 
                    required 
                    className="text-input" 
                    style={{ paddingLeft: '2.25rem' }}
                    placeholder="operator@aetherflow.io"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input 
                    type="password" 
                    required 
                    className="text-input" 
                    style={{ paddingLeft: '2.25rem' }}
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                </div>
              </div>

              {authMode === 'signup' && (
                <div className="form-group" style={{ animation: 'slideUp 0.2s ease-out' }}>
                  <label>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                    <input 
                      type="password" 
                      required 
                      className="text-input" 
                      style={{ paddingLeft: '2.25rem' }}
                      placeholder="Confirm your password"
                      value={authConfirmPassword}
                      onChange={(e) => setAuthConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="btn-auth-submit" disabled={authLoading}>
                {authLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : authMode === 'login' ? (
                  <>
                    <LogIn size={16} />
                    <span>Enter AetherFlow Console</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Deploy Operator Account</span>
                  </>
                )}
              </button>
            </form>

            <button 
              className="btn-action-secondary" 
              style={{ padding: '0.5rem', width: '100%', fontSize: '0.8rem' }}
              onClick={() => { setCurrentView('landing'); setAuthError(''); }}
            >
              Back to Homepage
            </button>
          </div>
        </div>
      )}

      {/* VIEW 3: FULL ENTERPRISE CONSOLE VIEW */}
      {currentView === 'console' && (
        <div className="dashboard-wrapper">
          
          {/* Left Sidebar Layout */}
          <aside className="app-sidebar">
            <div>
              <div className="sidebar-brand">
                <div className="brand-logo">
                  <Sparkles size={20} />
                </div>
                <div className="brand-text">
                  <h2>AetherFlow</h2>
                  <span>Enterprise Video</span>
                </div>
              </div>

              <nav className="sidebar-menu">
                <button 
                  className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('dashboard')}
                >
                  <Activity size={16} />
                  <span>Dashboard</span>
                  {processingCount > 0 && <span className="badge-pulse">{processingCount}</span>}
                </button>

                <button 
                  className={`menu-item ${activeTab === 'library' ? 'active' : ''}`}
                  onClick={() => setActiveTab('library')}
                >
                  <Film size={16} />
                  <span>Library</span>
                </button>

                <button 
                  className={`menu-item ${activeTab === 'studios' ? 'active' : ''}`}
                  onClick={() => setActiveTab('studios')}
                >
                  <Settings size={16} />
                  <span>Studios</span>
                </button>

                <button 
                  className={`menu-item ${activeTab === 'webcam' ? 'active' : ''}`}
                  onClick={() => setActiveTab('webcam')}
                >
                  <Video size={16} />
                  <span>Webcam Studio</span>
                </button>

                <button 
                  className={`menu-item ${activeTab === 'import' ? 'active' : ''}`}
                  onClick={() => setActiveTab('import')}
                >
                  <Layers size={16} />
                  <span>Import Stream</span>
                </button>

                <button 
                  className={`menu-item ${activeTab === 'ops' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ops')}
                >
                  <Terminal size={16} />
                  <span>Ops</span>
                </button>
                
                <button className="menu-item" onClick={() => setActiveTab('jobs')}>
                  <Clock size={16} />
                  <span>Jobs</span>
                </button>
                
                <button className="menu-item" onClick={() => setActiveTab('analytics')}>
                  <BarChart size={16} />
                  <span>Analytics</span>
                </button>
                
                <button className="menu-item" onClick={() => setActiveTab('billing')}>
                  <DollarSign size={16} />
                  <span>Billing</span>
                </button>
              </nav>
            </div>

            <div className="sidebar-footer-deck">
              <button className="upgrade-storage-btn" onClick={() => alert('Autoscaling nodes are configured directly in the Ops panel!')}>
                Upgrade Storage
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', padding: '0 0.5rem', color: 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  <HelpCircle size={14} style={{ color: 'var(--color-success)' }} />
                  <span title={userSession?.email}>{userSession?.email || 'operator@aetherflow.io'}</span>
                </div>
                <div className="footer-links-row" style={{ marginTop: '0.25rem' }}>
                  <span className="footer-link" onClick={handleLogout} style={{ color: 'var(--color-danger)' }}>
                    <LogOut size={13} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} /> Sign Out
                  </span>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Content Panel */}
          <main className="main-content">
            
            {/* Top Header Indicators bar */}
            <header className="content-header">
              <div className="topbar-indicators">
                <span className="indicator-item">
                  Transcoder: <span className="status-dot active"></span> <strong style={{ color: '#fff' }}>Active</strong>
                </span>
                <span className="indicator-item" style={{ color: 'var(--color-text-muted)' }}>
                  Nodes: <strong style={{ color: '#fff' }}>42/48</strong>
                </span>
              </div>

              <div className="topbar-actions-deck">
                <button className="btn-action-primary" onClick={() => setActiveTab('studios')}>
                  <Plus size={14} style={{ marginRight: '0.25rem', verticalAlign: 'text-bottom' }} /> New Project
                </button>
              </div>
            </header>

            {/* 1. Dashboard Tab Overview (Screenshot 1 Layout) */}
            {activeTab === 'dashboard' && (
              <>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.75px' }}>Cloud Video Processing</h1>
                  <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    Real-time telemetry and control for high-volume video transcoding pipelines.
                  </p>
                </div>

                {/* Enterprise metrics row */}
                <div className="metrics-row">
                  <div className="metric-card">
                    <div className="metric-card-header">
                      <span>Total Videos</span>
                      <Film size={14} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div className="metric-card-value">{totalVideos > 0 ? `${totalVideos} assets` : '1.42M'}</div>
                    <div className="metric-card-sub positive">↑ +12% 24h</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-header">
                      <span>Processing Jobs</span>
                      <Loader2 size={14} className={processingCount > 0 ? 'animate-spin' : ''} style={{ color: 'var(--color-secondary)' }} />
                    </div>
                    <div className="metric-card-value">{processingCount > 0 ? `${processingCount} active` : '4,892'}</div>
                    <div className="mini-progress-track">
                      <div className="mini-progress-fill" style={{ width: processingCount > 0 ? '75%' : '45%' }}></div>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-header">
                      <span>S3 Consumption</span>
                      <Database size={14} style={{ color: 'var(--color-warning)' }} />
                    </div>
                    <div className="metric-card-value">{totalOriginalSize > 0 ? formatBytes(totalOriginalSize) : '84.2 TB'}</div>
                    <div className="metric-card-sub" style={{ color: 'var(--color-text-muted)' }}>$1,240 est. / mo</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-header">
                      <span>Queue Status</span>
                      <Clock size={14} style={{ color: 'var(--color-danger)' }} />
                    </div>
                    <div className="metric-card-value">{processingCount > 0 ? 'ENGAGED' : '12.4k'}</div>
                    <div className="metric-card-sub negative">{processingCount > 0 ? 'Active threads running' : 'Elevated load'}</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-header">
                      <span>Success Rate</span>
                      <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
                    </div>
                    <div className="metric-card-value">
                      {totalVideos > 0 ? `${((completedCount / totalVideos) * 100).toFixed(1)}%` : '99.98%'}
                    </div>
                    <div className="metric-card-sub" style={{ color: 'var(--color-text-muted)' }}>Last 7 days</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-card-header">
                      <span>Active Workers</span>
                      <Activity size={14} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div className="metric-card-value">842</div>
                    <div className="metric-card-sub positive">Autoscaling active</div>
                  </div>
                </div>

                {/* Real-time Throughput Chart widget */}
                <div className="chart-card">
                  <div className="chart-header">
                    <span className="chart-title">Real-Time Throughput</span>
                    <div className="chart-filters">
                      <button className="chart-filter-btn active">1H</button>
                      <button className="chart-filter-btn">24H</button>
                      <button className="chart-filter-btn">7D</button>
                    </div>
                  </div>

                  <div className="bar-chart-container">
                    <div className="bar-item-wrapper"><div className="bar-pillar" style={{ height: '35%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar" style={{ height: '55%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar" style={{ height: '42%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar accent" style={{ height: '80%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar accent" style={{ height: '90%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar secondary" style={{ height: '85%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar" style={{ height: '50%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar" style={{ height: '38%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar" style={{ height: '60%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar" style={{ height: '25%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar accent" style={{ height: '70%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar secondary" style={{ height: '78%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar" style={{ height: '52%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar" style={{ height: '46%' }}></div></div>
                    <div className="bar-item-wrapper"><div className="bar-pillar" style={{ height: '30%' }}></div></div>
                  </div>

                  <div className="chart-timeline-labels">
                    <span>10:00 AM</span>
                    <span>10:30 AM</span>
                    <span>11:00 AM</span>
                  </div>
                </div>

                {/* Active jobs table */}
                <div className="section-card">
                  <div className="section-card-header">
                    <span className="section-card-title">
                      <Loader2 size={16} className={processingCount > 0 ? 'animate-spin' : ''} />
                      Active Ingestion & Transcoding Jobs
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-secondary)' }}>● Live Updates</span>
                  </div>

                  <div className="enterprise-table-wrapper">
                    <table className="enterprise-table">
                      <thead>
                        <tr>
                          <th>Job ID</th>
                          <th>Source File</th>
                          <th>Profile</th>
                          <th>Progress</th>
                          <th>Status</th>
                          <th>Time Elapsed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeJobsList.map((job) => (
                          <tr key={job.id}>
                            <td className="job-id-cell">#JOB-{job.id.slice(-5).toUpperCase()}</td>
                            <td style={{ fontWeight: 600 }}>{job.title}</td>
                            <td>HLS Adaptive Multi-Format</td>
                            <td>
                              <div className="progress-cell-wrapper">
                                <div className="progress-bar-bg" style={{ width: '80px', height: '4px' }}>
                                  <div className="progress-bar-fill" style={{ width: `${job.progress}%` }}></div>
                                </div>
                                <span className="progress-pct-value">{job.progress}%</span>
                              </div>
                            </td>
                            <td>
                              <span className={`status-badge ${job.status === 'PROCESSING' ? 'processing' : 'queued'}`}>
                                <span className="status-badge-dot"></span>
                                {job.status}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'monospace' }}>01:12</td>
                          </tr>
                        ))}

                        {/* Fallback mocks if queue is empty */}
                        {activeJobsList.length === 0 && (
                          <>
                            <tr>
                              <td className="job-id-cell">#JOB-8921a</td>
                              <td style={{ fontWeight: 600 }}>raw_footage_cam1_1080p.mxf</td>
                              <td>HLS-Adaptive-4K</td>
                              <td>
                                <div className="progress-cell-wrapper">
                                  <div className="progress-bar-bg" style={{ width: '80px', height: '4px' }}>
                                    <div className="progress-bar-fill" style={{ width: '45%' }}></div>
                                  </div>
                                  <span className="progress-pct-value">45%</span>
                                </div>
                              </td>
                              <td>
                                <span className="status-badge processing">
                                  <span className="status-badge-dot"></span>
                                  Processing
                                </span>
                              </td>
                              <td style={{ fontFamily: 'monospace' }}>02:14</td>
                            </tr>

                            <tr>
                              <td className="job-id-cell">#JOB-8920b</td>
                              <td style={{ fontWeight: 600 }}>interview_audio_sync_v2.mov</td>
                              <td>MP4-WebM-1080p</td>
                              <td>
                                <div className="progress-cell-wrapper">
                                  <div className="progress-bar-bg" style={{ width: '80px', height: '4px' }}>
                                    <div className="progress-bar-fill" style={{ width: '100%', background: 'var(--color-success)' }}></div>
                                  </div>
                                  <span className="progress-pct-value">100%</span>
                                </div>
                              </td>
                              <td>
                                <span className="status-badge success">
                                  <span className="status-badge-dot"></span>
                                  Success
                                </span>
                              </td>
                              <td style={{ fontFamily: 'monospace' }}>04:32</td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 2. Library Tab (Screenshot 4 Layout) */}
            {activeTab === 'library' && (
              <>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Master Assets Library</h1>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Manage, distribute, and download your cloud-processed master video outputs.
                  </p>
                </div>

                {/* Filter Deck */}
                <div className="section-card">
                  <div className="library-filter-deck">
                    <div className="search-input-wrapper">
                      <Search size={16} className="search-icon-pos" />
                      <input 
                        type="text" 
                        className="library-search-field"
                        placeholder="Filter by Video Title..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <select 
                      className="filter-dropdown-select"
                      value={filterCodec}
                      onChange={(e) => setFilterCodec(e.target.value)}
                    >
                      <option value="all">Codec: All</option>
                      <option value="h264">H.264 (MP4)</option>
                      <option value="vp9">VP9 (WebM)</option>
                    </select>

                    <select 
                      className="filter-dropdown-select"
                      value={filterFormat}
                      onChange={(e) => setFilterFormat(e.target.value)}
                    >
                      <option value="all">Format: All</option>
                      <option value="mp4">Static MP4</option>
                      <option value="webm">WebM Web Container</option>
                      <option value="stream">Ingested Streams</option>
                    </select>

                    <button className="layout-toggle-btn" onClick={fetchVideos} title="Sync Library with Server">
                      <RefreshCw size={16} />
                    </button>
                  </div>

                  {/* Data Table */}
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary)' }} />
                      <p style={{ marginTop: '0.5rem' }}>Synchronizing assets with MongoDB Atlas...</p>
                    </div>
                  ) : filteredVideos.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                      <Eye size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                      <p>No master assets matching current query filters found.</p>
                    </div>
                  ) : (
                    <div className="enterprise-table-wrapper">
                      <table className="enterprise-table">
                        <thead>
                          <tr>
                            <th style={{ width: '30px' }}><input type="checkbox" onChange={() => {}} /></th>
                            <th>Thumbnail</th>
                            <th>Video Title</th>
                            <th>Duration</th>
                            <th>Resolution</th>
                            <th>Status</th>
                            <th>Created Date</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredVideos.map((video) => {
                            const isProcessing = video.status === 'PROCESSING' || video.status === 'QUEUED';
                            const thumbAsset = video.assets.find(a => a.assetType === 'THUMBNAIL');
                            
                            return (
                              <tr key={video.id}>
                                <td><input type="checkbox" onChange={() => {}} /></td>
                                <td>
                                  <div style={{ width: '60px', aspectRatio: '16/9', background: '#000', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
                                    {thumbAsset ? (
                                      <img src={thumbAsset.url} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <Film size={16} style={{ opacity: 0.3, margin: '0 auto' }} />
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: '#fff' }}>{video.title}</div>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>ID: vid_{video.id.slice(-6)}</span>
                                </td>
                                <td>
                                  {video.duration ? `${parseFloat(video.duration.toFixed(1))}s` : video.streamUrl ? 'Live Stream' : '--'}
                                </td>
                                <td>
                                  {video.status === 'COMPLETED' ? (
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                      {video.assets.filter(a => a.assetType === 'VIDEO').map(a => (
                                        <span key={a.id} className="format-chip-item" style={{ fontSize: '0.65rem', padding: '1px 4px' }}>{a.resolution}</span>
                                      ))}
                                    </div>
                                  ) : '--'}
                                </td>
                                <td>
                                  <span className={`status-badge ${video.status === 'COMPLETED' ? 'success' : isProcessing ? 'processing' : video.status === 'FAILED' ? 'error' : 'queued'}`}>
                                    <span className="status-badge-dot"></span>
                                    {video.status}
                                  </span>
                                </td>
                                <td>{new Date(video.createdAt).toLocaleDateString()}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    {video.status === 'UPLOADED' && (
                                      <button 
                                        className="btn-card-action play"
                                        onClick={() => {
                                          setSelectedVideoForConfig(video);
                                          setJobSettings(prev => ({
                                            ...prev,
                                            internalTitle: video.title,
                                            descriptionNotes: video.description || ''
                                          }));
                                          setActiveTab('studios');
                                        }}
                                      >
                                        Configure
                                      </button>
                                    )}
                                    {video.status === 'COMPLETED' && (
                                      <button 
                                        className="btn-card-action play"
                                        onClick={() => setPlayingVideo(video)}
                                      >
                                        <Play size={12} /> Play
                                      </button>
                                    )}
                                    <button 
                                      className="btn-card-action delete"
                                      onClick={(e) => handleDeleteVideo(video.id, e)}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 3. Studios Ingestion & Transcoding Configurations (Screenshot 3 Layout) */}
            {activeTab === 'studios' && (
              <>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Upload & Transcode Studio</h1>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Configure ingestion parameters and initialize transcoder workers for the AetherFlow cluster.
                  </p>
                </div>

                <div className="studio-split-layout">
                  <div 
                    className={`drag-drop-card-panel ${dragActive ? 'drag-active' : ''}`}
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
                    <div className="studio-upload-icon-box">
                      {uploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                    </div>
                    
                    {uploading ? (
                      <div style={{ textAlign: 'center', width: '100%' }}>
                        <h3 style={{ fontWeight: 600, color: '#fff' }}>Ingesting Media Asset...</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                          {uploadingFile?.name} ({formatBytes(uploadingFile?.size)})
                        </p>
                        <div className="upload-progress-container" style={{ width: '80%', margin: '1rem auto 0' }}>
                          <div className="progress-bar-bg">
                            <div className="progress-bar-fill animated" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '0.5rem', display: 'block' }}>
                            {uploadProgress}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>Drag & Drop Media</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                          or <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>browse local files</span>
                        </p>
                        <div className="studio-format-chips-row">
                          <span className="format-chip-item">.MP4</span>
                          <span className="format-chip-item">.MOV</span>
                          <span className="format-chip-item">.RAW</span>
                          <span className="format-chip-item">MAX 500MB</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    <div className="section-card">
                      <span className="section-card-title">
                        <Film size={16} /> Asset Metadata
                      </span>
                      
                      <div className="form-group">
                        <label>Internal Title</label>
                        <input 
                          type="text" 
                          className="text-input" 
                          value={jobSettings.internalTitle} 
                          onChange={(e) => setJobSettings(prev => ({ ...prev, internalTitle: e.target.value }))}
                          placeholder="e.g. Q3 Marketing Campaign Hero"
                        />
                      </div>

                      <div className="form-group">
                        <label>Description / Notes</label>
                        <textarea 
                          className="textarea-input" 
                          value={jobSettings.descriptionNotes}
                          onChange={(e) => setJobSettings(prev => ({ ...prev, descriptionNotes: e.target.value }))}
                          placeholder="Optional context for operators..."
                        />
                      </div>
                    </div>

                    <div className="section-card">
                      <span className="section-card-title">
                        <Settings size={16} /> Processing Profile
                      </span>

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

                      <div className="form-group">
                        <label>Output Container</label>
                        <div className="checkbox-group">
                          {['mp4', 'webm'].map(fmt => (
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

                      <div className="form-group">
                        <label>Overlay Burn-in (Watermark)</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="text" 
                            className="text-input" 
                            value={jobSettings.watermarkText}
                            onChange={(e) => setJobSettings(prev => ({ ...prev, watermarkText: e.target.value }))}
                            placeholder="e.g. CONFIDENTIAL - INTERNAL USE ONLY"
                          />
                          <button className="btn-action-secondary" onClick={() => alert('Watermark is automatically aligned on top-left overlay.')}>Position</button>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>AI Enhancements</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div className={`ai-enhancement-card-wrapper ${jobSettings.autoColorGrading ? 'selected' : ''}`}>
                            <div className="ai-details-text">
                              <h4>Auto-Color Grading</h4>
                              <p>Neural matching to AetherFlow cinematic preset</p>
                            </div>
                            <label className="toggle-switch-wrapper">
                              <input 
                                type="checkbox" 
                                checked={jobSettings.autoColorGrading}
                                onChange={(e) => setJobSettings(prev => ({ ...prev, autoColorGrading: e.target.checked }))}
                              />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>

                          <div className={`ai-enhancement-card-wrapper ${jobSettings.frameInterpolation ? 'selected' : ''}`}>
                            <div className="ai-details-text">
                              <h4>Frame Interpolation</h4>
                              <p>Smooth video playback up to 60fps</p>
                            </div>
                            <label className="toggle-switch-wrapper">
                              <input 
                                type="checkbox" 
                                checked={jobSettings.frameInterpolation}
                                onChange={(e) => setJobSettings(prev => ({ ...prev, frameInterpolation: e.target.checked }))}
                              />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="studio-actions-footer">
                        <button className="btn-action-secondary" onClick={() => {
                          setSelectedVideoForConfig(null);
                          alert('Configurations saved as draft.');
                        }}>
                          Save as Draft
                        </button>
                        <button 
                          className="btn-action-primary"
                          onClick={handleStartProcessing}
                          disabled={!selectedVideoForConfig}
                        >
                          <Sparkles size={14} style={{ marginRight: '0.25rem', verticalAlign: 'text-bottom' }} /> Initialize Processing
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </>
            )}

            {/* 4. Live Webcam Recording Booth */}
            {activeTab === 'webcam' && (
              <div className="webcam-tab-container panel">
                <div className="webcam-booth">
                  <div>
                    <div className="webcam-viewport-wrapper">
                      {recordingPreviewUrl ? (
                        <video src={recordingPreviewUrl} controls className="webcam-video" />
                      ) : cameraStream ? (
                        <video ref={webcamVideoRef} autoPlay muted playsInline className="webcam-video" />
                      ) : (
                        <div className="webcam-placeholder">
                          <div className="webcam-placeholder-icon">
                            <Video size={36} />
                          </div>
                          <h3>Live Feed Offline</h3>
                          <p>Enable the camera stream using the controls panel to get started.</p>
                        </div>
                      )}

                      {isRecording && (
                        <>
                          <div className="webcam-overlay">
                            <span className="rec-dot active"></span>
                            <span>REC</span>
                          </div>
                          <div className="webcam-timer">{formatTimer(recordingSeconds)}</div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="webcam-controls-panel">
                    <h3 className="panel-title" style={{ borderLeftColor: 'var(--color-danger)' }}>
                      Recording Studio Control
                    </h3>

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

                    <div className="webcam-btn-deck">
                      {!cameraStream && !recordingPreviewUrl && (
                        <button className="btn-webcam-action start-stream" onClick={startCameraFeed}>
                          <Video size={18} />
                          <span>Start Camera Feed</span>
                        </button>
                      )}

                      {cameraStream && !isRecording && !recordingPreviewUrl && (
                        <>
                          <button className="btn-webcam-action record-trigger" onClick={handleStartRecording}>
                            <Play size={18} />
                            <span>Start Recording</span>
                          </button>
                          <button className="btn-webcam-action stop-stream" onClick={stopCameraFeed}>
                            <span>Disable Camera</span>
                          </button>
                        </>
                      )}

                      {isRecording && (
                        <button className="btn-webcam-action record-trigger recording" onClick={handleStopRecording}>
                          <Clock size={18} className="animate-spin" />
                          <span>Stop Recording ({formatTimer(recordingSeconds)})</span>
                        </button>
                      )}
                    </div>

                    {recordingPreviewUrl && (
                      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
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
                          />
                        </div>

                        <div className="form-group">
                          <label>Video Description</label>
                          <textarea 
                            className="textarea-input"
                            value={webcamDescription}
                            onChange={(e) => setWebcamDescription(e.target.value)}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button className="btn-primary" onClick={handleUploadWebcam}>
                            <Upload size={16} />
                            <span>Upload to Library</span>
                          </button>
                          <button className="btn-refresh" onClick={() => {
                            setRecordingPreviewUrl(null);
                            setRecordedBlob(null);
                            startCameraFeed();
                          }}>
                            <span>Discard</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 5. Stream URL Import Tab */}
            {activeTab === 'import' && (
              <div className="import-stream-container panel">
                <h3 className="panel-title" style={{ borderLeftColor: 'var(--color-secondary)' }}>
                  Import Live Stream URL
                </h3>
                
                <div className="stream-guide-card">
                  <AlertCircle size={20} className="guide-icon" />
                  <div className="guide-text">
                    <h4>HLS & HTTP Ingestion Supported</h4>
                    <p>
                      Input a Apple HTTP Live Streaming (HLS) playlist link (.m3u8) or standard HTTP stream mp4 url.
                      The transcoder worker pulls network packets directly from remote servers.
                    </p>
                    <span 
                      className="guide-sample-badge"
                      onClick={() => {
                        setStreamUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
                        setStreamTitle('Bigger Blazes Sample HTTP stream');
                        setStreamDescription('Sample network stream video link for transcoding test.');
                      }}
                    >
                      Use sample mp4 stream link
                    </span>
                  </div>
                </div>

                <form onSubmit={handleImportStreamSubmit}>
                  <div className="form-group">
                    <label>Stream URL</label>
                    <input 
                      type="url" 
                      required
                      className="text-input" 
                      value={streamUrl}
                      onChange={(e) => setStreamUrl(e.target.value)}
                      placeholder="https://example.com/playlist.m3u8"
                    />
                  </div>

                  <div className="form-group">
                    <label>Video Title</label>
                    <input 
                      type="text" 
                      className="text-input" 
                      value={streamTitle}
                      onChange={(e) => setStreamTitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Video Description</label>
                    <textarea 
                      className="textarea-input"
                      value={streamDescription}
                      onChange={(e) => setStreamDescription(e.target.value)}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ background: 'linear-gradient(135deg, var(--color-secondary), #0891b2)' }}
                    disabled={isImportingStream}
                  >
                    {isImportingStream ? 'Importing URL...' : 'Import Stream & Configure'}
                  </button>
                </form>
              </div>
            )}

            {/* 6. Operations Telemetry & Console Tab (Screenshot 2 Layout) */}
            {activeTab === 'ops' && (
              <>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Cloud Operations</h1>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Real-time infrastructure health and processing queues telemetry.
                  </p>
                </div>

                <div className="ops-grid-split">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="section-card">
                      <span className="section-card-title">
                        <Activity size={16} /> Cluster Load & Queue Status
                      </span>
                      
                      <div className="meter-row">
                        <div className="meter-labels">
                          <span>ECS CLUSTER LOAD</span>
                          <span style={{ color: 'var(--color-warning)' }}>Elevated (78.4%)</span>
                        </div>
                        <div className="meter-track-bg">
                          <div className="meter-fill-bar" style={{ width: '78.4%' }}></div>
                        </div>
                      </div>

                      <div className="meter-row">
                        <div className="meter-labels">
                          <span>Memory Utilization</span>
                          <span style={{ color: 'var(--color-secondary)' }}>62.1%</span>
                        </div>
                        <div className="meter-track-bg">
                          <div className="meter-fill-bar success" style={{ width: '62.1%' }}></div>
                        </div>
                      </div>
                    </div>

                    <div className="logs-console-window">
                      <div className="logs-console-header">
                        <span className="logs-console-title">FFMPEG WORKER LOGS (LIVE)</span>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button className="chart-filter-btn" style={{ fontSize: '0.65rem', padding: '2px 6px' }} onClick={() => setConsoleLogs([])}>CLEAR</button>
                          <button className="chart-filter-btn active" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>● TAIL</button>
                        </div>
                      </div>
                      <div className="logs-console-body">
                        {consoleLogs.map((log, index) => {
                          const isWarn = log.includes('[WARNING]');
                          return (
                            <div key={index} className={`console-log-line ${isWarn ? 'warn' : ''}`}>
                              {log}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="ops-sidebar-cards">
                    <div className="section-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="section-card-title"><Clock size={16} /> API Endpoints latency</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>All systems operational</span>
                      </div>
                      <div className="endpoint-latency-list">
                        <div className="endpoint-latency-item">
                          <span className="endpoint-url-name">/v1/upload</span>
                          <span className="latency-value-badge fast">45ms</span>
                        </div>
                        <div className="endpoint-latency-item">
                          <span className="endpoint-url-name">/v1/status</span>
                          <span className="latency-value-badge fast">32ms</span>
                        </div>
                        <div className="endpoint-latency-item">
                          <span className="endpoint-url-name">/v1/stream</span>
                          <span className="latency-value-badge slow">210ms</span>
                        </div>
                      </div>
                    </div>

                    <div className="section-card">
                      <span className="section-card-title"><Database size={16} /> S3 Regional Storage</span>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>US-EAST-1 (PRIMARY BUCKET)</span>
                        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginTop: '0.25rem' }}>42.8 PB</h2>
                        <div className="mini-progress-track" style={{ height: '6px', marginTop: '0.5rem' }}>
                          <div className="mini-progress-fill" style={{ width: '84%', background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))' }}></div>
                        </div>
                      </div>
                    </div>

                    <div className="section-card">
                      <span className="section-card-title"><Settings size={16} /> Scaling Controls</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700 }}>Auto-Scale Workers</h4>
                            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Target CPU utilization: 70%</p>
                          </div>
                          <label className="toggle-switch-wrapper">
                            <input type="checkbox" defaultChecked />
                            <span className="toggle-slider"></span>
                          </label>
                        </div>

                        <button className="btn-action-primary" style={{ width: '100%', padding: '0.65rem' }} onClick={() => alert('Fargate Node Provision request dispatched successfully.')}>
                          Provision Node Manually
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 7. Enterprise placeholders for settings, billing, jobs, analytics */}
            {['jobs', 'analytics', 'settings', 'billing'].includes(activeTab) && (
              <div className="panel" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
                <Activity size={48} style={{ margin: '0 auto 1.5rem', color: 'var(--color-primary)', opacity: 0.8 }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{activeTab.toUpperCase()} PANEL</h2>
                <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  Connected to AetherFlow Enterprise cloud cluster node: <strong style={{ color: '#fff' }}>node-fargate-018</strong>. Data updates automatically.
                </p>
              </div>
            )}

          </main>

          {/* Watch Resolution Switching Modal Overlay */}
          {playingVideo && (
            <VideoPlayerModal 
              video={playingVideo} 
              onClose={() => setPlayingVideo(null)} 
            />
          )}
        </div>
      )}
    </>
  );
}
