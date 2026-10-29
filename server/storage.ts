import fs from 'fs';
import path from 'path';
import {
  Tournament,
  Match,
  VideoAsset,
  AnalysisJob,
  ProposedEvent,
  GameRuleConfig
} from '../src/types';
import { BUILTIN_GAMES } from '../src/config/games';

interface DatabaseSchema {
  tournaments: Tournament[];
  matches: Match[];
  videoAssets: VideoAsset[];
  analysisJobs: AnalysisJob[];
  events: ProposedEvent[];
  customGames: GameRuleConfig[];
  cvServiceConfig: {
    externalServiceUrl: string;
    isConnected: boolean;
    lastPing?: string;
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'fareeg_state.json');

export class LocalStorage {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDirectory();
    this.data = this.loadData();
  }

  private ensureDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.customGames)) {
          parsed.customGames = [];
        }
        return parsed;
      }
    } catch (err) {
      console.error('Failed to read database file, seeding new state:', err);
    }
    const initial = this.getSeedData();
    this.saveData(initial);
    return initial;
  }

  private saveData(state: DatabaseSchema = this.data) {
    try {
      this.ensureDirectory();
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  private getSeedData(): DatabaseSchema {
    const seedTournament: Tournament = {
      id: 'tourn-al-wasl-2026',
      name: 'Al Wasl Heritage Family Championship',
      format: 'family_cup',
      games: ['football', 'al_teela', 'al_dama', 'al_laqaf', 'qif'],
      status: 'active',
      createdAt: new Date().toISOString(),
      matchesCount: 2,
      teams: [
        {
          id: 'team-falcons',
          name: 'Al Saqr Falcons',
          arabicName: 'صقور الفريج',
          color: '#D4AF37',
          players: [
            { id: 'p1', name: 'Rashid Al Nuaimi', number: 10 },
            { id: 'p2', name: 'Zayed Al Nuaimi', number: 7 },
            { id: 'p3', name: 'Mariam Al Nuaimi', number: 1 }
          ]
        },
        {
          id: 'team-knights',
          name: 'Desert Knights',
          arabicName: 'فرسان الصحراء',
          color: '#3B82F6',
          players: [
            { id: 'p4', name: 'Hamad Al Marri', number: 9 },
            { id: 'p5', name: 'Sultan Al Marri', number: 8 },
            { id: 'p6', name: 'Fatima Al Marri', number: 4 }
          ]
        },
        {
          id: 'team-pearls',
          name: 'Gulf Pearls',
          arabicName: 'لؤلؤ الخليج',
          color: '#10B981',
          players: [
            { id: 'p7', name: 'Salem Al Mansoori', number: 11 },
            { id: 'p8', name: 'Reem Al Mansoori', number: 5 }
          ]
        }
      ]
    };

    const seedMatch1: Match = {
      id: 'match-demo-001',
      tournamentId: seedTournament.id,
      tournamentName: seedTournament.name,
      gameId: 'al_teela',
      teamA: seedTournament.teams[0],
      teamB: seedTournament.teams[1],
      scores: {
        'team-falcons': 3,
        'team-knights': 1
      },
      status: 'completed',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date(Date.now() - 1800000).toISOString(),
      durationSeconds: 142,
      hostNotes: 'Exciting Al Teela round! Rashid scored two clean ring knockouts.',
      hostAdjustmentsMade: false
    };

    const seedEvents: ProposedEvent[] = [
      {
        id: 'evt-seed-1',
        matchId: 'match-demo-001',
        gameId: 'al_teela',
        eventType: 'marble_knockout',
        eventLabel: 'Marble Knockout',
        teamId: 'team-falcons',
        teamName: 'Al Saqr Falcons',
        playerName: 'Rashid Al Nuaimi',
        timestampSeconds: 24,
        confidence: 0.94,
        reviewStatus: 'confirmed',
        source: 'host_confirmed',
        pointsAwarded: 1,
        createdAt: new Date(Date.now() - 3500000).toISOString()
      },
      {
        id: 'evt-seed-2',
        matchId: 'match-demo-001',
        gameId: 'al_teela',
        eventType: 'target_hole_entry',
        eventLabel: 'Khoor (Center Hole Entry)',
        teamId: 'team-falcons',
        teamName: 'Al Saqr Falcons',
        playerName: 'Zayed Al Nuaimi',
        timestampSeconds: 68,
        confidence: 0.88,
        reviewStatus: 'confirmed',
        source: 'host_confirmed',
        pointsAwarded: 2,
        createdAt: new Date(Date.now() - 3200000).toISOString()
      },
      {
        id: 'evt-seed-3',
        matchId: 'match-demo-001',
        gameId: 'al_teela',
        eventType: 'marble_knockout',
        eventLabel: 'Marble Knockout',
        teamId: 'team-knights',
        teamName: 'Desert Knights',
        playerName: 'Hamad Al Marri',
        timestampSeconds: 112,
        confidence: 0.91,
        reviewStatus: 'confirmed',
        source: 'host_confirmed',
        pointsAwarded: 1,
        createdAt: new Date(Date.now() - 2500000).toISOString()
      }
    ];

    return {
      tournaments: [seedTournament],
      matches: [seedMatch1],
      videoAssets: [],
      analysisJobs: [],
      events: seedEvents,
      customGames: [],
      cvServiceConfig: {
        externalServiceUrl: 'http://localhost:8000',
        isConnected: false
      }
    };
  }

  // Games
  public getAllGames(): GameRuleConfig[] {
    const builtinList = Object.values(BUILTIN_GAMES);
    const customList = this.data.customGames || [];
    // merge by id
    const map = new Map<string, GameRuleConfig>();
    for (const g of builtinList) map.set(g.id, g);
    for (const g of customList) map.set(g.id, g);
    return Array.from(map.values());
  }

  public getGame(id: string): GameRuleConfig | undefined {
    return this.data.customGames?.find(g => g.id === id) || BUILTIN_GAMES[id];
  }

  public saveCustomGame(game: GameRuleConfig): GameRuleConfig {
    if (!this.data.customGames) this.data.customGames = [];
    const idx = this.data.customGames.findIndex(g => g.id === game.id);
    if (idx >= 0) {
      this.data.customGames[idx] = game;
    } else {
      this.data.customGames.push(game);
    }
    this.saveData();
    return game;
  }

  public deleteCustomGame(id: string): boolean {
    if (!this.data.customGames) return false;
    this.data.customGames = this.data.customGames.filter(g => g.id !== id);
    this.saveData();
    return true;
  }

  // Tournaments
  public getTournaments(): Tournament[] {
    return this.data.tournaments;
  }

  public getTournament(id: string): Tournament | undefined {
    return this.data.tournaments.find(t => t.id === id);
  }

  public saveTournament(tournament: Tournament): Tournament {
    const idx = this.data.tournaments.findIndex(t => t.id === tournament.id);
    if (idx >= 0) {
      this.data.tournaments[idx] = tournament;
    } else {
      this.data.tournaments.push(tournament);
    }
    this.saveData();
    return tournament;
  }

  public deleteTournament(id: string): boolean {
    this.data.tournaments = this.data.tournaments.filter(t => t.id !== id);
    this.data.matches = this.data.matches.filter(m => m.tournamentId !== id);
    this.saveData();
    return true;
  }

  // Matches
  public getMatches(tournamentId?: string): Match[] {
    if (tournamentId) {
      return this.data.matches.filter(m => m.tournamentId === tournamentId);
    }
    return this.data.matches;
  }

  public getMatch(id: string): Match | undefined {
    return this.data.matches.find(m => m.id === id);
  }

  public saveMatch(match: Match): Match {
    const idx = this.data.matches.findIndex(m => m.id === match.id);
    if (idx >= 0) {
      this.data.matches[idx] = match;
    } else {
      this.data.matches.push(match);
      if (match.tournamentId) {
        const tourn = this.getTournament(match.tournamentId);
        if (tourn) {
          tourn.matchesCount = (tourn.matchesCount || 0) + 1;
        }
      }
    }
    this.saveData();
    return match;
  }

  // Video Assets
  public saveVideoAsset(asset: VideoAsset): VideoAsset {
    const idx = this.data.videoAssets.findIndex(v => v.id === asset.id);
    if (idx >= 0) {
      this.data.videoAssets[idx] = asset;
    } else {
      this.data.videoAssets.push(asset);
    }
    this.saveData();
    return asset;
  }

  public getVideoAsset(id: string): VideoAsset | undefined {
    return this.data.videoAssets.find(v => v.id === id);
  }

  // Analysis Jobs
  public getAnalysisJob(id: string): AnalysisJob | undefined {
    return this.data.analysisJobs.find(j => j.id === id);
  }

  public saveAnalysisJob(job: AnalysisJob): AnalysisJob {
    const idx = this.data.analysisJobs.findIndex(j => j.id === job.id);
    if (idx >= 0) {
      this.data.analysisJobs[idx] = job;
    } else {
      this.data.analysisJobs.push(job);
    }
    this.saveData();
    return job;
  }

  public deleteAnalysisJob(id: string): boolean {
    const job = this.getAnalysisJob(id);
    if (job) {
      const asset = this.getVideoAsset(job.videoAssetId);
      if (asset && asset.filename) {
        const filePath = path.resolve(process.cwd(), 'uploads', asset.filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            console.error('Failed to remove video file:', e);
          }
        }
      }
    }
    this.data.analysisJobs = this.data.analysisJobs.filter(j => j.id !== id);
    this.data.events = this.data.events.filter(e => e.matchId !== job?.matchId);
    this.saveData();
    return true;
  }

  // Events
  public getEvents(matchId?: string): ProposedEvent[] {
    if (matchId) {
      return this.data.events.filter(e => e.matchId === matchId);
    }
    return this.data.events;
  }

  public getEvent(id: string): ProposedEvent | undefined {
    return this.data.events.find(e => e.id === id);
  }

  public saveEvent(event: ProposedEvent): ProposedEvent {
    const idx = this.data.events.findIndex(e => e.id === event.id);
    if (idx >= 0) {
      this.data.events[idx] = event;
    } else {
      this.data.events.push(event);
    }
    this.saveData();
    return event;
  }

  public saveEvents(events: ProposedEvent[]): void {
    for (const evt of events) {
      const idx = this.data.events.findIndex(e => e.id === evt.id);
      if (idx >= 0) {
        this.data.events[idx] = evt;
      } else {
        this.data.events.push(evt);
      }
    }
    this.saveData();
  }

  // CV Service Status
  public getCvServiceConfig() {
    return this.data.cvServiceConfig;
  }

  public updateCvServiceConfig(config: Partial<DatabaseSchema['cvServiceConfig']>) {
    this.data.cvServiceConfig = {
      ...this.data.cvServiceConfig,
      ...config
    };
    this.saveData();
    return this.data.cvServiceConfig;
  }
}

export const db = new LocalStorage();
