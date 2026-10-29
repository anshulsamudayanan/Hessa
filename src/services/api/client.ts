import {
  Tournament,
  Match,
  AnalysisJob,
  ProposedEvent,
  LeaderboardEntry,
  MatchResult,
  GameId,
  GameRuleConfig,
  GenerateGameRequest
} from '../../types';

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : endpoint;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `HTTP request failed with status ${res.status}`);
    }

    return data.data !== undefined ? data.data : data;
  }

  // Games
  public async getGames(): Promise<GameRuleConfig[]> {
    return this.request<GameRuleConfig[]>('/api/games');
  }

  public async getGame(gameId: string): Promise<GameRuleConfig> {
    return this.request<GameRuleConfig>(`/api/games/${gameId}`);
  }

  public async generateAiGame(payload: GenerateGameRequest): Promise<GameRuleConfig> {
    return this.request<GameRuleConfig>('/api/games/generate-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  public async saveGame(game: Partial<GameRuleConfig>): Promise<GameRuleConfig> {
    return this.request<GameRuleConfig>('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(game)
    });
  }

  public async deleteGame(gameId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/games/${gameId}`, {
      method: 'DELETE'
    });
  }

  // Tournaments
  public async getTournaments(): Promise<Tournament[]> {
    return this.request<Tournament[]>('/api/tournaments');
  }

  public async getTournament(tournamentId: string): Promise<Tournament & { matches: Match[] }> {
    return this.request<Tournament & { matches: Match[] }>(`/api/tournaments/${tournamentId}`);
  }

  public async createTournament(payload: {
    name: string;
    format: string;
    games: GameId[];
    teams: { name: string; arabicName?: string; color: string; players: { name: string; number?: number }[] }[];
  }): Promise<Tournament> {
    return this.request<Tournament>('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  public async getLeaderboard(tournamentId: string): Promise<{
    tournamentId: string;
    tournamentName: string;
    leaderboard: LeaderboardEntry[];
    completedMatches: number;
  }> {
    return this.request<{
      tournamentId: string;
      tournamentName: string;
      leaderboard: LeaderboardEntry[];
      completedMatches: number;
    }>(`/api/tournaments/${tournamentId}/leaderboard`);
  }

  public async deleteTournament(tournamentId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/tournaments/${tournamentId}`, {
      method: 'DELETE'
    });
  }

  // Matches
  public async getMatches(tournamentId?: string): Promise<Match[]> {
    const query = tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : '';
    return this.request<Match[]>(`/api/matches${query}`);
  }

  public async getMatch(matchId: string): Promise<Match & { events: ProposedEvent[]; analysisJob?: AnalysisJob }> {
    return this.request<Match & { events: ProposedEvent[]; analysisJob?: AnalysisJob }>(`/api/matches/${matchId}`);
  }

  public async createMatch(payload: {
    tournamentId?: string;
    gameId: GameId;
    teamA: { id?: string; name: string; color: string };
    teamB: { id?: string; name: string; color: string };
  }): Promise<Match> {
    return this.request<Match>('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  public async finalizeMatch(
    matchId: string,
    payload: { hostNotes?: string; durationSeconds?: number }
  ): Promise<{ match: Match; result: MatchResult }> {
    return this.request<{ match: Match; result: MatchResult }>(`/api/matches/${matchId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  public async addHostEvent(
    matchId: string,
    payload: {
      eventType: string;
      eventLabel: string;
      teamId: string;
      timestampSeconds: number;
      pointsAwarded: number;
      notes?: string;
      judgeRuling?: string;
      ruleCited?: string;
      aiJudgePersona?: string;
      source?: string;
      reviewStatus?: string;
      confidence?: number;
    }
  ): Promise<{ success: boolean; data: ProposedEvent; updatedScores: Record<string, number> }> {
    return this.request<{ success: boolean; data: ProposedEvent; updatedScores: Record<string, number> }>(
      `/api/matches/${matchId}/host-event`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
  }

  // Analysis & Video Upload
  public async submitVideoAnalysis(
    videoBlobOrFile: Blob | File,
    filename: string,
    matchId: string,
    consentConfirmed: boolean,
    mode: 'demo' | 'disconnected' = 'demo',
    onProgress?: (percent: number) => void
  ): Promise<{ jobId: string; matchId: string; videoUrl: string; status: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('video', videoBlobOrFile, filename);
      formData.append('matchId', matchId);
      formData.append('consentConfirmed', String(consentConfirmed));
      formData.append('mode', mode);

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && res.success) {
            resolve(res.data);
          } else {
            reject(new Error(res.error || `Upload failed with status ${xhr.status}`));
          }
        } catch (err) {
          reject(new Error('Invalid server response during video upload'));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during video upload'));
      };

      xhr.open('POST', '/api/analysis');
      xhr.send(formData);
    });
  }

  public async getAnalysisJob(jobId: string): Promise<AnalysisJob & { match?: Match }> {
    return this.request<AnalysisJob & { match?: Match }>(`/api/analysis/${jobId}`);
  }

  public async getJobEvents(jobId: string): Promise<{ jobId: string; matchId: string; events: ProposedEvent[]; count: number }> {
    return this.request<{ jobId: string; matchId: string; events: ProposedEvent[]; count: number }>(`/api/analysis/${jobId}/events`);
  }

  public async deleteAnalysisJob(jobId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/analysis/${jobId}`, {
      method: 'DELETE'
    });
  }

  // Event Review
  public async reviewEvent(
    eventId: string,
    status: 'confirmed' | 'rejected' | 'pending',
    hostNotes?: string,
    pointsAwarded?: number
  ): Promise<{ event: ProposedEvent; matchScores: Record<string, number>; confirmedCount: number }> {
    return this.request<{ event: ProposedEvent; matchScores: Record<string, number>; confirmedCount: number }>(
      `/api/events/${eventId}/review`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, hostNotes, pointsAwarded })
      }
    );
  }

  // Vision Service
  public async getCvServiceStatus(): Promise<{
    url: string;
    isConnected: boolean;
    lastPing: string;
    supportedDetectors: { gameId: string; module: string; status: string; description: string }[];
  }> {
    return this.request<any>('/api/cv-service/status');
  }

  public async updateCvServiceConfig(externalServiceUrl: string): Promise<any> {
    return this.request<any>('/api/cv-service/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalServiceUrl })
    });
  }
}

export const api = new ApiClient();
