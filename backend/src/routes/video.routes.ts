import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/db';
import { storageService } from '../config/storage';
import { videoQueue } from '../config/queue';

const router = Router();

// Setup Multer temporary disk storage
const tempDir = path.join(__dirname, '../../temp/uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit for demo
  }
});

// Upload Video File
router.post('/upload', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, description } = req.body;
    const file = req.file;

    // Use filename as the destination key under originals
    const destKey = `originals/${file.filename}`;
    
    // Upload original file to Storage Service
    const storageResult = await storageService.uploadFile(file.path, destKey, file.mimetype);

    // Clean up temporary local upload file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Save metadata to database
    const video = await prisma.video.create({
      data: {
        title: title || file.originalname,
        description: description || '',
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        originalPath: storageResult.path,
        status: 'UPLOADED',
        progress: 0
      }
    });

    return res.status(201).json(video);
  } catch (error: any) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: 'Failed to upload video: ' + error.message });
  }
});

// Import Video from public Stream URL
router.post('/import-url', async (req: Request, res: Response) => {
  try {
    const { url, title, description } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Stream URL is required' });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid URL protocol. URL must start with http:// or https://' });
    }

    // Determine mimeType fallback
    let mimeType = 'video/mp4';
    if (url.includes('.m3u8')) {
      mimeType = 'application/x-mpegURL';
    } else if (url.includes('.webm')) {
      mimeType = 'video/webm';
    } else if (url.includes('.mkv')) {
      mimeType = 'video/x-matroska';
    }

    // Fallback title from URL filename
    let fallbackTitle = 'Imported Live Stream';
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const basename = path.basename(pathname);
      if (basename && basename.includes('.')) {
        fallbackTitle = basename;
      }
    } catch (e) {
      // ignore
    }

    // Save metadata to database
    const video = await prisma.video.create({
      data: {
        title: title || fallbackTitle,
        description: description || '',
        originalName: 'Network Stream',
        mimeType,
        size: 0, // Indeterminate size for stream
        originalPath: url,
        streamUrl: url,
        status: 'UPLOADED',
        progress: 0
      }
    });

    return res.status(201).json(video);
  } catch (error: any) {
    console.error('Import Stream URL Error:', error);
    return res.status(500).json({ error: 'Failed to import stream URL: ' + error.message });
  }
});

// Get All Videos
router.get('/', async (req: Request, res: Response) => {
  try {
    const videos = await prisma.video.findMany({
      include: {
        assets: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    return res.json(videos);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve videos: ' + error.message });
  }
});

// Get Specific Video
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const video = await prisma.video.findUnique({
      where: { id },
      include: { assets: true }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Try to append live queue progress if still in queue/processing
    if (video.status === 'PROCESSING' || video.status === 'QUEUED') {
      const job = await videoQueue.getJob(id);
      if (job) {
        const progress = job.progress || 0;
        video.progress = typeof progress === 'number' ? progress : parseInt(progress as any) || 0;
      }
    }

    return res.json(video);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve video details: ' + error.message });
  }
});

// Queue Job to Process Video
router.post('/:id/process', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolutions, formats, watermarkText, extractAudio, thumbnailsCount } = req.body;

    const video = await prisma.video.findUnique({
      where: { id }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.status === 'PROCESSING' || video.status === 'QUEUED') {
      return res.status(400).json({ error: 'Video is already being processed or is in the queue' });
    }

    // Default configurations
    const jobOptions = {
      resolutions: resolutions || ['720p', '480p'],
      formats: formats || ['mp4'],
      watermarkText: watermarkText || '',
      extractAudio: extractAudio === true,
      thumbnailsCount: thumbnailsCount !== undefined ? parseInt(thumbnailsCount) : 3
    };

    // Update Video status to QUEUED
    await prisma.video.update({
      where: { id },
      data: {
        status: 'QUEUED',
        progress: 0,
        error: null
      }
    });

    // Add job to BullMQ queue using Video ID as Job ID for easy tracking
    await videoQueue.add(
      'process-video',
      {
        videoId: video.id,
        originalPath: video.originalPath,
        mimeType: video.mimeType,
        options: jobOptions
      },
      { jobId: video.id }
    );

    return res.json({ message: 'Video added to processing queue', status: 'QUEUED' });
  } catch (error: any) {
    console.error('Queue job failed:', error);
    return res.status(500).json({ error: 'Failed to queue processing job: ' + error.message });
  }
});

// SSE progress stream
router.get('/:id/progress-stream', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendSSE = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Immediate send
  let video = await prisma.video.findUnique({
    where: { id },
    include: { assets: true }
  });

  if (!video) {
    sendSSE({ error: 'Video not found' });
    return res.end();
  }

  sendSSE({
    status: video.status,
    progress: video.progress,
    error: video.error,
    assets: video.assets
  });

  // Start polling interval
  const intervalId = setInterval(async () => {
    try {
      video = await prisma.video.findUnique({
        where: { id },
        include: { assets: true }
      });

      if (!video) {
        sendSSE({ error: 'Video deleted' });
        clearInterval(intervalId);
        return res.end();
      }

      let currentProgress = video.progress;
      if (video.status === 'PROCESSING' || video.status === 'QUEUED') {
        const job = await videoQueue.getJob(id);
        if (job) {
          const progress = job.progress || 0;
          currentProgress = typeof progress === 'number' ? progress : parseInt(progress as any) || 0;
        }
      }

      sendSSE({
        status: video.status,
        progress: currentProgress,
        error: video.error,
        assets: video.assets
      });

      if (video.status === 'COMPLETED' || video.status === 'FAILED') {
        clearInterval(intervalId);
        res.end();
      }
    } catch (err) {
      console.error('SSE polling error:', err);
      clearInterval(intervalId);
      res.end();
    }
  }, 1000);

  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// Delete Video
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const video = await prisma.video.findUnique({
      where: { id },
      include: { assets: true }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Cancel BullMQ Job if active/queued
    const job = await videoQueue.getJob(id);
    if (job) {
      await job.remove();
    }

    // Delete processed assets files from storage
    for (const asset of video.assets) {
      try {
        await storageService.deleteFile(asset.path);
      } catch (err) {
        console.error(`Failed to delete asset file: ${asset.path}`, err);
      }
    }

    // Delete original file from storage
    try {
      await storageService.deleteFile(video.originalPath);
    } catch (err) {
      console.error(`Failed to delete original file: ${video.originalPath}`, err);
    }

    // Delete from DB (relational cascade deletes ProcessedAssets)
    await prisma.video.delete({
      where: { id }
    });

    return res.json({ success: true, message: 'Video and all related assets successfully deleted' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete video: ' + error.message });
  }
});

export default router;
