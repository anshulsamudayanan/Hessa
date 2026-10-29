import { Router, Request, Response } from 'express';
import { db } from '../storage';
import { RulesEngine } from '../services/rulesEngine';
import { Tournament } from '../../src/types';

export const tournamentRouter = Router();

// List all tournaments
tournamentRouter.get('/', (req: Request, res: Response) => {
  const tournaments = db.getTournaments();
  res.json({ success: true, data: tournaments });
});

// Create tournament
tournamentRouter.post('/', (req: Request, res: Response) => {
  const { name, format, games, teams } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Tournament name is required' });
  }

  if (!Array.isArray(teams) || teams.length < 2) {
    return res.status(400).json({ success: false, error: 'A tournament must have at least 2 teams' });
  }

  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    if (!t.name || t.name.trim().length === 0) {
      return res.status(400).json({ success: false, error: `Team ${i + 1} must have a valid name` });
    }
  }

  if (!Array.isArray(games) || games.length === 0) {
    return res.status(400).json({ success: false, error: 'Select at least one game to include' });
  }

  const newTournament: Tournament = {
    id: `tourn-${Date.now()}`,
    name: name.trim(),
    format: format || 'family_cup',
    games,
    teams: teams.map((t, idx) => ({
      id: t.id || `team-${Date.now()}-${idx}`,
      name: t.name.trim(),
      arabicName: t.arabicName?.trim() || undefined,
      color: t.color || (idx === 0 ? '#D4AF37' : idx === 1 ? '#3B82F6' : '#10B981'),
      players: Array.isArray(t.players) ? t.players.map((p: any, pIdx: number) => ({
        id: p.id || `p-${Date.now()}-${idx}-${pIdx}`,
        name: p.name?.trim() || `Player ${pIdx + 1}`,
        number: p.number ? Number(p.number) : undefined
      })) : []
    })),
    createdAt: new Date().toISOString(),
    status: 'active',
    matchesCount: 0
  };

  db.saveTournament(newTournament);
  res.status(201).json({ success: true, data: newTournament });
});

// Get single tournament
tournamentRouter.get('/:tournamentId', (req: Request, res: Response) => {
  const tournament = db.getTournament(req.params.tournamentId);
  if (!tournament) {
    return res.status(404).json({ success: false, error: 'Tournament not found' });
  }
  const matches = db.getMatches(tournament.id);
  res.json({ success: true, data: { ...tournament, matches } });
});

// Get tournament leaderboard
tournamentRouter.get('/:tournamentId/leaderboard', (req: Request, res: Response) => {
  const tournament = db.getTournament(req.params.tournamentId);
  if (!tournament) {
    return res.status(404).json({ success: false, error: 'Tournament not found' });
  }

  const matches = db.getMatches(tournament.id);
  const leaderboard = RulesEngine.calculateLeaderboard(tournament, matches);

  res.json({
    success: true,
    data: {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      leaderboard,
      completedMatches: matches.filter(m => m.status === 'completed').length
    }
  });
});

// Delete tournament
tournamentRouter.delete('/:tournamentId', (req: Request, res: Response) => {
  const success = db.deleteTournament(req.params.tournamentId);
  res.json({ success, message: 'Tournament deleted' });
});
