import { Router, Request, Response } from 'express';
import { db } from '../storage';
import { RulesEngine } from '../services/rulesEngine';
import { Match, MatchResult, ProposedEvent } from '../../src/types';
import { GAMES_CONFIG } from '../../src/config/games';

export const matchRouter = Router();

// List matches (optionally filter by tournament)
matchRouter.get('/', (req: Request, res: Response) => {
  const { tournamentId } = req.query;
  const matches = db.getMatches(tournamentId as string | undefined);
  res.json({ success: true, data: matches });
});

// Create new match
matchRouter.post('/', (req: Request, res: Response) => {
  const { tournamentId, gameId, teamA, teamB } = req.body;

  const gameDef = db.getGame(gameId) || GAMES_CONFIG[gameId as keyof typeof GAMES_CONFIG];
  if (!gameId || !gameDef) {
    return res.status(400).json({ success: false, error: 'Valid gameId is required' });
  }

  if (!teamA || !teamB || !teamA.name || !teamB.name) {
    return res.status(400).json({ success: false, error: 'Both participating teams must be specified' });
  }

  const tournament = tournamentId ? db.getTournament(tournamentId) : undefined;

  const matchId = `match-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const teamAId = teamA.id || `team-${Date.now()}-A`;
  const teamBId = teamB.id || `team-${Date.now()}-B`;

  const newMatch: Match = {
    id: matchId,
    tournamentId: tournament?.id,
    tournamentName: tournament?.name,
    gameId,
    teamA: {
      ...teamA,
      id: teamAId
    },
    teamB: {
      ...teamB,
      id: teamBId
    },
    scores: {
      [teamAId]: 0,
      [teamBId]: 0
    },
    status: 'scheduled',
    createdAt: new Date().toISOString()
  };

  db.saveMatch(newMatch);
  res.status(201).json({ success: true, data: newMatch });
});

// Get single match with its events and analysis status
matchRouter.get('/:matchId', (req: Request, res: Response) => {
  const match = db.getMatch(req.params.matchId);
  if (!match) {
    return res.status(404).json({ success: false, error: 'Match not found' });
  }

  const events = db.getEvents(match.id);
  const analysisJob = match.analysisJobId ? db.getAnalysisJob(match.analysisJobId) : undefined;

  res.json({
    success: true,
    data: {
      ...match,
      events,
      analysisJob
    }
  });
});

// Finalize a match result after event review
matchRouter.post('/:matchId/finalize', (req: Request, res: Response) => {
  const match = db.getMatch(req.params.matchId);
  if (!match) {
    return res.status(404).json({ success: false, error: 'Match not found' });
  }

  const { hostNotes, durationSeconds } = req.body;
  const events = db.getEvents(match.id);

  // Recalculate deterministic scores using confirmed events only
  const { scores } = RulesEngine.calculateMatchScores(match, events);
  match.scores = scores;
  match.status = 'completed';
  match.completedAt = new Date().toISOString();
  if (durationSeconds) {
    match.durationSeconds = durationSeconds;
  }
  if (hostNotes) {
    match.hostNotes = hostNotes;
  }

  db.saveMatch(match);

  // Mark analysis job completed if attached
  if (match.analysisJobId) {
    const job = db.getAnalysisJob(match.analysisJobId);
    if (job) {
      job.status = 'completed';
      job.completedAt = match.completedAt;
      db.saveAnalysisJob(job);
    }
  }

  const teamAScore = match.scores[match.teamA.id] || 0;
  const teamBScore = match.scores[match.teamB.id] || 0;

  let winnerId: string | 'draw' = 'draw';
  if (teamAScore > teamBScore) {
    winnerId = match.teamA.id;
  } else if (teamBScore > teamAScore) {
    winnerId = match.teamB.id;
  }

  const confirmedEvents = events.filter(e => e.reviewStatus === 'confirmed');

  const result: MatchResult = {
    matchId: match.id,
    gameId: match.gameId,
    tournamentId: match.tournamentId,
    teamA: {
      id: match.teamA.id,
      name: match.teamA.name,
      color: match.teamA.color,
      score: teamAScore
    },
    teamB: {
      id: match.teamB.id,
      name: match.teamB.name,
      color: match.teamB.color,
      score: teamBScore
    },
    winnerId,
    confirmedEvents,
    durationSeconds: match.durationSeconds,
    completedAt: match.completedAt,
    hostNotes: match.hostNotes
  };

  res.json({
    success: true,
    data: {
      match,
      result
    }
  });
});

// Host manually adds an event that AI missed or host wants to award
matchRouter.post('/:matchId/host-event', (req: Request, res: Response) => {
  const match = db.getMatch(req.params.matchId);
  if (!match) {
    return res.status(404).json({ success: false, error: 'Match not found' });
  }

  const { 
    eventType, 
    eventLabel, 
    teamId, 
    timestampSeconds, 
    pointsAwarded, 
    notes,
    judgeRuling,
    ruleCited,
    aiJudgePersona,
    source = 'manually_corrected',
    reviewStatus = 'confirmed'
  } = req.body;

  if (!eventType || !teamId) {
    return res.status(400).json({ success: false, error: 'eventType and teamId are required' });
  }

  const team = teamId === match.teamA.id ? match.teamA : match.teamB;

  const newEvent: ProposedEvent = {
    id: `evt-host-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    matchId: match.id,
    gameId: match.gameId,
    eventType,
    eventLabel: eventLabel || eventType,
    teamId,
    teamName: team.name,
    timestampSeconds: Number(timestampSeconds) || 0,
    confidence: req.body.confidence !== undefined ? Number(req.body.confidence) : 1.0,
    reviewStatus: reviewStatus as any,
    source: source as any,
    pointsAwarded: Number(pointsAwarded) || 1,
    notes: notes || 'Host manually logged event during tournament judging.',
    judgeRuling,
    ruleCited,
    aiJudgePersona,
    createdAt: new Date().toISOString()
  };

  db.saveEvent(newEvent);

  // Recalculate match scores deterministically
  const allEvents = db.getEvents(match.id);
  const { scores } = RulesEngine.calculateMatchScores(match, allEvents);
  match.scores = scores;
  match.hostAdjustmentsMade = true;
  db.saveMatch(match);

  res.status(201).json({ success: true, data: newEvent, updatedScores: match.scores });
});

// Host manual score override
matchRouter.post('/:matchId/host-correction', (req: Request, res: Response) => {
  const match = db.getMatch(req.params.matchId);
  if (!match) {
    return res.status(404).json({ success: false, error: 'Match not found' });
  }

  const { teamAScore, teamBScore, hostNotes } = req.body;

  if (typeof teamAScore === 'number') {
    match.scores[match.teamA.id] = teamAScore;
  }
  if (typeof teamBScore === 'number') {
    match.scores[match.teamB.id] = teamBScore;
  }

  match.hostAdjustmentsMade = true;
  if (hostNotes) {
    match.hostNotes = (match.hostNotes ? match.hostNotes + ' | ' : '') + `[Host correction: ${hostNotes}]`;
  }

  db.saveMatch(match);
  res.json({ success: true, data: match });
});
