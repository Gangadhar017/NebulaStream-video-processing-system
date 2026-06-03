import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Film, Loader2, Play, Trash2, Settings, 
  RefreshCw, CheckCircle, AlertCircle, Clock, Database, 
  BarChart, Sparkles, Video, Volume2, Image, Layers, ArrowRight,
  HelpCircle, Activity, DollarSign, Terminal, Plus, ShieldCheck, Search, SlidersHorizontal, Eye, Lock, Mail, UserPlus, LogIn, LogOut, Pause, Camera, X
} from 'lucide-react';
import VideoPlayerModal from './components/VideoPlayerModal';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  // Authentication & Navigation Root States
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('nebulastream_session') ? 'console' : 'landing';
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [userSession, setUserSession] = useState(() => {
    const email = localStorage.getItem('nebulastream_email');
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
  
  // New Project Ingestion Modal State
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

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
    watermarkText: 'NEBULASTREAM',
    extractAudio: true,
    thumbnailsCount: 3,
    internalTitle: '',
    descriptionNotes: '',
    autoColorGrading: false,
    frameInterpolation: true
  });

  // Webcam & Teleprompter Studio States (Studios Tab)
  const [devices, setDevices] = useState({ video: [], audio: [] });
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  
  // Teleprompter specific options
  const [teleprompterScript, setTeleprompterScript] = useState(
    `Welcome to the NebulaStream Studio.\n\nThis professional teleprompter overlay helps you deliver your message with precision while maintaining eye contact with your audience. Adjust your script, speed, and font size in the sidebar settings.`
  );
  const [isTeleprompterPlaying, setIsTeleprompterPlaying] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(4.5);
  const [teleprompterFontSize, setTeleprompterFontSize] = useState(32);
  const [showScriptEditor, setShowScriptEditor] = useState(false);
  const [recordingQuality, setRecordingQuality] = useState('4k'); // '4k' | '1080p'
  const [autoUploadS3, setAutoUploadS3] = useState(true);
  const [webcamTitle, setWebcamTitle] = useState('Webcam Capture');
  const [webcamDescription, setWebcamDescription] = useState('Recorded live using the NebulaStream teleprompter booth.');

  // Audio level meter bars state
  const [audioBars, setAudioBars] = useState([4, 8, 12, 10, 6]);

  // Stream URL Import States
  const [streamUrl, setStreamUrl] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [isImportingStream, setIsImportingStream] = useState(false);

  // Overhauled Stream Ingestion States & Probing Simulator
  const [streamDiagnostics, setStreamDiagnostics] = useState({
    latency: 'Idle',
    codec: '---',
    resolution: '---',
    health: 'STANDBY',
    probing: false
  });

  const [importSettings, setImportSettings] = useState({
    resolutions: ['720p', '480p'],
    formats: ['mp4'],
    watermarkText: 'NEBULASTREAM',
    extractAudio: true,
    thumbnailsCount: 3,
    qualityProfile: '1080p', // '4k' | '1080p' | 'audio-only'
    autoColorGrading: false,
    frameInterpolation: true
  });

  const toggleImportResolution = (res) => {
    setImportSettings(prev => {
      const resolutions = prev.resolutions.includes(res)
        ? prev.resolutions.filter(r => r !== res)
        : [...prev.resolutions, res];
      return { ...prev, resolutions };
    });
  };

  const toggleImportFormat = (fmt) => {
    setImportSettings(prev => {
      const formats = prev.formats.includes(fmt)
        ? prev.formats.filter(f => f !== fmt)
        : [...prev.formats, fmt];
      return { ...prev, formats };
    });
  };

  const triggerStreamProbe = (url) => {
    if (!url) {
      setStreamDiagnostics({
        latency: 'Idle',
        codec: '---',
        resolution: '---',
        health: 'STANDBY',
        probing: false
      });
      return;
    }

    setStreamDiagnostics({
      latency: 'Probing...',
      codec: 'Probing...',
      resolution: 'Probing...',
      health: 'PROBING',
      probing: true
    });

    // Simulate probing network packets
    setTimeout(() => {
      let codec = 'H.264 / AAC (MP4)';
      let resolution = '1080p (Source)';
      let latency = Math.floor(Math.random() * 45) + 15 + 'ms';

      if (url.includes('.m3u8')) {
        codec = 'H.264 / AAC (HLS)';
        resolution = 'Adaptive (Source)';
      } else if (url.includes('.webm')) {
        codec = 'VP9 / Opus (WebM)';
        resolution = '1080p (Source)';
      } else if (url.includes('TearsOfSteel')) {
        resolution = '4K UHD (Source)';
      }

      setStreamDiagnostics({
        latency,
        codec,
        resolution,
        health: 'ONLINE',
        probing: false
      });
    }, 1200);
  };

  // Live FFMPEG Logs Console States (Ops page)
  const [consoleLogs, setConsoleLogs] = useState([
    "[2026-06-03 14:01:14] INFO: FFmpeg v7.0.1 engine initialization success on node-fargate-018.",
    "[2026-06-03 14:01:15] frame=  240 fps= 48 q=28.0 size=  1024kB time=00:00:10.00 bitrate= 838.8kbits/s speed=  2x"
  ]);

  const connectedIds = useRef(new Set());
  const fileInputRef = useRef(null);
  const modalFileInputRef = useRef(null);
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

  // Handle webcam tab init and cleanups
  useEffect(() => {
    if (currentView === 'console' && activeTab === 'studios') {
      initWebcamTab();
    } else {
      stopCameraFeed();
      setIsTeleprompterPlaying(false);
    }
  }, [activeTab, currentView]);

  // Auto restart camera feed when active devices change
  useEffect(() => {
    if (cameraStream && activeTab === 'studios' && currentView === 'console') {
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

  // Simulated Mic volume visualizer jump state
  useEffect(() => {
    let timer = null;
    if (cameraStream && activeTab === 'studios') {
      timer = setInterval(() => {
        setAudioBars(Array.from({ length: 5 }, () => Math.floor(Math.random() * 16) + 4));
      }, 150);
    } else {
      setAudioBars([4, 4, 4, 4, 4]);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cameraStream, activeTab]);

  // Teleprompter scrolling animator
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();
    
    const scrollLoop = (time) => {
      const scrollBox = document.getElementById('teleprompter-scroll-box');
      if (isTeleprompterPlaying && scrollBox) {
        const elapsed = time - lastTime;
        const speedValue = parseFloat(teleprompterSpeed) || 1;
        scrollBox.scrollTop += (speedValue * elapsed * 0.02);
        
        // Loop back to top if reached end of content
        if (scrollBox.scrollTop >= scrollBox.scrollHeight - scrollBox.clientHeight) {
          scrollBox.scrollTop = 0;
        }
      }
      lastTime = time;
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    if (isTeleprompterPlaying) {
      animationFrameId = requestAnimationFrame(scrollLoop);
    }
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isTeleprompterPlaying, teleprompterSpeed]);

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

    setTimeout(() => {
      localStorage.setItem('nebulastream_session', 'active');
      localStorage.setItem('nebulastream_email', authEmail);
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
    localStorage.removeItem('nebulastream_session');
    localStorage.removeItem('nebulastream_email');
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

      // Trigger automatic upload if checked in settings
      if (autoUploadS3) {
        const file = new File(
          [blob], 
          `teleprompter-clip-${Date.now()}.webm`, 
          { type: 'video/webm' }
        );
        handleFileUpload(file, webcamTitle, webcamDescription);
      }
    };

    recorder.start(1000);
    setMediaRecorder(recorder);
    setIsRecording(true);
    setIsTeleprompterPlaying(true); // Auto play teleprompter on start record!
  };

  // Stop Media Recording
  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsTeleprompterPlaying(false);
    }
  };

  // Snapshot PNG local download
  const handleTakeSnapshot = () => {
    if (webcamVideoRef.current && cameraStream) {
      const canvas = document.createElement('canvas');
      canvas.width = webcamVideoRef.current.videoWidth || 640;
      canvas.height = webcamVideoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(webcamVideoRef.current, 0, 0, canvas.width, canvas.height);
      
      const link = document.createElement('a');
      link.download = `snap-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      alert('Start the camera feed first to capture a snapshot.');
    }
  };

  // Submit Stream URL Import with Direct Transcoding Pipeline
  const handleImportStreamSubmit = async (e) => {
    e.preventDefault();
    if (!streamUrl) return;

    setIsImportingStream(true);
    try {
      // 1. Ingest URL into DB
      const res = await fetch(`${API_BASE}/api/videos/import-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: streamUrl,
          title: streamTitle || 'Live Ingest Stream',
          description: streamDescription || 'Imported network feed for cloud processing.'
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Failed to import stream URL');
        setIsImportingStream(false);
        return;
      }

      const newVideo = await res.json();
      
      // Add immediately to local video list to avoid delay
      setVideos(prev => [newVideo, ...prev]);

      // 2. Direct Process Ingested URL
      const processRes = await fetch(`${API_BASE}/api/videos/${newVideo.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutions: importSettings.resolutions,
          formats: importSettings.formats,
          watermarkText: importSettings.watermarkText,
          extractAudio: importSettings.extractAudio,
          thumbnailsCount: importSettings.thumbnailsCount
        })
      });

      if (processRes.ok) {
        // Update local state to reflect processing status
        setVideos(prev => prev.map(v => {
          if (v.id === newVideo.id) {
            return { ...v, status: 'QUEUED', progress: 0 };
          }
          return v;
        }));

        // Reset forms & diagnostics
        setStreamUrl('');
        setStreamTitle('');
        setStreamDescription('');
        setStreamDiagnostics({
          latency: 'Idle',
          codec: '---',
          resolution: '---',
          health: 'STANDBY',
          probing: false
        });

        // Redirect operator back to Dashboard active jobs panel
        setActiveTab('dashboard');
      } else {
        const processErrData = await processRes.json();
        alert(processErrData.error || 'Import succeeded but failed to initialize transcoding pipeline.');
      }
    } catch (err) {
      console.error('Import Stream Process Error:', err);
      alert('Network error occurred while importing stream and starting processing.');
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
        
        // Open the Ingestion config modal
        setShowNewProjectModal(true);
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
        setShowNewProjectModal(false); // Close modal
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
                <h2>NebulaStream</h2>
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
            <span>NebulaStream System Overhaul Inc. © 2026. All rights reserved. Designed with Obsidian Glassmorphism.</span>
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
              <h2>NebulaStream Matrix</h2>
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
                    placeholder="operator@nebulastream.io"
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
                    <span>Enter NebulaStream Console</span>
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
                  <h2>NebulaStream</h2>
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
                  <Video size={16} />
                  <span>Studios</span>
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
              <button 
                className="upgrade-storage-btn" 
                onClick={() => {
                  setSelectedVideoForConfig(null);
                  setJobSettings({
                    resolutions: ['720p', '480p'],
                    formats: ['mp4'],
                    watermarkText: 'NEBULASTREAM',
                    extractAudio: true,
                    thumbnailsCount: 3,
                    internalTitle: '',
                    descriptionNotes: '',
                    autoColorGrading: false,
                    frameInterpolation: true
                  });
                  setShowNewProjectModal(true);
                }}
              >
                + New Project
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', padding: '0 0.5rem', color: 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  <HelpCircle size={14} style={{ color: 'var(--color-success)' }} />
                  <span title={userSession?.email}>{userSession?.email || 'operator@nebulastream.io'}</span>
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
                <span className="indicator-item" style={{ color: 'var(--color-secondary)' }}>
                  NebulaStream Studio v4.2
                </span>
              </div>

              <div className="topbar-actions-deck">
                <button 
                  className="btn-action-primary" 
                  onClick={() => {
                    setSelectedVideoForConfig(null);
                    setJobSettings({
                      resolutions: ['720p', '480p'],
                      formats: ['mp4'],
                      watermarkText: 'NEBULASTREAM',
                      extractAudio: true,
                      thumbnailsCount: 3,
                      internalTitle: '',
                      descriptionNotes: '',
                      autoColorGrading: false,
                      frameInterpolation: true
                    });
                    setShowNewProjectModal(true);
                  }}
                >
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
                                          setShowNewProjectModal(true);
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

            {/* 3. Studios Tab: Webcam Studio with Teleprompter (MATCHING USER SCREENSHOT) */}
            {activeTab === 'studios' && (
              <>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Webcam Studio with Teleprompter</h1>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Deliver high-impact video scripts directly to S3 with active audio visualizers and real-time hardware settings.
                  </p>
                </div>

                <div className="studio-tab-layout">
                  {/* Left Column: Live camera viewport & scrolling teleprompter */}
                  <div>
                    <div className="studio-viewport-wrapper">
                      {recordingPreviewUrl ? (
                        <video src={recordingPreviewUrl} controls className="studio-viewport-video" />
                      ) : cameraStream ? (
                        <video ref={webcamVideoRef} autoPlay muted playsInline className="studio-viewport-video" />
                      ) : (
                        <div className="webcam-placeholder">
                          <div className="webcam-placeholder-icon">
                            <Video size={36} />
                          </div>
                          <h3>Live Feed Offline</h3>
                          <p>Enable the camera feed from the hardware settings panel to begin.</p>
                        </div>
                      )}

                      {/* Top badges bar */}
                      <div className="studio-viewport-overlay-top">
                        <div className="studio-rec-badge">
                          <span className={`studio-rec-dot ${isRecording ? 'active' : ''}`}></span>
                          <span>{isRecording ? `REC ${formatTimer(recordingSeconds)}` : 'STDBY'}</span>
                        </div>
                        <div className="studio-stream-meta-badge">
                          {recordingQuality === '4k' ? '4K • 60 FPS • 48kHz' : '1080p • 60 FPS • 44.1kHz'}
                        </div>
                      </div>

                      {/* Dynamic scrolling teleprompter text overlay */}
                      {!recordingPreviewUrl && cameraStream && (
                        <div className="studio-teleprompter-overlay">
                          <div className="studio-teleprompter-scroll-box" id="teleprompter-scroll-box">
                            <div className="studio-teleprompter-text" style={{ fontSize: `${teleprompterFontSize}px` }}>
                              {teleprompterScript}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Audio visualizer jumps */}
                      {cameraStream && !recordingPreviewUrl && (
                        <div className="studio-audio-wave-viz">
                          {audioBars.map((level, i) => (
                            <div 
                              key={i} 
                              className="audio-wave-bar animated" 
                              style={{ 
                                height: `${level * 1.25}px`,
                                animationDelay: `${i * 0.15}s`
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Viewport overlay controls bottom deck */}
                      <div className="studio-viewport-controls-bottom">
                        <div className="studio-control-deck-row">
                          <button 
                            className="studio-deck-btn"
                            onClick={() => {
                              if (isRecording) {
                                handleStopRecording();
                              } else {
                                handleStartRecording();
                              }
                            }}
                            title={isRecording ? 'Stop Session' : 'Record Session'}
                          >
                            <span className={`studio-rec-dot ${isRecording ? 'active' : ''}`} style={{ width: '12px', height: '12px', display: 'block', margin: '0 auto 0.25rem' }}></span>
                            <span>{isRecording ? 'STOP' : 'RECORD'}</span>
                          </button>

                          <button 
                            className="studio-deck-btn"
                            onClick={() => {
                              if (cameraStream) {
                                stopCameraFeed();
                              } else {
                                startCameraFeed();
                              }
                            }}
                            title={cameraStream ? 'Turn Camera Off' : 'Turn Camera On'}
                          >
                            <Video size={16} style={{ display: 'block', margin: '0 auto 0.25rem' }} />
                            <span>{cameraStream ? 'MUTED' : 'CAMERA'}</span>
                          </button>

                          <button 
                            className="studio-deck-btn"
                            onClick={handleTakeSnapshot}
                            title="Capture Snapshot Image"
                          >
                            <Camera size={16} style={{ display: 'block', margin: '0 auto 0.25rem' }} />
                            <span>SNAPSHOT</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Hardware settings & teleprompter parameters */}
                  <div className="section-card hardware-settings-panel">
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>Hardware Settings</h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>Configure inputs and quality profile</p>
                    </div>

                    <div className="hardware-input-deck">
                      {/* Camera source selector */}
                      <div className="device-select-wrapper">
                        <label>Camera Source</label>
                        <select 
                          className="select-input"
                          value={selectedVideoDevice}
                          onChange={(e) => setSelectedVideoDevice(e.target.value)}
                          disabled={isRecording}
                        >
                          {devices.video.length === 0 ? (
                            <option value="">Logitech Brio 4K Stream Edition</option>
                          ) : (
                            devices.video.map(dev => (
                              <option key={dev.deviceId} value={dev.deviceId}>{dev.label || `Camera Source`}</option>
                            ))
                          )}
                        </select>
                      </div>

                      {/* Microphone source selector */}
                      <div className="device-select-wrapper">
                        <label>Audio Input</label>
                        <select 
                          className="select-input"
                          value={selectedAudioDevice}
                          onChange={(e) => setSelectedAudioDevice(e.target.value)}
                          disabled={isRecording}
                        >
                          {devices.audio.length === 0 ? (
                            <option value="">Shure MV7 - USB Microphone</option>
                          ) : (
                            devices.audio.map(dev => (
                              <option key={dev.deviceId} value={dev.deviceId}>{dev.label || `Audio Input`}</option>
                            ))
                          )}
                        </select>
                        {/* Audio level meter cyan bar */}
                        <div className="mini-progress-track" style={{ height: '3px', marginTop: '0.35rem' }}>
                          <div 
                            className="mini-progress-fill" 
                            style={{ 
                              width: cameraStream ? '45%' : '0%', 
                              background: 'var(--color-secondary)',
                              transition: 'width 0.1s ease'
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Teleprompter scripting */}
                    <div className="teleprompter-controls-deck">
                      <div className="teleprompter-action-row">
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>Teleprompter</span>
                        <button 
                          className="teleprompter-link-btn"
                          onClick={() => setShowScriptEditor(!showScriptEditor)}
                        >
                          {showScriptEditor ? 'CLOSE EDITOR' : 'SCRIPT EDITOR'}
                        </button>
                      </div>

                      {showScriptEditor ? (
                        <textarea 
                          className="textarea-input"
                          style={{ minHeight: '100px', fontSize: '0.8rem' }}
                          value={teleprompterScript}
                          onChange={(e) => setTeleprompterScript(e.target.value)}
                          placeholder="Type or paste your teleprompter script here..."
                        />
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button 
                            className={`teleprompter-play-btn ${isTeleprompterPlaying ? 'playing' : ''}`}
                            onClick={() => setIsTeleprompterPlaying(!isTeleprompterPlaying)}
                            disabled={!cameraStream || recordingPreviewUrl}
                          >
                            {isTeleprompterPlaying ? <Pause size={12} /> : <Play size={12} />}
                            <span>{isTeleprompterPlaying ? 'Pause' : 'Play Script'}</span>
                          </button>
                          <button 
                            className="btn-action-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              const box = document.getElementById('teleprompter-scroll-box');
                              if (box) box.scrollTop = 0;
                            }}
                          >
                            Reset
                          </button>
                        </div>
                      )}

                      {/* Speed Slider */}
                      <div className="teleprompter-slider-row" style={{ marginTop: '0.25rem' }}>
                        <label>Speed</label>
                        <input 
                          type="range"
                          min="1"
                          max="10"
                          step="0.5"
                          className="teleprompter-range-slider"
                          value={teleprompterSpeed}
                          onChange={(e) => setTeleprompterSpeed(parseFloat(e.target.value))}
                        />
                        <span style={{ width: '30px', textAlign: 'right' }}>{teleprompterSpeed}x</span>
                      </div>

                      {/* Font size slider */}
                      <div className="teleprompter-slider-row">
                        <label>Font Size</label>
                        <input 
                          type="range"
                          min="16"
                          max="64"
                          className="teleprompter-range-slider"
                          value={teleprompterFontSize}
                          onChange={(e) => setTeleprompterFontSize(parseInt(e.target.value))}
                        />
                        <span style={{ width: '35px', textAlign: 'right' }}>{teleprompterFontSize}px</span>
                      </div>
                    </div>

                    {/* Recording Quality Profile Cards */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                        Recording Quality
                      </label>
                      <div className="quality-deck">
                        <div 
                          className={`quality-choice-card ${recordingQuality === '4k' ? 'selected' : ''}`}
                          onClick={() => setRecordingQuality('4k')}
                        >
                          <div className="quality-card-desc">
                            <h4>4K (2160p)</h4>
                            <p>60fps - 45 Mbps - HEVC</p>
                          </div>
                          <div className="quality-card-check-circle">
                            {recordingQuality === '4k' && <span style={{ width: '6px', height: '6px', background: '#fff', borderRadius: '50%' }}></span>}
                          </div>
                        </div>

                        <div 
                          className={`quality-choice-card ${recordingQuality === '1080p' ? 'selected' : ''}`}
                          onClick={() => setRecordingQuality('1080p')}
                        >
                          <div className="quality-card-desc">
                            <h4>1080p (Full HD)</h4>
                            <p>60fps - 12 Mbps - H.264</p>
                          </div>
                          <div className="quality-card-check-circle">
                            {recordingQuality === '1080p' && <span style={{ width: '6px', height: '6px', background: '#fff', borderRadius: '50%' }}></span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Auto-upload to S3 Toggle Switch */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                      <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Auto-upload to S3</h4>
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>Upload immediately after stopping</p>
                      </div>
                      <label className="toggle-switch-wrapper">
                        <input 
                          type="checkbox" 
                          checked={autoUploadS3}
                          onChange={(e) => setAutoUploadS3(e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    {/* Advanced AV1 Encoding display tag */}
                    <div className="advanced-encoding-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <SlidersHorizontal size={14} style={{ color: 'var(--color-primary)' }} />
                        <span>Advanced Encoding</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)' }}>Hardware Accelerated (AV1)</span>
                    </div>

                  </div>
                </div>
              </>
            )}

            {/* 4. Stream URL Import Tab */}
            {activeTab === 'import' && (
              <>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Stream URL Ingestion</h1>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Ingest network video streams or live HLS feeds directly to the cloud transcoder engine.
                  </p>
                </div>

                <div className="stream-ingest-split" style={{ marginTop: '1.5rem' }}>
                  {/* Left Column: Live diagnostics & preview */}
                  <div className="stream-ingest-preview-panel">
                    <div className="stream-viewport-box">
                      {streamUrl && (streamUrl.endsWith('.mp4') || streamUrl.endsWith('.webm')) && !streamDiagnostics.probing ? (
                        <video 
                          src={streamUrl} 
                          controls 
                          autoPlay 
                          muted 
                          className="studio-viewport-video" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem' }}>
                          {/* Pulsing signal background visual effect */}
                          {streamDiagnostics.health === 'ONLINE' ? (
                            <div className="pulse-glow-circle" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.15)', border: '2px dashed var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'spin 20s linear infinite' }}>
                              <Layers size={24} style={{ color: 'var(--color-secondary)' }} />
                            </div>
                          ) : streamDiagnostics.probing ? (
                            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                          ) : (
                            <Activity size={36} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
                          )}
                          
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginTop: '1rem' }}>
                            {streamDiagnostics.probing ? 'Probing Network Packets...' : streamDiagnostics.health === 'ONLINE' ? 'Live Stream Ingestion Active' : 'Decoder Offline'}
                          </h3>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', maxWidth: '300px' }}>
                            {streamDiagnostics.probing ? 'Querying video headers, audio tracks, and codecs...' : streamDiagnostics.health === 'ONLINE' ? 'Ready to process stream. Configure parameters and click Ingest.' : 'Paste a stream URL or click a featured feed below to begin.'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Diagnostics grid */}
                    <div className="stream-diagnostic-grid">
                      <div className="diagnostic-item-card">
                        <span>Ping Latency</span>
                        <p style={{ color: streamDiagnostics.probing ? 'var(--color-warning)' : streamDiagnostics.health === 'ONLINE' ? 'var(--color-success)' : '#fff' }}>
                          {streamDiagnostics.latency}
                        </p>
                      </div>

                      <div className="diagnostic-item-card">
                        <span>Format / Codec</span>
                        <p>{streamDiagnostics.codec}</p>
                      </div>

                      <div className="diagnostic-item-card">
                        <span>Source Resolution</span>
                        <p>{streamDiagnostics.resolution}</p>
                      </div>

                      <div className="diagnostic-item-card">
                        <span>Decoder Status</span>
                        <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {streamDiagnostics.health === 'ONLINE' ? (
                            <>
                              <span className="status-dot active" style={{ display: 'inline-block' }}></span>
                              <span style={{ color: 'var(--color-success)' }}>ONLINE</span>
                            </>
                          ) : streamDiagnostics.probing ? (
                            <>
                              <span className="status-dot" style={{ display: 'inline-block', backgroundColor: 'var(--color-warning)', boxShadow: '0 0 6px var(--color-warning)' }}></span>
                              <span style={{ color: 'var(--color-warning)' }}>PROBING</span>
                            </>
                          ) : (
                            <>
                              <span className="status-dot" style={{ display: 'inline-block', backgroundColor: 'var(--color-text-muted)', boxShadow: 'none' }}></span>
                              <span style={{ color: 'var(--color-text-muted)' }}>STANDBY</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Featured test feeds */}
                    <div className="section-card">
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', marginBottom: '0.75rem' }}>
                        Featured Public Streams
                      </h4>
                      <div className="featured-feeds-list">
                        <div 
                          className="featured-feed-item"
                          onClick={() => {
                            setStreamUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4');
                            setStreamTitle('Sintel HD Cinematic Feed');
                            setStreamDescription('Official open movie Sintel encoded in high bitrate MP4 format.');
                            triggerStreamProbe('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4');
                          }}
                        >
                          <span className="featured-feed-item-title">Sintel Movie (HTTP direct mp4)</span>
                          <span className="featured-feed-item-type">MP4</span>
                        </div>

                        <div 
                          className="featured-feed-item"
                          onClick={() => {
                            setStreamUrl('https://test-streams.mux.dev/x36xhg/x36xhg.m3u8');
                            setStreamTitle('Mux HLS Adaptive Live Stream');
                            setStreamDescription('Adaptive HLS stream index playlist link containing multi-bitrate profiles.');
                            triggerStreamProbe('https://test-streams.mux.dev/x36xhg/x36xhg.m3u8');
                          }}
                        >
                          <span className="featured-feed-item-title">Mux Adaptive Live Feed (.m3u8)</span>
                          <span className="featured-feed-item-type">HLS</span>
                        </div>

                        <div 
                          className="featured-feed-item"
                          onClick={() => {
                            setStreamUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
                            setStreamTitle('Tears of Steel 4K UHD Feed');
                            setStreamDescription('Sci-Fi CGI test film Tears of Steel rendered in 4K resolution.');
                            triggerStreamProbe('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
                          }}
                        >
                          <span className="featured-feed-item-title">Tears of Steel (4K Cinematic)</span>
                          <span className="featured-feed-item-type">4K MP4</span>
                        </div>

                        <div 
                          className="featured-feed-item"
                          onClick={() => {
                            setStreamUrl('https://playertest.longtailvideo.com/adaptive/subaru/subaru.m3u8');
                            setStreamTitle('Subaru Multi-Bitrate HLS Playlist');
                            setStreamDescription('HLS stream containing different streams for variable network quality.');
                            triggerStreamProbe('https://playertest.longtailvideo.com/adaptive/subaru/subaru.m3u8');
                          }}
                        >
                          <span className="featured-feed-item-title">Subaru Test Feed (.m3u8)</span>
                          <span className="featured-feed-item-type">HLS</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Ingestion control panel & pipeline options */}
                  <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>Ingestion Configuration</h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>Define transcode profiles and stream properties</p>
                    </div>

                    <form onSubmit={handleImportStreamSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                      <div className="form-group">
                        <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Stream Destination URL</span>
                          {streamUrl && (
                            <span 
                              style={{ color: 'var(--color-secondary)', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                              onClick={() => triggerStreamProbe(streamUrl)}
                            >
                              PROBE STREAM
                            </span>
                          )}
                        </label>
                        <input 
                          type="url" 
                          required
                          className="text-input" 
                          value={streamUrl}
                          onChange={(e) => {
                            setStreamUrl(e.target.value);
                            // Auto probe with slight delay
                            if (e.target.value) triggerStreamProbe(e.target.value);
                          }}
                          placeholder="https://example.com/stream.m3u8"
                        />
                      </div>

                      <div className="form-group">
                        <label>Asset Alias / Title</label>
                        <input 
                          type="text" 
                          required
                          className="text-input" 
                          value={streamTitle}
                          onChange={(e) => setStreamTitle(e.target.value)}
                          placeholder="e.g. Live Ingestion Feed"
                        />
                      </div>

                      <div className="form-group">
                        <label>Notes & Description</label>
                        <textarea 
                          className="textarea-input"
                          style={{ minHeight: '60px' }}
                          value={streamDescription}
                          onChange={(e) => setStreamDescription(e.target.value)}
                          placeholder="Provide details about this network stream..."
                        />
                      </div>

                      {/* Transcode Configuration settings directly inside form! */}
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                          Ingestion Quality Profile
                        </label>
                        <div className="quality-deck">
                          <div 
                            className={`quality-choice-card ${importSettings.qualityProfile === '4k' ? 'selected' : ''}`}
                            onClick={() => setImportSettings(prev => ({ 
                              ...prev, 
                              qualityProfile: '4k',
                              resolutions: ['1080p', '720p'],
                              formats: ['mp4', 'webm'],
                              extractAudio: true
                            }))}
                          >
                            <div className="quality-card-desc">
                              <h4>4K High-Fidelity Transcode</h4>
                              <p>HEVC + WebM dual output containers</p>
                            </div>
                            <div className="quality-card-check-circle">
                              {importSettings.qualityProfile === '4k' && <span style={{ width: '6px', height: '6px', background: '#fff', borderRadius: '50%' }}></span>}
                            </div>
                          </div>

                          <div 
                            className={`quality-choice-card ${importSettings.qualityProfile === '1080p' ? 'selected' : ''}`}
                            onClick={() => setImportSettings(prev => ({ 
                              ...prev, 
                              qualityProfile: '1080p',
                              resolutions: ['720p', '480p'],
                              formats: ['mp4'],
                              extractAudio: true
                            }))}
                          >
                            <div className="quality-card-desc">
                              <h4>Standard HD Distribution</h4>
                              <p>H.264 MP4 output optimized for web delivery</p>
                            </div>
                            <div className="quality-card-check-circle">
                              {importSettings.qualityProfile === '1080p' && <span style={{ width: '6px', height: '6px', background: '#fff', borderRadius: '50%' }}></span>}
                            </div>
                          </div>

                          <div 
                            className={`quality-choice-card ${importSettings.qualityProfile === 'audio-only' ? 'selected' : ''}`}
                            onClick={() => setImportSettings(prev => ({ 
                              ...prev, 
                              qualityProfile: 'audio-only',
                              resolutions: ['480p'],
                              formats: ['mp4'],
                              extractAudio: true
                            }))}
                          >
                            <div className="quality-card-desc">
                              <h4>Podcast / Audio Extract</h4>
                              <p>Isolate AAC/MP3 track (bypasses video rendering)</p>
                            </div>
                            <div className="quality-card-check-circle">
                              {importSettings.qualityProfile === 'audio-only' && <span style={{ width: '6px', height: '6px', background: '#fff', borderRadius: '50%' }}></span>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Transcode checkboxes details */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <div className="form-group">
                          <label style={{ fontSize: '0.78rem' }}>Custom Resolutions</label>
                          <div className="checkbox-group" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.25rem' }}>
                            {['1080p', '720p', '480p'].map(res => (
                              <div 
                                key={res} 
                                className={`checkbox-card ${importSettings.resolutions.includes(res) ? 'selected' : ''}`}
                                onClick={() => toggleImportResolution(res)}
                                style={{ padding: '0.35rem' }}
                              >
                                <input 
                                  type="checkbox" 
                                  checked={importSettings.resolutions.includes(res)}
                                  onChange={() => {}}
                                />
                                <span className="checkbox-label" style={{ fontSize: '0.75rem' }}>{res}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="form-group">
                          <label style={{ fontSize: '0.78rem' }}>Watermark text overlay</label>
                          <input 
                            type="text" 
                            className="text-input" 
                            style={{ padding: '0.45rem', fontSize: '0.8rem' }}
                            value={importSettings.watermarkText}
                            onChange={(e) => setImportSettings(prev => ({ ...prev, watermarkText: e.target.value }))}
                            placeholder="NO WATERMARK"
                          />
                        </div>

                        {/* Extra toggles */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div 
                            className={`checkbox-card ${importSettings.extractAudio ? 'selected' : ''}`}
                            onClick={() => setImportSettings(prev => ({ ...prev, extractAudio: !prev.extractAudio }))}
                            style={{ padding: '0.45rem' }}
                          >
                            <input 
                              type="checkbox" 
                              checked={importSettings.extractAudio} 
                              onChange={() => {}}
                            />
                            <Volume2 size={12} style={{ color: 'var(--color-warning)' }} />
                            <span className="checkbox-label" style={{ fontSize: '0.75rem' }}>Extract MP3 Audio track</span>
                          </div>

                          <div 
                            className={`checkbox-card ${importSettings.autoColorGrading ? 'selected' : ''}`}
                            onClick={() => setImportSettings(prev => ({ ...prev, autoColorGrading: !prev.autoColorGrading }))}
                            style={{ padding: '0.45rem' }}
                          >
                            <input 
                              type="checkbox" 
                              checked={importSettings.autoColorGrading} 
                              onChange={() => {}}
                            />
                            <Sparkles size={12} style={{ color: 'var(--color-secondary)' }} />
                            <span className="checkbox-label" style={{ fontSize: '0.75rem' }}>AI Color Grading (Auto LUT)</span>
                          </div>
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        className="btn-primary" 
                        style={{ 
                          background: 'linear-gradient(135deg, var(--color-primary), #6366f1)',
                          width: '100%',
                          padding: '0.75rem',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          borderRadius: '6px',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          marginTop: '0.5rem',
                          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
                        }}
                        disabled={isImportingStream}
                      >
                        {isImportingStream ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Ingesting Pipeline Stream...</span>
                          </>
                        ) : (
                          <>
                            <ArrowRight size={16} />
                            <span>Ingest & Process Stream</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              </>
            )}

            {/* 5. Operations Telemetry & Console Tab (Screenshot 2 Layout) */}
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

            {/* 6. Enterprise placeholders for settings, billing, jobs, analytics */}
            {['jobs', 'analytics', 'settings', 'billing'].includes(activeTab) && (
              <div className="panel" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
                <Activity size={48} style={{ margin: '0 auto 1.5rem', color: 'var(--color-primary)', opacity: 0.8 }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{activeTab.toUpperCase()} PANEL</h2>
                <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  Connected to NebulaStream Enterprise cloud cluster node: <strong style={{ color: '#fff' }}>node-fargate-018</strong>. Data updates automatically.
                </p>
              </div>
            )}

          </main>

          {/* WATCH/PLAY MODAL OVERLAY */}
          {playingVideo && (
            <VideoPlayerModal 
              video={playingVideo} 
              onClose={() => setPlayingVideo(null)} 
            />
          )}

          {/* NEW PROJECT INGESTION MODAL OVERLAY */}
          {showNewProjectModal && (
            <div className="modal-overlay">
              <div className="project-ingestion-card panel" style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative' }}>
                
                {/* Close modal X button */}
                <button 
                  className="close-btn" 
                  style={{ position: 'absolute', right: '1.25rem', top: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', padding: '0.45rem' }}
                  onClick={() => setShowNewProjectModal(false)}
                >
                  <X size={16} />
                </button>

                <h3 className="panel-title" style={{ marginBottom: '1.5rem' }}>
                  <Plus size={18} /> Ingest & Transcode Project
                </h3>

                <div className="studio-split-layout">
                  {/* Left Side: Drag & Drop Ingestion */}
                  <div 
                    className={`drag-drop-card-panel ${dragActive ? 'drag-active' : ''}`}
                    style={{ height: '340px' }}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => modalFileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      ref={modalFileInputRef} 
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
                        <h4 style={{ color: '#fff', fontWeight: 600 }}>Streaming video to cloud...</h4>
                        <div className="upload-progress-container" style={{ width: '80%', margin: '1rem auto 0' }}>
                          <div className="progress-bar-bg">
                            <div className="progress-bar-fill animated" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '0.5rem', display: 'block' }}>
                            {uploadProgress}%
                          </span>
                        </div>
                      </div>
                    ) : selectedVideoForConfig ? (
                      <div style={{ textAlign: 'center' }}>
                        <CheckCircle size={36} style={{ color: 'var(--color-success)', margin: '0 auto 0.5rem' }} />
                        <h4 style={{ color: '#fff', fontWeight: 700 }}>Asset Ingested</h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                          {selectedVideoForConfig.title}
                        </p>
                        <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem', cursor: 'pointer', display: 'block', marginTop: '0.75rem', fontWeight: 600 }}>
                          Replace file
                        </span>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Drag & Drop Master Video</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                          or <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>browse files</span>
                        </p>
                        <div className="studio-format-chips-row">
                          <span className="format-chip-item">.MP4</span>
                          <span className="format-chip-item">.MOV</span>
                          <span className="format-chip-item">MAX 500MB</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Configurations */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Metadata */}
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
                      <label>Target Resolutions</label>
                      <div className="checkbox-group" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
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
                            <span className="checkbox-label" style={{ fontSize: '0.78rem' }}>{res}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Output Containers</label>
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
                            <span className="checkbox-label" style={{ fontSize: '0.78rem' }}>{fmt.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Watermark Burn-in Text</label>
                      <input 
                        type="text" 
                        className="text-input" 
                        value={jobSettings.watermarkText}
                        onChange={(e) => setJobSettings(prev => ({ ...prev, watermarkText: e.target.value }))}
                        placeholder="CONFIDENTIAL"
                      />
                    </div>

                    <div className="form-group">
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
                          <Volume2 size={14} style={{ color: 'var(--color-warning)' }} />
                          <span className="checkbox-label" style={{ fontSize: '0.78rem' }}>Extract MP3 Audio track</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button 
                        className="btn-action-primary"
                        style={{ flex: 1 }}
                        onClick={handleStartProcessing}
                        disabled={!selectedVideoForConfig}
                      >
                        <Sparkles size={14} style={{ marginRight: '0.25rem', verticalAlign: 'text-bottom' }} /> Initialize Processing
                      </button>
                      <button 
                        className="btn-action-secondary"
                        onClick={() => setShowNewProjectModal(false)}
                      >
                        Cancel
                      </button>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      )}
    </>
  );
}
