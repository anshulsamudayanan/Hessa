import React from 'react';
import { 
  Trophy, 
  Award, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  RotateCcw,
  Sparkles,
  Home
} from 'lucide-react';
import { Match, MatchResult } from '../../types';
import { GAMES_CONFIG } from '../../config/games';

interface MatchResultsProps {
  match: Match;
  onNavigateDashboard: () => void;
  onNavigateLeaderboard: () => void;
  onStartNewMatch: () => void;
}

export const MatchResults: React.FC<MatchResultsProps> = ({
  match,
  onNavigateDashboard,
  onNavigateLeaderboard,
  onStartNewMatch
}) => {
  const game = GAMES_CONFIG[match.gameId];
  const scoreA = match.scores[match.teamA.id] || 0;
  const scoreB = match.scores[match.teamB.id] || 0;

  const isTeamAWinner = scoreA > scoreB;
  const isTeamBWinner = scoreB > scoreA;
  const isDraw = scoreA === scoreB;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Top Banner Celebration */}
      <div className="relative overflow-hidden rounded-3xl navy-card gold-border-glow p-8 md:p-12 text-center shadow-2xl">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#d4af37]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#d4af37]/20 border border-[#d4af37]/40 flex items-center justify-center text-[#d4af37] mx-auto shadow-lg">
            <Trophy className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Official Match Finalized
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            {isDraw ? 'Honorable Draw!' : isTeamAWinner ? `${match.teamA.name} Wins!` : `${match.teamB.name} Wins!`}
          </h1>

          <p className="text-sm text-slate-300">
            {game?.name} ({game?.arabicName}) • {match.tournamentName || 'Arena Exhibition Cup'}
          </p>

          {/* Big Score Box */}
          <div className="pt-4 flex items-center justify-center gap-8">
            <div className="text-center space-y-1">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: match.teamA.color }} />
              <div className="text-sm font-bold text-slate-300">{match.teamA.name}</div>
              <div className="text-4xl sm:text-6xl font-black font-mono text-white">{scoreA}</div>
            </div>

            <div className="text-2xl font-mono text-slate-600">:</div>

            <div className="text-center space-y-1">
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: match.teamB.color }} />
              <div className="text-sm font-bold text-slate-300">{match.teamB.name}</div>
              <div className="text-4xl sm:text-6xl font-black font-mono text-white">{scoreB}</div>
            </div>
          </div>

        </div>
      </div>

      {/* Match Metadata & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="navy-card rounded-xl p-4 border border-white/10 space-y-1 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Game Category</span>
          <span className="text-base font-bold text-white capitalize">{game?.category} ({game?.name})</span>
        </div>

        <div className="navy-card rounded-xl p-4 border border-white/10 space-y-1 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Match Duration</span>
          <span className="text-base font-bold font-mono text-[#fce09b]">
            {match.durationSeconds ? `${Math.floor(match.durationSeconds / 60)}m ${match.durationSeconds % 60}s` : 'Full Game'}
          </span>
        </div>

        <div className="navy-card rounded-xl p-4 border border-white/10 space-y-1 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Judicial Status</span>
          <span className="text-base font-bold text-emerald-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Host Certified
          </span>
        </div>

      </div>

      {/* Host Notes if present */}
      {match.hostNotes && (
        <div className="navy-card rounded-xl p-5 border border-white/10 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#d4af37] block">
            Host / Umpire Certification Notes
          </span>
          <p className="text-sm text-slate-300 italic leading-relaxed">
            "{match.hostNotes}"
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        <button
          onClick={onNavigateDashboard}
          className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Home className="w-4 h-4 text-[#d4af37]" />
          <span>Return to Dashboard</span>
        </button>

        <button
          onClick={onNavigateLeaderboard}
          className="gold-button px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
        >
          <Award className="w-4 h-4" />
          <span>View Tournament Standings</span>
        </button>

        <button
          onClick={onStartNewMatch}
          className="px-5 py-3 rounded-xl bg-[#0a1532] hover:bg-[#10204a] text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer border border-white/10 transition-colors"
        >
          <RotateCcw className="w-4 h-4 text-emerald-400" />
          <span>Start Next Match</span>
        </button>
      </div>

    </div>
  );
};
