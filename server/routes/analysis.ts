import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../storage';
import { AnalysisQueueService } from '../services/analysisQueue';
import { VideoAsset, AnalysisJob, Match } from '../../src/types';

export const analysisRouter = Router();

// Configure safe storage for video uploads
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.webm';
    const safeName = `match_video_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'video/webm',
      'video/mp4',
      'video/quicktime',
      'video/x-matroska',
      'application/octet-stream' // sometimes webm blobs from browser send this
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp4|webm|mov|mkv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video format. Supported formats: MP4, WebM, QuickTime (.mov).'));
    }
  }
});

// POST /api/analysis - Submit video & create analysis job
analysisRouter.post('/', (req: Request, res: Response, next) => {
  upload.single('video')(req, res, err => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Video file exceeds maximum allowed size (100MB limit)'
        });
      }
      return res.status(400).json({ success: false, error: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    try {
      const { matchId, consentConfirmed, mode } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: 'No video file provided' });
      }

      if (!matchId) {
        return res.status(400).json({ success: false, error: 'matchId is required' });
      }

      const match = db.getMatch(matchId);
      if (!match) {
        return res.status(404).json({ success: false, error: 'Match not found' });
      }

      const videoAssetId = `vid-${Date.now()}`;
      const videoAsset: VideoAsset = {
        id: videoAssetId,
        matchId: match.id,
        filename: file.filename,
        originalName: file.originalname,
        fileSizeBytes: file.size,
        mimeType: file.mimetype,
        url: `/uploads/${file.filename}`,
        createdAt: new Date().toISOString(),
        consentConfirmed: consentConfirmed === 'true' || consentConfirmed === true
      };

      db.saveVideoAsset(videoAsset);

      const jobId = `job-${Date.now()}`;
      const isDemoMode = mode !== 'disconnected';

      const job: AnalysisJob = {
        id: jobId,
        matchId: match.id,
        videoAssetId: videoAsset.id,
        videoUrl: videoAsset.url,
        gameId: match.gameId,
        status: 'queued',
        progressPercent: 5,
        statusMessage: 'Video uploaded successfully. Queued for analysis...',
        cvServiceConnected: false,
        cvServiceMode: isDemoMode ? 'demo_inspection' : 'disconnected_manual',
        eventsProposedCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.saveAnalysisJob(job);

      // Attach to match
      match.videoId = videoAsset.id;
      match.videoUrl = videoAsset.url;
      match.analysisJobId = job.id;
      match.status = 'analyzing';
      db.saveMatch(match);

      // Kick off background analysis
      AnalysisQueueService.processJob(job.id, isDemoMode);

      res.status(202).json({
        success: true,
        data: {
          jobId: job.id,
          matchId: match.id,
          videoUrl: videoAsset.url,
          status: job.status,
          message: 'Video upload received. Analysis job queued.'
        }
      });
    } catch (e: any) {
      console.error('Error creating analysis job:', e);
      res.status(500).json({ success: false, error: 'Failed to initialize analysis job' });
    }
  });
});

// GET /api/analysis/:jobId - Retrieve job status and progress
analysisRouter.get('/:jobId', (req: Request, res: Response) => {
  const job = db.getAnalysisJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Analysis job not found' });
  }

  const match = db.getMatch(job.matchId);
  const cvConfig = db.getCvServiceConfig();

  res.json({
    success: true,
    data: {
      ...job,
      match,
      cvServiceConfig: cvConfig
    }
  });
});

// GET /api/analysis/:jobId/events - Retrieve proposed gameplay events
analysisRouter.get('/:jobId/events', (req: Request, res: Response) => {
  const job = db.getAnalysisJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Analysis job not found' });
  }

  const events = db.getEvents(job.matchId);
  res.json({
    success: true,
    data: {
      jobId: job.id,
      matchId: job.matchId,
      events,
      count: events.length
    }
  });
});

// DELETE /api/analysis/:jobId - Privacy cleanup of video & analysis data
analysisRouter.delete('/:jobId', (req: Request, res: Response) => {
  const job = db.getAnalysisJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  db.deleteAnalysisJob(job.id);
  res.json({ success: true, message: 'Video recording and analysis data permanently removed.' });
});
