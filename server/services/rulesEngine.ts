import { GameId, ProposedEvent, Match, LeaderboardEntry, Tournament } from '../../src/types';
import { GAMES_CONFIG } from '../../src/config/games';
import { db } from '../storage';

export class RulesEngine {
  /**
   * Calculate updated match scores based strictly on confirmed events.
   * Deterministic: only events with reviewStatus === 'confirmed' contribute points.
   * Deduplicates by event id.
   */
  public static calculateMatchScores(
    match: Match,
    events: ProposedEvent[]
  ): { scores: Record<string, number>; confirmedCount: number } {
    const scores: Record<string, number> = {
      [match.teamA.id]: 0,
      [match.teamB.id]: 0
    };

    const gameConfig = db.getGame(match.gameId) || GAMES_CONFIG[match.gameId];
    const seenEventIds = new Set<string>();

    for (const event of events) {
      // Must match this match and be confirmed
      if (event.matchId !== match.id) continue;
      if (event.reviewStatus !== 'confirmed') continue;
      if (seenEventIds.has(event.id)) continue; // prevent double counting

      seenEventIds.add(event.id);

      // Determine points for this event
      let points = event.pointsAwarded;
      if (points === undefined || points === null) {
        const rule = gameConfig?.scoringRules.find(r => r.eventType === event.eventType);
        points = rule ? rule.points : 1;
      }

      if (event.teamId && scores[event.teamId] !== undefined) {
        scores[event.teamId] += points;
      }
    }

    return {
      scores,
      confirmedCount: seenEventIds.size
    };
  }

  /**
   * Compute tournament leaderboard from all finalized matches in the tournament
   */
  public static calculateLeaderboard(tournament: Tournament, matches: Match[]): LeaderboardEntry[] {
    const table: Record<string, LeaderboardEntry> = {};

    // Initialize all teams
    for (const team of tournament.teams) {
      table[team.id] = {
        teamId: team.id,
        teamName: team.name,
        color: team.color || '#D4AF37',
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointsDifference: 0,
        tournamentPoints: 0
      };
    }

    const tournamentMatches = matches.filter(
      m => m.tournamentId === tournament.id && m.status === 'completed'
    );

    for (const match of tournamentMatches) {
      const teamAId = match.teamA.id;
      const teamBId = match.teamB.id;

      if (!table[teamAId] || !table[teamBId]) continue;

      const scoreA = match.scores[teamAId] || 0;
      const scoreB = match.scores[teamBId] || 0;

      table[teamAId].played += 1;
      table[teamBId].played += 1;

      table[teamAId].pointsFor += scoreA;
      table[teamAId].pointsAgainst += scoreB;
      table[teamBId].pointsFor += scoreB;
      table[teamBId].pointsAgainst += scoreA;

      if (scoreA > scoreB) {
        table[teamAId].won += 1;
        table[teamAId].tournamentPoints += 3;
        table[teamBId].lost += 1;
      } else if (scoreB > scoreA) {
        table[teamBId].won += 1;
        table[teamBId].tournamentPoints += 3;
        table[teamAId].lost += 1;
      } else {
        table[teamAId].drawn += 1;
        table[teamAId].tournamentPoints += 1;
        table[teamBId].drawn += 1;
        table[teamBId].tournamentPoints += 1;
      }
    }

    // Calculate goal/points difference & sort
    const entries = Object.values(table).map(entry => ({
      ...entry,
      pointsDifference: entry.pointsFor - entry.pointsAgainst
    }));

    // Sorting: Most tournament points, then highest pointsDifference, then most pointsFor
    entries.sort((a, b) => {
      if (b.tournamentPoints !== a.tournamentPoints) {
        return b.tournamentPoints - a.tournamentPoints;
      }
      if (b.pointsDifference !== a.pointsDifference) {
        return b.pointsDifference - a.pointsDifference;
      }
      return b.pointsFor - a.pointsFor;
    });

    return entries;
  }
}
