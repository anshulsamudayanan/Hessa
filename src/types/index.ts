/**
 * FAREEG AI - Core Domain Types
 */

export type GameId = string;

export interface ScoringRule {
  eventType: string;
  label: string;
  points: number;
  description: string;
}

export interface GameRuleConfig {
  id: GameId;
  name: string;
  arabicName: string;
  tagline: string;
  category: 'ball' | 'marbles' | 'board' | 'dexterity' | 'agility' | 'tag' | 'strategy' | 'tossing' | 'custom';
  description: string;
  culturalBackground: string;
  playersPerTeam: string;
  cameraSetupInstructions: string;
  recommendedAngle: string;
  rulesPlaceholderNote: string;
  scoringRules: ScoringRule[];
  potentialEvents: string[];
  
  // Extended cultural explorer & AI creator attributes
  country?: string;
  countryCode?: string;
  region?: 'gcc' | 'middle_east' | 'asia' | 'europe' | 'africa' | 'americas';
  flagEmoji?: string;
  coordinates?: { x: number; y: number }; // SVG map percentage coordinates
  culturalConnections?: string; // Sibling link to Emirati traditional games
  energyLevel?: 'mind' | 'dexterity' | 'athletic';
  suitableGroup?: 'pairs' | 'family' | 'party' | 'all';
  locationType?: 'indoor' | 'tabletop' | 'outdoor';
  equipmentNeeded?: string;
  durationMinutes?: number;
  isCustomCreated?: boolean;
  aiRefereePrompt?: string;
  aiDetectorGuidance?: string;
}

export interface Player {
  id: string;
  name: string;
  number?: number;
  avatar?: string;
}

export interface Team {
  id: string;
  name: string;
  arabicName?: string;
  color: string;
  players: Player[];
}

export type TournamentFormat = 'round_robin' | 'knockout' | 'family_cup';

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  games: GameId[];
  teams: Team[];
  createdAt: string;
  status: 'draft' | 'active' | 'completed';
  matchesCount: number;
}

export interface TeamScore {
  teamId: string;
  teamName: string;
  score: number;
}

export type MatchStatus = 'scheduled' | 'recording' | 'analyzing' | 'reviewing' | 'completed';

export interface Match {
  id: string;
  tournamentId?: string;
  tournamentName?: string;
  gameId: GameId;
  teamA: Team;
  teamB: Team;
  scores: Record<string, number>; // teamId -> score
  status: MatchStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  videoId?: string;
  videoUrl?: string;
  analysisJobId?: string;
  hostNotes?: string;
  hostAdjustmentsMade?: boolean;
  judgeStrictness?: 'family' | 'standard' | 'strict';
  judgePersona?: string;
}

export type ReviewStatus = 'pending' | 'confirmed' | 'rejected';

export type EventSource = 'ai_proposed' | 'host_confirmed' | 'manually_corrected';

export interface ProposedEvent {
  id: string;
  matchId: string;
  gameId: GameId;
  eventType: string;
  eventLabel: string;
  teamId: string;
  teamName: string;
  playerId?: string;
  playerName?: string;
  timestampSeconds: number;
  confidence?: number;
  reviewStatus: ReviewStatus;
  source: EventSource;
  evidenceFrameUrl?: string;
  notes?: string;
  pointsAwarded: number;
  judgeRuling?: string;
  ruleCited?: string;
  aiJudgePersona?: string;
  createdAt: string;
}

export interface UserMajlisProfile {
  familyClanName: string;
  emblemEmoji: string;
  emblemName: string;
  primaryColor: string;
  judgePersona: 'family' | 'standard' | 'strict';
  judgeName: string;
  defaultRoster: string[];
}

export type AnalysisJobStatus = 'queued' | 'processing' | 'review_required' | 'completed' | 'failed';

export interface AnalysisJob {
  id: string;
  matchId: string;
  videoAssetId: string;
  videoUrl: string;
  gameId: GameId;
  status: AnalysisJobStatus;
  progressPercent: number;
  statusMessage: string;
  cvServiceConnected: boolean;
  cvServiceMode: 'python_external' | 'disconnected_manual' | 'demo_inspection';
  eventsProposedCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export interface VideoAsset {
  id: string;
  matchId: string;
  filename: string;
  originalName: string;
  fileSizeBytes: number;
  mimeType: string;
  url: string;
  durationSeconds?: number;
  createdAt: string;
  consentConfirmed: boolean;
}

export interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  color: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDifference: number;
  tournamentPoints: number; // e.g. 3 for win, 1 for draw
}

export interface MatchResult {
  matchId: string;
  gameId: GameId;
  tournamentId?: string;
  teamA: {
    id: string;
    name: string;
    color: string;
    score: number;
  };
  teamB: {
    id: string;
    name: string;
    color: string;
    score: number;
  };
  winnerId: string | 'draw';
  confirmedEvents: ProposedEvent[];
  durationSeconds?: number;
  completedAt: string;
  hostNotes?: string;
}

export interface GenerateGameRequest {
  description: string;
  targetAudience?: string;
  equipment?: string;
  location?: 'indoor' | 'outdoor' | 'tabletop';
  culturalInspiration?: string;
}
