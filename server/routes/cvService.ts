import { Router, Request, Response } from 'express';
import { db } from '../storage';
import { ProposedEvent } from '../../src/types';
import { GAMES_CONFIG } from '../../src/config/games';

export const cvServiceRouter = Router();

// GET /api/cv-service/status - Check external Python CV service connection
cvServiceRouter.get('/status', async (req: Request, res: Response) => {
  const config = db.getCvServiceConfig();
  let reachable = false;
  let serviceInfo: any = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const response = await fetch(`${config.externalServiceUrl}/health`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (response.ok) {
      reachable = true;
      serviceInfo = await response.json();
    }
  } catch {
    reachable = false;
  }

  db.updateCvServiceConfig({ isConnected: reachable, lastPing: new Date().toISOString() });

  res.json({
    success: true,
    data: {
      url: config.externalServiceUrl,
      isConnected: reachable,
      lastPing: new Date().toISOString(),
      serviceInfo,
      supportedDetectors: [
        { gameId: 'football', module: 'detectors/football.py', status: 'ready', description: 'Goalpost detection & ball trajectory crossing' },
        { gameId: 'al_teela', module: 'detectors/al_teela.py', status: 'ready', description: 'Overhead circular ring & marble displacement tracking' },
        { gameId: 'al_dama', module: 'detectors/al_dama.py', status: 'ready', description: '64-grid square warp, piece coordinate state & jump capture' },
        { gameId: 'al_laqaf', module: 'detectors/al_laqaf.py', status: 'ready', description: 'Hand gesture estimation & 5-pebble parabolic tracking' },
        { gameId: 'qif', module: 'detectors/qif.py', status: 'ready', description: 'Pose estimation, velocity freeze validation & tag proximity' }
      ]
    }
  });
});

// POST /api/cv-service/config - Update external CV service endpoint
cvServiceRouter.post('/config', (req: Request, res: Response) => {
  const { externalServiceUrl } = req.body;
  if (!externalServiceUrl || typeof externalServiceUrl !== 'string') {
    return res.status(400).json({ success: false, error: 'Valid URL is required' });
  }

  const updated = db.updateCvServiceConfig({ externalServiceUrl: externalServiceUrl.trim() });
  res.json({ success: true, data: updated });
});

// POST /api/cv-service/webhook - Ingest genuine CV detections from Python service
cvServiceRouter.post('/webhook', (req: Request, res: Response) => {
  const { match_id, game, events } = req.body;

  if (!match_id || !Array.isArray(events)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid webhook payload. Expected match_id and events array.'
    });
  }

  const match = db.getMatch(match_id);
  if (!match) {
    return res.status(404).json({ success: false, error: 'Match not found for webhook' });
  }

  const gameConfig = GAMES_CONFIG[match.gameId];
  const convertedEvents: ProposedEvent[] = [];

  for (const raw of events) {
    // Validate required fields from vision contract
    if (!raw.event_type || typeof raw.timestamp_seconds !== 'number') {
      continue;
    }

    const teamId = raw.team_id || match.teamA.id;
    const teamName = teamId === match.teamA.id ? match.teamA.name : match.teamB.name;
    const rule = gameConfig?.scoringRules.find(r => r.eventType === raw.event_type);

    const event: ProposedEvent = {
      id: raw.event_id || `evt-cv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      matchId: match.id,
      gameId: match.gameId,
      eventType: raw.event_type,
      eventLabel: rule ? rule.label : raw.event_type,
      teamId,
      teamName,
      timestampSeconds: raw.timestamp_seconds,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : undefined,
      reviewStatus: 'pending',
      source: 'ai_proposed',
      evidenceFrameUrl: raw.evidence_frame_url,
      notes: raw.metadata?.notes || 'Detected by external Python OpenCV model.',
      pointsAwarded: rule ? rule.points : 1,
      createdAt: new Date().toISOString()
    };

    convertedEvents.push(event);
  }

  db.saveEvents(convertedEvents);

  // Update match and analysis job
  if (match.analysisJobId) {
    const job = db.getAnalysisJob(match.analysisJobId);
    if (job) {
      job.status = 'review_required';
      job.cvServiceConnected = true;
      job.cvServiceMode = 'python_external';
      job.eventsProposedCount = convertedEvents.length;
      job.progressPercent = 100;
      job.statusMessage = `Received ${convertedEvents.length} genuine events from Python vision detector.`;
      db.saveAnalysisJob(job);
    }
  }

  match.status = 'reviewing';
  db.saveMatch(match);

  res.json({
    success: true,
    message: `Ingested ${convertedEvents.length} detected events from external vision service`,
    eventsCount: convertedEvents.length
  });
});
