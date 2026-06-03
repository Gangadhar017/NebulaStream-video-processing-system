# AetherFlow - Cloud Video Processing System

A production-grade, containerized, cloud-ready **Video Processing System** built using modern technologies. The system allows users to upload videos, queue asynchronous transcoding jobs with various resolutions, container formats, watermarks, isolated audio extraction, and dynamic thumbnail generation, all with real-time progress tracking and seamless multi-resolution video playback.

---

## System Architecture

```
                                      +-------------------------+
                                      |   React SPA (Vite)      |
                                      |   Dashboard Client      |
                                      +------------+------------+
                                                   ^
                                                   | HTTP API / SSE
                                                   v
                                      +------------+------------+
                                      |   Express Backend API   |
                                      +---+------------+----+---+
                                          |            |    |
                            Prisma Client |            |    | Dispatch Job
                                          v            |    v
+-------------------------+         +-----+-----+      |  +-+--------------------+
|                         |         |  MongoDB  |      |  |     Redis Queue      |
|  Local Storage Vol /    |<--------|  Database |      |  |      (BullMQ)        |
|  AWS S3 Bucket          |         +-----------+      |  +-+--------------------+
|                         |<---------------------------+    ^
+-------------------------+       Download/Upload Assets    | Pop & Progress
                                                            v
                                                  +---------+------------+
                                                  |   FFmpeg Job Worker  |
                                                  +----------------------+
```

1. **Frontend (Vite + React)**: Styled with premium custom Vanilla CSS Modules. Houses drag-and-drop file uploader, library grids, processing pipeline control dashboards, and a custom media player supporting resolution switching without interrupting playback.
2. **Backend API (Express & Prisma)**: Dispatches tasks to Redis, accepts video uploads, manages metadata in MongoDB, and streams real-time status details via Server-Sent Events (SSE).
3. **Message Broker (Redis & BullMQ)**: Provides job queues, exponential backoff retries, concurrency constraints, and thread safety.
4. **Processing Worker (FFmpeg)**: Background consumer running on Node.js. Probes media, schedules FFmpeg commands, adds watermarks, extracts MP3 audio channels, snaps preview frames, and updates Redis with progress updates.
5. **Storage Adaptor (Local/S3)**: Abstract service providing plug-and-play adaptability. Allows storing data in Docker volumes during development and switching to AWS S3 in production.

---

## Directory Structure

```
d:\VIDEO PROCESSING SYSTEM\
├── backend/                  # API server code (Express, TypeScript, Prisma)
│   ├── prisma/               # Database schemas
│   ├── src/
│   │   ├── config/           # DB, Storage adapters, Queue connections
│   │   ├── routes/           # REST endpoints
│   │   └── server.ts         # App initialization
│   └── Dockerfile
├── worker/                   # Processing worker code (BullMQ, FFmpeg)
│   ├── prisma/               # Database client schema
│   ├── src/
│   │   ├── config/           # DB and Storage adapters
│   │   ├── processor.ts      # FFmpeg command builder and progress reporter
│   │   └── index.ts          # BullMQ queue runner loop
│   └── Dockerfile
├── frontend/                 # Frontend dashboard (React, Vite, Vanilla CSS)
│   ├── src/
│   │   ├── components/       # Custom Video Player Modal
│   │   ├── App.jsx           # Main Dashboard
│   │   ├── index.css         # Theme stylesheet
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── Dockerfile
└── docker-compose.yml        # Multi-service setup config
```

---

## Local Setup & Running

### Requirements
- **Docker** and **Docker Compose** installed on your system.

### Quick Start
To spin up the entire cluster (MongoDB, Redis, API, Worker, Frontend) with a single command, run this at the project root:

```bash
docker-compose up --build
```

The services will initialize:
* **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
* **Backend API Server**: [http://localhost:5000](http://localhost:5000)
* **MongoDB**: `localhost:27017`
* **Redis**: `localhost:6379`

### Shared Volume
By default, the storage adapter is set to `local`. All uploads and processed files will be written to a shared Docker volume mapped inside `/app/uploads` in both the backend and worker containers. This maps to the Docker volume `shared_uploads` on your machine.

---

## Production AWS S3 Deployment Configuration

To deploy this system to the cloud using AWS S3 for storage:

1. Update the environment variables in your container setups:
   ```env
   STORAGE_TYPE=s3
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-production-bucket-name
   AWS_ACCESS_KEY_ID=your-aws-access-key-id
   AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
   ```
2. The `StorageService` factory will automatically switch to the AWS S3 Client SDK. Original uploads and processed assets (resolutions, thumbnails, audio) will be stored in S3 and served using standard public URLs.

---

## Backend API Documentation

### Videos API

#### 1. Upload Original Video
* **Endpoint**: `POST /api/videos/upload`
* **Body (Multipart/Form-Data)**:
  * `video`: Binary File (max 500MB)
  * `title`: String (Optional, defaults to filename)
  * `description`: String (Optional)
* **Response**: Returns the created `Video` metadata object (status `UPLOADED`).

#### 2. Get Video Library
* **Endpoint**: `GET /api/videos`
* **Response**: Returns a JSON array containing all uploaded videos and their associated processed assets, sorted by newest first.

#### 3. Get Video Detail
* **Endpoint**: `GET /api/videos/:id`
* **Response**: Returns detailed metadata for a single video. If the video is still processing, includes the live BullMQ progress percentage.

#### 4. Submit Transcoding Job
* **Endpoint**: `POST /api/videos/:id/process`
* **Headers**: `Content-Type: application/json`
* **Body**:
  ```json
  {
    "resolutions": ["1080p", "720p", "480p"],
    "formats": ["mp4", "webm"],
    "watermarkText": "CONFIDENTIAL",
    "extractAudio": true,
    "thumbnailsCount": 3
  }
  ```
* **Response**: Returns confirmation message with status `QUEUED`.

#### 5. Real-Time Progress Stream (SSE)
* **Endpoint**: `GET /api/videos/:id/progress-stream`
* **Format**: Server-Sent Events (stream)
* **Output**: Periodically streams `{ status, progress, error, assets }` JSON updates every 1 second. Connection is automatically closed once status updates to `COMPLETED` or `FAILED`.

#### 6. Delete Video and Assets
* **Endpoint**: `DELETE /api/videos/:id`
* **Response**: Cancels any active queue items, deletes files from local/S3 storage, removes DB record, and returns confirmation.
