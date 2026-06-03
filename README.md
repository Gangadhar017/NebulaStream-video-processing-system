# 🌌 AetherFlow — Cloud Video Transcoding Matrix

[![Node.js](https://img.shields.io/badge/Node.js-v18.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v18.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-Client-121214?logo=prisma&logoColor=white)](https://prisma.io)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![AWS](https://img.shields.io/badge/AWS-ECS_Fargate_/_S3-232F3E?logo=amazon-aws&logoColor=white)](https://aws.amazon.com)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-Engine-007800?logo=ffmpeg&logoColor=white)](https://ffmpeg.org)

A production-grade, containerized, cloud-scale **Video Processing & Transcoding System** designed with an ultra-premium Obsidian Glassmorphic dashboard. AetherFlow features direct webcam/microphone recording, remote stream URL ingestion (HLS / HTTP direct link), custom text watermarking, audio track extraction, and dynamic thumbnail generation. 

---

## 📐 System Architecture

```
                                  +------------------------------------+
                                  |     Next-Gen React SPA Client      |
                                  |     (Obsidian Glassmorphism UI)    |
                                  +---+--------------+--------------+--+
                                      ^              ^              ^
                       Drag-Drop File |   Live WebM  |  Stream URL  | HTTP / SSE
                             Uploads  |   Recording  |  Ingestion   | Progress
                                      v              v              v
                                  +---+--------------+--------------+--+
                                  |        Express Backend API         |
                                  +---+--------------+--------------+--+
                                      |              |              |
                        Prisma Client |              |              | Dispatch BullMQ Job
                                      v              |              v
                        +-------------+----+         |      +-------+----------+
                        |  MongoDB Atlas   |         |      |  ElastiCache /   |
                        |   (Data Store)   |         |      |  Redis Cluster   |
                        +------------------+         |      +------------------+
                                                     |               ^
                                                     |               | Pop Task
                                              Serve  |  Upload       v
                                             Assets  |  Outputs +----+-------------+
                                                     v          |                  |
                                         +-----------+-------+  |   FFmpeg Job     |
                                         |    AWS S3 Bucket  |<=+   Fargate Worker |
                                         |  (Cloud Storage)  |  |                  |
                                         +-------------------+  +------------------+
```

1. **Dashboard Client (React + Vite)**: Powered by a dark obsidian glassmorphism design system. Integrates tabbed navigation for a **Video Library**, a live **Webcam Recording Studio**, and a **Stream Import Deck**. Uses a custom media player that preserves playback timestamps during resolution switches.
2. **Backend API (Express & Prisma)**: Ingests multipart video files, coordinates remote stream URLs, updates database structures, and handles streaming real-time queue metrics via Server-Sent Events (SSE).
3. **Queue Broker (Redis & BullMQ)**: Manages concurrent background tasks, prevents system overload, and provides reliable worker scheduling with exponential backoff retry algorithms.
4. **FFmpeg Job Worker**: A multi-threaded background service. Ingests local files or streams remote HLS `.m3u8` playlists directly from the network, encodes multiple resolutions/containers, embeds text watermarks, isolates audio tracks, generates snapshot thumbnails, and pipes transcoded assets to AWS S3.

---

## ⚡ Core Features

### 🌌 Next-Gen Obsidian UI Overhaul
- Bespoke obsidian black color palette (`#030712`) with glowing ambient highlights (radial neon gradients).
- Blended glassmorphism cards (`rgba(17, 24, 39, 0.45)`) featuring high-contrast borders and intense backdrop filters (`blur(20px)`).
- Collapsible sidebar menu navigation with active glow states and live processing badges.

### 🎥 Webcam Recording Studio
- Real-time enumeration of connected cameras and microphones directly in the browser.
- Audio/video capturing via browser `MediaRecorder` API (VP9/VP8 WebM codecs).
- Studio overlays including flashing `REC` indicators, monospaced countdown timers, and recording feedback loop.
- Local playback review player, custom metadata forms (title/description), and automated multi-part upload pipeline.

### 🔗 Stream URL Ingest & Transcoding
- Supports public HTTP files (`.mp4`, `.webm`) and Apple HTTP Live Streaming (`.m3u8`) playlists.
- Ingestion checks MIME types (`application/x-mpegURL` for streams) and bypasses storage overhead.
- Background worker feeds remote stream URLs straight into FFmpeg inputs, decoding from network packets.
- Graceful metadata fallbacks for live feeds without predefined durations, skipping thumbnail extraction.

---

## 📁 Directory Structure

```
d:\VIDEO PROCESSING SYSTEM\
├── backend/                  # REST API Server (Express + TypeScript + Prisma)
│   ├── prisma/               # Database client schemas
│   ├── src/
│   │   ├── config/           # DB, Storage drivers, Redis connections
│   │   ├── routes/           # Video endpoints & SSE stream handlers
│   │   └── server.ts         # Server bootstrapping
│   └── Dockerfile
├── worker/                   # Processing Worker (BullMQ + FFmpeg)
│   ├── prisma/               # Worker database models
│   ├── src/
│   │   ├── config/           # DB & S3 configurations
│   │   ├── processor.ts      # Stream detector, FFmpeg wrapper, thumbnailer
│   │   └── index.ts          # BullMQ queue listener
│   └── Dockerfile
├── frontend/                 # Client SPA Dashboard (React + Vite + Vanilla CSS)
│   ├── src/
│   │   ├── components/       # Custom player with resolution selectors
│   │   ├── App.jsx           # Sidebar layout, webcam booth & stream import
│   │   ├── index.css         # Glassmorphic Obsidian design tokens
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── Dockerfile
└── docker-compose.yml        # Multi-service local setup orchestration
```

---

## ⚙️ Local Setup & Orchestration

### Prerequisites
- **Docker** and **Docker Compose** installed.
- Camera and microphone access permissions (if testing local Webcam Recorder).

### Build and Launch
Build the Docker environment and spin up all local services (MongoDB, Redis, API, Worker, Client) with one command from the project root:

```bash
docker-compose up --build
```

- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:5000](http://localhost:5000)
- **Local MongoDB**: `localhost:27017`
- **Local Redis**: `localhost:6379`

> [!NOTE]
> In local development mode (`STORAGE_TYPE=local`), a shared volume `shared_uploads` is mounted at `/app/uploads` across backend and worker containers to simulate cloud storage blocks locally.

---

## 🚀 AWS Fargate Cloud Production Setup

To deploy the API and Worker containers to AWS ECS Fargate and leverage AWS S3 for storage, configure the following variables in your `.env.production` file:

```env
# Database & Broker
DATABASE_URL="mongodb+srv://<user>:<password>@cluster0.mongodb.net/aetherflow"
REDIS_URL="rediss://<elasticache-redis-tls-endpoint>:6379"

# Storage Configuration
STORAGE_TYPE="s3"
AWS_REGION="eu-north-1"
AWS_S3_BUCKET="aetherflow-assets"
AWS_ACCESS_KEY_ID="AKIAxxxxxxxxxxxx"
AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
```

> [!IMPORTANT]
> - **ElastiCache Transit Encryption**: Secure Redis connections on AWS require `rediss://` protocol configurations to prevent socket timeouts.
> - **ECR Workflows**: Pipeline repository creators use `aws ecr create-repository --repository-name $ECR_REPOSITORY || true` checks to prevent rolling workflow crashes.

---

## 🔌 API Reference Document

### Videos Ingestion

#### 1. Direct Multipart Video Upload
- **Endpoint**: `POST /api/videos/upload`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `video` (file binary): The video asset (max 500MB).
  - `title` (string): Optional title.
  - `description` (string): Optional description.
- **Response** (Status `201 Created`):
  ```json
  {
    "id": "603dcae32c81d31a54b9d09a",
    "title": "AetherFlow Introduction",
    "description": "Cloud system demo",
    "originalName": "intro.mp4",
    "mimeType": "video/mp4",
    "size": 12459023,
    "duration": null,
    "originalPath": "originals/1709483829102-intro.mp4",
    "streamUrl": null,
    "status": "UPLOADED",
    "progress": 0
  }
  ```

#### 2. Import Remote HLS/HTTP Stream
- **Endpoint**: `POST /api/videos/import-url`
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "title": "Bigger Blazes Network Stream",
    "description": "Public sample HTTP stream"
  }
  ```
- **Response** (Status `201 Created`):
  ```json
  {
    "id": "603dcae32c81d31a54b9d09b",
    "title": "Bigger Blazes Network Stream",
    "description": "Public sample HTTP stream",
    "originalName": "Network Stream",
    "mimeType": "video/mp4",
    "size": 0,
    "duration": null,
    "originalPath": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "streamUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "status": "UPLOADED",
    "progress": 0
  }
  ```

---

### Job Orchestration

#### 3. Submit Transcoding Job
- **Endpoint**: `POST /api/videos/:id/process`
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "resolutions": ["1080p", "720p", "480p"],
    "formats": ["mp4", "webm"],
    "watermarkText": "AETHERFLOW INTERNAL",
    "extractAudio": true,
    "thumbnailsCount": 3
  }
  ```
- **Response** (Status `200 OK`):
  ```json
  {
    "message": "Video added to processing queue",
    "status": "QUEUED"
  }
  ```

#### 4. Real-Time SSE Progress Stream
- **Endpoint**: `GET /api/videos/:id/progress-stream`
- **Content-Type**: `text/event-stream`
- **Response**: Streams SSE messages every 1 second updating the transcoding state:
  ```json
  {
    "status": "PROCESSING",
    "progress": 42,
    "error": null,
    "assets": []
  }
  ```
  *Streams close automatically upon transition to `COMPLETED` or `FAILED`.*

#### 5. Get Video Library
- **Endpoint**: `GET /api/videos`
- **Response** (Status `200 OK`): Returns JSON array of all video metadata objects along with their mapped output resolution asset keys.

#### 6. Delete Video and Assets
- **Endpoint**: `DELETE /api/videos/:id`
- **Response** (Status `200 OK`): Cancels active jobs in Redis, purges all stored S3 artifacts (resolutions, audio, thumbnails) and deletes references in MongoDB.
