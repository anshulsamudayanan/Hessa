import React from 'react';
import { 
  Gamepad2, 
  Camera, 
  Play, 
  Info, 
  ShieldCheck, 
  Users, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { GameId } from '../../types';
import { ALL_GAMES } from '../../config/games';

interface GameSelectionProps {
  onSelectGame: (gameId: GameId) => void;
  onNavigateArena: () => void;
}

export const GameSelection: React.FC<GameSelectionProps> = ({ onSelectGame, onNavigateArena }) => {
  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#d4af37] uppercase tracking-wider mb-1">
            <Gamepad2 className="w-4 h-4" />
            Emirati Heritage Games Catalog
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Traditional Games & Camera Arena
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Each game features specialized camera placement recommendations and configurable scoring rules for your family tournament.
          </p>
        </div>

        <button
          onClick={onNavigateArena}
          className="gold-button px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 self-start cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          <span>Open Arena Camera</span>
        </button>
      </div>

      {/* 5 Game Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ALL_GAMES.map((game, index) => (
          <div
            key={game.id}
            className="navy-card rounded-2xl p-6 border border-white/10 flex flex-col justify-between hover:border-[#d4af37]/40 transition-all duration-300 group shadow-lg"
          >
            <div className="space-y-4">
              
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#d4af37] px-2.5 py-1 rounded bg-[#d4af37]/10 border border-[#d4af37]/20">
                  {game.category}
                </span>
                <span className="text-xs text-slate-500 font-mono">0{index + 1}</span>
              </div>

              {/* Title & Arabic name */}
              <div>
                <h3 className="text-xl font-extrabold text-white group-hover:text-[#fce09b] transition-colors flex items-center gap-2">
                  <span>{game.name}</span>
                </h3>
                <p className="text-sm font-bold text-[#d4af37] font-arabic mt-0.5">
                  {game.arabicName}
                </p>
                <p className="text-xs text-slate-400 italic mt-1">
                  {game.tagline}
                </p>
              </div>

              {/* Description & Cultural context */}
              <p className="text-xs text-slate-300 leading-relaxed">
                {game.description}
              </p>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs">
                <div className="flex items-start gap-2 text-slate-300">
                  <Camera className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Camera Setup:</span>
                    <span className="text-slate-400">{game.recommendedAngle}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-400 text-[11px] pt-1 border-t border-white/5">
                  <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Team Size: <strong className="text-slate-300">{game.playersPerTeam}</strong></span>
                </div>
              </div>

              {/* Scoring rules summary */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Scoring Events:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {game.scoringRules.map(rule => (
                    <span
                      key={rule.eventType}
                      className="text-[11px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300"
                    >
                      {rule.label} ({rule.points > 0 ? `+${rule.points} pt` : 'Review'})
                    </span>
                  ))}
                </div>
              </div>

              {/* Cultural Note Notice */}
              <div className="text-[11px] text-slate-500 bg-[#060b18]/60 p-2.5 rounded-lg border border-white/5 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#d4af37] shrink-0 mt-0.5" />
                <span>{game.rulesPlaceholderNote}</span>
              </div>

            </div>

            {/* Select button */}
            <div className="pt-6 mt-4 border-t border-white/5">
              <button
                onClick={() => onSelectGame(game.id)}
                className="w-full py-3 rounded-xl gold-button text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Select & Set Up Match</span>
              </button>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};
