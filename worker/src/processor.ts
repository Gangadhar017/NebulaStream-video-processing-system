import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
import { prisma } from './config/db';
import { storageService } from './config/storage';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const ffprobePromise = promisify(ffmpeg.ffprobe);

export interface JobData {
  videoId: string;
  originalPath: string;
  mimeType: string;
  options: {
    resolutions: string[];
    formats: string[];
    watermarkText: string;
    extractAudio: boolean;
    thumbnailsCount: number;
  };
}

// Download S3 file helper
const downloadFromS3 = async (key: string, localDest: string): Promise<void> => {
  const bucketName = process.env.AWS_S3_BUCKET || '';
  const region = process.env.AWS_REGION || 'us-east-1';
  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    }
  });

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  const response = await s3Client.send(command);
  const stream = response.Body as Readable;
  const fileStream = fs.createWriteStream(localDest);

  return new Promise((resolve, reject) => {
    stream.pipe(fileStream)
      .on('finish', () => resolve())
      .on('error', (err) => reject(err));
  });
};

// Transcode helper
const transcodeVideo = (
  inputPath: string,
  outputPath: string,
  resolution: string,
  format: string,
  watermarkText: string,
  onProgress: (percent: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);

    // Apply scaling and watermark filters
    let vfFilters: string[] = [];
    if (resolution === '1080p') {
      vfFilters.push('scale=1920:-2');
    } else if (resolution === '720p') {
      vfFilters.push('scale=1280:-2');
    } else if (resolution === '480p') {
      vfFilters.push('scale=854:-2');
    }

    if (watermarkText) {
      const escapedText = watermarkText.replace(/:/g, '\\:').replace(/'/g, "'\\''");
      vfFilters.push(`drawtext=text='${escapedText}':x=30:y=30:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.4:boxborderw=6`);
    }

    if (vfFilters.length > 0) {
      command = command.videoFilters(vfFilters.join(','));
    }

    // Configure encoders based on format
    if (format === 'mp4') {
      command = command.videoCodec('libx264').audioCodec('aac').format('mp4');
    } else if (format === 'webm') {
      command = command.videoCodec('libvpx-vp9').audioCodec('libvorbis').format('webm');
    } else if (format === 'mkv') {
      command = command.videoCodec('libx264').audioCodec('aac').format('matroska');
    }

    command
      .on('progress', (progress) => {
        if (progress.percent) {
          onProgress(Math.min(100, Math.max(0, progress.percent)));
        }
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
};

// Extract Audio helper
const extractAudioTrack = (
  inputPath: string,
  outputPath: string,
  onProgress: (percent: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate(192)
      .format('mp3')
      .on('progress', (progress) => {
        if (progress.percent) {
          onProgress(Math.min(100, Math.max(0, progress.percent)));
        }
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
};

// Thumbnail helper
const generateThumbnails = async (
  inputPath: string,
  outputDir: string,
  duration: number,
  count: number,
  onProgress: (percent: number) => void
): Promise<string[]> => {
  const thumbnailPaths: string[] = [];
  const step = duration / (count + 1);

  for (let i = 1; i <= count; i++) {
    const timestamp = parseFloat((step * i).toFixed(2));
    const filename = `thumbnail-${i}.png`;
    const outputPath = path.join(outputDir, filename);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(timestamp)
        .frames(1)
        .size('320x180')
        .format('image2')
        .on('end', () => {
          thumbnailPaths.push(outputPath);
          resolve();
        })
        .on('error', (err: Error) => reject(err))
        .save(outputPath);
    });

    onProgress((i / count) * 100);
  }

  return thumbnailPaths;
};

// Main Processor Job Function
export const processVideoJob = async (jobId: string, data: JobData, updateJobProgress: (percent: number) => Promise<void>) => {
  const { videoId, originalPath, options } = data;
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

  // Create temporary local work directory
  const jobDir = path.join(__dirname, `../../temp/jobs/${videoId}`);
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  let localInputPath = '';

  try {
    // 1. Update Video Status in DB to PROCESSING
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'PROCESSING', progress: 0 }
    });

    const isStreamUrl = originalPath.startsWith('http://') || originalPath.startsWith('https://');

    if (isStreamUrl) {
      localInputPath = originalPath;
    } else {
      // 2. Fetch input file
      if (process.env.STORAGE_TYPE === 's3') {
        localInputPath = path.join(jobDir, 'original_input');
        await downloadFromS3(originalPath, localInputPath);
      } else {
        localInputPath = path.resolve(path.join(uploadDir, originalPath));
      }

      if (!fs.existsSync(localInputPath)) {
        throw new Error(`Original video file not found at local path: ${localInputPath}`);
      }
    }

    // 3. Probe original video duration & metadata
    let duration = 0;
    try {
      const metadata: any = await ffprobePromise(localInputPath);
      duration = Number(metadata?.format?.duration) || 0;
    } catch (probeError) {
      console.warn(`Warning: failed to probe video duration/metadata for ${localInputPath}:`, probeError);
    }
    
    // Save duration back to database
    await prisma.video.update({
      where: { id: videoId },
      data: { duration }
    });

    // 4. Calculate total processing steps to estimate overall progress
    const transcodeConfigs: { resolution: string; format: string }[] = [];
    for (const res of options.resolutions) {
      for (const fmt of options.formats) {
        transcodeConfigs.push({ resolution: res, format: fmt });
      }
    }

    const totalSteps = transcodeConfigs.length + 
                       (options.extractAudio ? 1 : 0) + 
                       (options.thumbnailsCount > 0 ? 1 : 0);
    
    let completedSteps = 0;

    const reportGlobalProgress = async (stepPercent: number) => {
      const globalPercent = Math.round(
        ((completedSteps * 100) + stepPercent) / totalSteps
      );
      await updateJobProgress(globalPercent);
      // Keep DB in sync
      await prisma.video.update({
        where: { id: videoId },
        data: { progress: globalPercent }
      });
    };

    // 5. Run Transcodes
    const processedAssetsList: { assetType: 'VIDEO' | 'AUDIO' | 'THUMBNAIL'; resolution: string; format: string; localPath: string; mime: string }[] = [];

    for (const config of transcodeConfigs) {
      const filename = `transcoded-${config.resolution}.${config.format}`;
      const localOutputPath = path.join(jobDir, filename);
      const mime = config.format === 'mp4' ? 'video/mp4' : config.format === 'webm' ? 'video/webm' : 'video/x-matroska';

      await transcodeVideo(
        localInputPath,
        localOutputPath,
        config.resolution,
        config.format,
        options.watermarkText,
        async (percent) => {
          await reportGlobalProgress(percent);
        }
      );

      processedAssetsList.push({
        assetType: 'VIDEO',
        resolution: config.resolution,
        format: config.format,
        localPath: localOutputPath,
        mime
      });

      completedSteps++;
      await reportGlobalProgress(0);
    }

    // 6. Run Audio Extraction
    if (options.extractAudio) {
      const audioFilename = 'extracted-audio.mp3';
      const localAudioPath = path.join(jobDir, audioFilename);

      await extractAudioTrack(
        localInputPath,
        localAudioPath,
        async (percent) => {
          await reportGlobalProgress(percent);
        }
      );

      processedAssetsList.push({
        assetType: 'AUDIO',
        resolution: 'original',
        format: 'mp3',
        localPath: localAudioPath,
        mime: 'audio/mpeg'
      });

      completedSteps++;
      await reportGlobalProgress(0);
    }

    // 7. Run Thumbnails Generation
    if (options.thumbnailsCount > 0) {
      if (duration > 0) {
        try {
          const thumbnailPaths = await generateThumbnails(
            localInputPath,
            jobDir,
            duration,
            options.thumbnailsCount,
            async (percent) => {
              await reportGlobalProgress(percent);
            }
          );

          thumbnailPaths.forEach((tPath, index) => {
            processedAssetsList.push({
              assetType: 'THUMBNAIL',
              resolution: 'original',
              format: 'png',
              localPath: tPath,
              mime: 'image/png'
            });
          });
        } catch (thumbError) {
          console.warn('Warning: failed to generate thumbnails:', thumbError);
        }
      } else {
        console.warn('Skipping thumbnail generation: video duration is 0 or indeterminate (likely a stream URL)');
      }

      completedSteps++;
      await reportGlobalProgress(0);
    }

    // 8. Upload processed files to storage and update database
    for (const asset of processedAssetsList) {
      const destKey = `processed/${videoId}/${path.basename(asset.localPath)}`;
      
      // Upload via storage adapter
      const storageResult = await storageService.uploadFile(asset.localPath, destKey, asset.mime);
      
      const stats = fs.statSync(asset.localPath);

      // Save ProcessedAsset records
      await prisma.processedAsset.create({
        data: {
          videoId,
          assetType: asset.assetType,
          resolution: asset.resolution,
          format: asset.format,
          path: storageResult.path,
          url: storageResult.url,
          size: stats.size
        }
      });
    }

    // 9. Update Video Status to COMPLETED
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'COMPLETED', progress: 100 }
    });

  } catch (error: any) {
    console.error(`Processing error in Job ${jobId}:`, error);
    
    // Update Video Status to FAILED
    await prisma.video.update({
      where: { id: videoId },
      data: { 
        status: 'FAILED', 
        error: error.message || 'Unknown processing error' 
      }
    });

    throw error;
  } finally {
    // 10. Clean up job working directory
    try {
      if (fs.existsSync(jobDir)) {
        fs.rmSync(jobDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Failed to clean up temp files:', cleanupError);
    }
  }
};

export const processExamJob = async (
  jobId: string,
  data: any,
  updateJobProgress: (percent: number) => Promise<void>
) => {
  const { examRecordingId, videoPath, studentId, examId } = data;
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

  // Create temporary local work directory
  const jobDir = path.join(__dirname, `../../temp/jobs/exam-${examRecordingId}`);
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  let localInputPath = '';

  try {
    // 1. Update status to PROCESSING
    await prisma.examRecording.update({
      where: { id: examRecordingId },
      data: { status: 'PROCESSING', progress: 0 }
    });

    // 2. Fetch input file from storage
    if (process.env.STORAGE_TYPE === 's3') {
      localInputPath = path.join(jobDir, 'original_input.webm');
      await downloadFromS3(videoPath, localInputPath);
    } else {
      localInputPath = path.resolve(path.join(uploadDir, videoPath));
    }

    if (!fs.existsSync(localInputPath)) {
      throw new Error(`Original exam video file not found at: ${localInputPath}`);
    }

    // 3. Probe duration
    let duration = 0;
    try {
      const metadata: any = await ffprobePromise(localInputPath);
      duration = Number(metadata?.format?.duration) || 0;
    } catch (probeError) {
      console.warn(`Warning: failed to probe exam video duration for ${localInputPath}:`, probeError);
    }

    // 4. Transcode to compressed MP4 and burn in proctoring watermark
    const outputFilename = `exam-processed.mp4`;
    const localOutputPath = path.join(jobDir, outputFilename);

    await transcodeVideo(
      localInputPath,
      localOutputPath,
      '480p', // Low-bitrate 480p to preserve storage space for exam logs
      'mp4',
      `Student ID: ${studentId} | Exam ID: ${examId}`,
      async (percent) => {
        // First 50% of global progress is transcoding
        const globalPercent = Math.round(percent * 0.5);
        await updateJobProgress(globalPercent);
        await prisma.examRecording.update({
          where: { id: examRecordingId },
          data: { progress: globalPercent }
        });
      }
    );

    // 5. Upload processed MP4 video
    const videoDestKey = `processed-exams/${examRecordingId}/recording.mp4`;
    const videoStorageResult = await storageService.uploadFile(localOutputPath, videoDestKey, 'video/mp4');

    // 6. Periodic Audit snapshots (1 frame every 10 seconds)
    const snapshotInterval = 10;
    const snapshotsCount = Math.max(1, Math.floor(duration / snapshotInterval));
    const snapshotPaths: { localPath: string; timestamp: number }[] = [];

    for (let i = 1; i <= snapshotsCount; i++) {
      const timestamp = i * snapshotInterval;
      const filename = `snap-${timestamp}.png`;
      const localSnapPath = path.join(jobDir, filename);

      try {
        await new Promise<void>((resolve, reject) => {
          ffmpeg(localInputPath)
            .seekInput(timestamp)
            .frames(1)
            .size('320x180')
            .format('image2')
            .on('end', () => {
              snapshotPaths.push({ localPath: localSnapPath, timestamp });
              resolve();
            })
            .on('error', (err: Error) => reject(err))
            .save(localSnapPath);
        });
      } catch (thumbError) {
        console.warn(`Warning: failed to generate snapshot at ${timestamp}s:`, thumbError);
      }

      // Update remaining 50% progress
      const snapProgress = 50 + Math.round((i / snapshotsCount) * 40);
      await updateJobProgress(snapProgress);
      await prisma.examRecording.update({
        where: { id: examRecordingId },
        data: { progress: snapProgress }
      });
    }

    // 7. Upload snapshots to storage and insert database records
    for (const snap of snapshotPaths) {
      const snapDestKey = `processed-exams/${examRecordingId}/snapshots/${path.basename(snap.localPath)}`;
      const snapStorageResult = await storageService.uploadFile(snap.localPath, snapDestKey, 'image/png');

      await prisma.auditSnapshot.create({
        data: {
          examRecordingId,
          timestamp: snap.timestamp,
          path: snapStorageResult.path,
          url: snapStorageResult.url
        }
      });
    }

    // 8. Update Exam status to COMPLETED
    await prisma.examRecording.update({
      where: { id: examRecordingId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        videoUrl: videoStorageResult.url,
        videoPath: videoStorageResult.path
      }
    });

  } catch (error: any) {
    console.error(`Processing exam error in Job ${jobId}:`, error);
    await prisma.examRecording.update({
      where: { id: examRecordingId },
      data: {
        status: 'FAILED',
        error: error.message || 'Unknown exam processing error'
      }
    });
    throw error;
  } finally {
    // 9. Clean up temporary workspace
    try {
      if (fs.existsSync(jobDir)) {
        fs.rmSync(jobDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Failed to clean up exam temp files:', cleanupError);
    }
  }
};
