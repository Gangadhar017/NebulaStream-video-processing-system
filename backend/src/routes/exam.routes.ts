import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/db';
import { storageService } from '../config/storage';
import { videoQueue } from '../config/queue';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB per chunk limit
  }
});

// 1. Start Exam Session
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { studentId, examId } = req.body;
    if (!studentId || !examId) {
      return res.status(400).json({ error: 'studentId and examId are required' });
    }

    const recording = await prisma.examRecording.create({
      data: {
        studentId,
        examId,
        status: 'PROCESSING',
        progress: 0
      }
    });

    return res.status(201).json(recording);
  } catch (error: any) {
    console.error('Start Exam Error:', error);
    return res.status(500).json({ error: 'Failed to start exam recording: ' + error.message });
  }
});

// 2. Upload Video Chunk
router.post('/:id/upload-chunk', upload.single('chunk'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No video chunk file provided' });
    }

    const recording = await prisma.examRecording.findUnique({
      where: { id }
    });

    if (!recording) {
      return res.status(404).json({ error: 'Exam recording session not found' });
    }

    const examTempDir = path.join(__dirname, '../../temp/exams');
    if (!fs.existsSync(examTempDir)) {
      fs.mkdirSync(examTempDir, { recursive: true });
    }

    const localPath = path.join(examTempDir, `${id}.webm`);
    fs.appendFileSync(localPath, file.buffer);

    return res.json({ success: true, message: 'Chunk successfully appended' });
  } catch (error: any) {
    console.error('Upload Chunk Error:', error);
    return res.status(500).json({ error: 'Failed to append chunk: ' + error.message });
  }
});

// 3. Log Proctoring Flag Event (cheating alerts)
router.post('/:id/flag', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { timestamp, eventType, severity, details } = req.body;

    if (timestamp === undefined || !eventType || !severity) {
      return res.status(400).json({ error: 'timestamp, eventType, and severity are required' });
    }

    const recording = await prisma.examRecording.findUnique({
      where: { id }
    });

    if (!recording) {
      return res.status(404).json({ error: 'Exam recording session not found' });
    }

    const flag = await prisma.proctorFlag.create({
      data: {
        examRecordingId: id,
        timestamp: parseInt(timestamp),
        eventType,
        severity,
        details: details || ''
      }
    });

    return res.status(201).json(flag);
  } catch (error: any) {
    console.error('Log Flag Error:', error);
    return res.status(500).json({ error: 'Failed to record proctor flag: ' + error.message });
  }
});

// 4. Complete Exam Session & Queue Job
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const recording = await prisma.examRecording.findUnique({
      where: { id }
    });

    if (!recording) {
      return res.status(404).json({ error: 'Exam recording session not found' });
    }

    const examTempDir = path.join(__dirname, '../../temp/exams');
    const localPath = path.join(examTempDir, `${id}.webm`);

    if (!fs.existsSync(localPath)) {
      return res.status(400).json({ error: 'No recording chunks found on server' });
    }

    // Determine upload path/key in storage
    const destKey = `exams/${id}.webm`;
    
    // Upload assembled master chunk file to storage service
    const storageResult = await storageService.uploadFile(localPath, destKey, 'video/webm');

    // Clean up temporary local file
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }

    // Update database status to QUEUED
    const updatedRecording = await prisma.examRecording.update({
      where: { id },
      data: {
        status: 'QUEUED',
        videoUrl: storageResult.url,
        videoPath: storageResult.path
      }
    });

    // Enqueue the post-processing job in the BullMQ video-processing queue
    await videoQueue.add(
      'process-exam',
      {
        examRecordingId: id,
        videoPath: storageResult.path,
        studentId: recording.studentId,
        examId: recording.examId
      },
      { jobId: `exam-${id}` }
    );

    return res.json({ 
      message: 'Exam recording successfully submitted and queued for auditing', 
      recording: updatedRecording 
    });
  } catch (error: any) {
    console.error('Complete Exam Error:', error);
    return res.status(500).json({ error: 'Failed to finalize exam recording: ' + error.message });
  }
});

// 5. Get All Exam Recordings
router.get('/', async (req: Request, res: Response) => {
  try {
    const recordings = await prisma.examRecording.findMany({
      include: {
        flags: true,
        snapshots: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    return res.json(recordings);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve exam recordings: ' + error.message });
  }
});

// 6. Get Specific Exam Recording
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recording = await prisma.examRecording.findUnique({
      where: { id },
      include: {
        flags: true,
        snapshots: true
      }
    });

    if (!recording) {
      return res.status(404).json({ error: 'Exam recording not found' });
    }

    return res.json(recording);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve exam recording details: ' + error.message });
  }
});

export default router;
