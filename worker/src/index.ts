import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { processVideoJob, JobData } from './processor';

// Load environment variables
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

console.log(`========================================`);
console.log(`Connecting to Redis at: ${redisUrl}`);

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

// Create BullMQ Worker
const worker = new Worker(
  'video-processing',
  async (job: Job<JobData>) => {
    console.log(`[Job ${job.id}] Started processing video: ${job.data.videoId}`);
    
    await processVideoJob(job.id!, job.data, async (percent: number) => {
      await job.updateProgress(percent);
    });

    console.log(`[Job ${job.id}] Successfully completed video processing: ${job.data.videoId}`);
  },
  {
    connection: connection as any,
    concurrency: 1, // Process 1 video at a time to prevent CPU overload in container
    limiter: {
      max: 1,
      duration: 1000,
    }
  }
);

// Event Listeners
worker.on('active', (job) => {
  console.log(`[Job ${job?.id}] Has active status`);
});

worker.on('completed', (job) => {
  console.log(`[Job ${job?.id}] Has completed status`);
});

worker.on('failed', (job, err) => {
  console.error(`[Job ${job?.id}] Has failed with error:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker global error:', err);
});

console.log(`🚀 Video processing worker is active and listening for jobs.`);
console.log(`========================================`);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down worker...`);
  await worker.close();
  connection.disconnect();
  console.log('Worker connections closed. Exiting process.');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
