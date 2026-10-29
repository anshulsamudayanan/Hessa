import { Router, Request, Response } from 'express';
import { db } from '../storage';
import { RulesEngine } from '../services/rulesEngine';

export const eventRouter = Router();

// POST /api/events/:eventId/review - Confirm or reject a proposed event
eventRouter.post('/:eventId/review', (req: Request, res: Response) => {
  const { eventId } = req.params;
  const { status, hostNotes, pointsAwarded } = req.body;

  if (status !== 'confirmed' && status !== 'rejected' && status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: 'Status must be one of: confirmed, rejected, pending'
    });
  }

  const event = db.getEvent(eventId);
  if (!event) {
    return res.status(404).json({ success: false, error: 'Event not found' });
  }

  const match = db.getMatch(event.matchId);
  if (!match) {
    return res.status(404).json({ success: false, error: 'Match for event not found' });
  }

  // Update event status
  event.reviewStatus = status;
  event.source = 'host_confirmed';
  if (hostNotes) {
    event.notes = hostNotes;
  }
  if (typeof pointsAwarded === 'number') {
    event.pointsAwarded = pointsAwarded;
  }

  db.saveEvent(event);

  // Recalculate deterministic match score
  const matchEvents = db.getEvents(match.id);
  const { scores, confirmedCount } = RulesEngine.calculateMatchScores(match, matchEvents);
  match.scores = scores;
  db.saveMatch(match);

  res.json({
    success: true,
    data: {
      event,
      matchScores: match.scores,
      confirmedCount
    }
  });
});

// PUT /api/events/:eventId - Update event details
eventRouter.put('/:eventId', (req: Request, res: Response) => {
  const { eventId } = req.params;
  const event = db.getEvent(eventId);
  if (!event) {
    return res.status(404).json({ success: false, error: 'Event not found' });
  }

  const { pointsAwarded, notes, eventLabel, teamId } = req.body;
  if (typeof pointsAwarded === 'number') event.pointsAwarded = pointsAwarded;
  if (notes !== undefined) event.notes = notes;
  if (eventLabel) event.eventLabel = eventLabel;
  if (teamId) event.teamId = teamId;

  db.saveEvent(event);

  // Recalculate match score
  const match = db.getMatch(event.matchId);
  if (match) {
    const matchEvents = db.getEvents(match.id);
    const { scores } = RulesEngine.calculateMatchScores(match, matchEvents);
    match.scores = scores;
    db.saveMatch(match);
  }

  res.json({ success: true, data: event });
});
