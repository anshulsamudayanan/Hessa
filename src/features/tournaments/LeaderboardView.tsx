import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Award, 
  Plus, 
  RotateCcw, 
  Calendar, 
  ChevronRight, 
  AlertCircle,
  Users,
  CheckCircle2
} from 'lucide-react';
import { Tournament, LeaderboardEntry, Match } from '../../types';
import { api } from '../../services/api/client';
import { GAMES_CONFIG } from '../../config/games';

interface LeaderboardViewProps {
  tournaments: Tournament[];
  initialTournamentId?: string;
  onNavigateNewTournament: () => void;
  onNavigateArena: () => void;
  onSelectMatch: (match: Match) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  tournaments,
  initialTournamentId,
  onNavigateNewTournament,
  onNavigateArena,
  onSelectMatch
}) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    initialTournamentId || tournaments[0]?.id || ''
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentTournament = tournaments.find(t => t.id === selectedTournamentId) || tournaments[0];

  useEffect(() => {
    if (currentTournament) {
      loadTournamentData(currentTournament.id);
    } else {
      setIsLoading(false);
    }
  }, [currentTournament?.id]);

  const loadTournamentData = async (tournId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [boardRes, matchesList] = await Promise.all([
        api.getLeaderboard(tournId),
        api.getMatches(tournId)
      ]);

      setLeaderboard(boardRes.leaderboard || []);
      setCompletedCount(boardRes.completedMatches || 0);
      setMatches(matchesList || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tournament standings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      {/* Header & Tournament Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#d4af37] uppercase tracking-wider mb-1">
            <Trophy className="w-4 h-4" />
            Official Standings & Bracket
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Tournament Scoreboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Rankings calculated automatically using the deterministic scoring engine.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {tournaments.length > 0 && (
            <select
              value={selectedTournamentId}
              onChange={e => setSelectedTournamentId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#060b18] border border-white/10 text-white text-xs font-bold focus:outline-none focus:border-[#d4af37]"
            >
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={onNavigateNewTournament}
            className="gold-button px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Tournament</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="navy-card rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{currentTournament?.name || 'Tournament'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">
              Format: {currentTournament?.format.replace('_', ' ')} • {completedCount} matches completed
            </p>
          </div>

          <button
            onClick={onNavigateArena}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Trophy className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Play Match</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Calculating tournament standings...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No standings available for this tournament yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#060b18]/70 uppercase tracking-wider font-extrabold text-slate-400 border-b border-white/5">
                <tr>
                  <th className="py-3.5 px-4 text-center w-14">Rank</th>
                  <th className="py-3.5 px-4">Team</th>
                  <th className="py-3.5 px-4 text-center">Played</th>
                  <th className="py-3.5 px-4 text-center">Won</th>
                  <th className="py-3.5 px-4 text-center">Drawn</th>
                  <th className="py-3.5 px-4 text-center">Lost</th>
                  <th className="py-3.5 px-4 text-center">Points For</th>
                  <th className="py-3.5 px-4 text-center">Against</th>
                  <th className="py-3.5 px-4 text-center">Diff</th>
                  <th className="py-3.5 px-4 text-center text-[#fce09b] font-black">Tournament PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((entry, index) => (
                  <tr 
                    key={entry.teamId}
                    className="hover:bg-white/[0.03] transition-colors font-medium text-slate-300"
                  >
                    <td className="py-4 px-4 text-center">
                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs ${
                        index === 0 
                          ? 'bg-[#d4af37] text-[#060b18] shadow' 
                          : index === 1 
                          ? 'bg-slate-300 text-slate-900' 
                          : index === 2 
                          ? 'bg-amber-700 text-white' 
                          : 'bg-white/10 text-slate-400'
                      }`}>
                        {index + 1}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-bold text-white flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-sm">{entry.teamName}</span>
                    </td>

                    <td className="py-4 px-4 text-center font-mono">{entry.played}</td>
                    <td className="py-4 px-4 text-center font-mono text-emerald-400">{entry.won}</td>
                    <td className="py-4 px-4 text-center font-mono text-slate-400">{entry.drawn}</td>
                    <td className="py-4 px-4 text-center font-mono text-rose-400">{entry.lost}</td>
                    <td className="py-4 px-4 text-center font-mono">{entry.pointsFor}</td>
                    <td className="py-4 px-4 text-center font-mono">{entry.pointsAgainst}</td>
                    <td className="py-4 px-4 text-center font-mono font-bold">
                      {entry.pointsDifference > 0 ? `+${entry.pointsDifference}` : entry.pointsDifference}
                    </td>
                    <td className="py-4 px-4 text-center font-mono font-black text-sm text-[#fce09b]">
                      {entry.tournamentPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Matches History Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#d4af37]" />
          <span>Tournament Matches History</span>
        </h3>

        {matches.length === 0 ? (
          <div className="navy-card rounded-xl p-8 text-center text-slate-400 text-xs">
            No matches scheduled or played yet in this tournament.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map(m => {
              const game = GAMES_CONFIG[m.gameId];
              const scoreA = m.scores[m.teamA.id] || 0;
              const scoreB = m.scores[m.teamB.id] || 0;

              return (
                <div
                  key={m.id}
                  onClick={() => onSelectMatch(m)}
                  className="navy-card rounded-xl p-4 border border-white/5 hover:border-[#d4af37]/40 transition-all cursor-pointer space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#d4af37]">{game?.name}</span>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      m.status === 'completed'
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                    }`}>
                      {m.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm font-bold text-white">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.teamA.color }} />
                      {m.teamA.name}
                    </span>
                    <span className="font-mono text-base text-[#fce09b] px-3 py-1 rounded bg-[#060b18] border border-white/10">
                      {scoreA} - {scoreB}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.teamB.color }} />
                      {m.teamB.name}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-white/5">
                    <span>Duration: {m.durationSeconds ? `${m.durationSeconds}s` : 'Standard'}</span>
                    <span className="text-[#d4af37] flex items-center gap-0.5">
                      <span>View Results</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
