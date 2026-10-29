import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Dices, 
  Users, 
  Zap, 
  MapPin, 
  Clock, 
  Check, 
  X, 
  Play, 
  ChevronRight, 
  ChevronLeft,
  RotateCcw,
  Heart,
  Camera,
  Info
} from 'lucide-react';
import { GameRuleConfig, GameId } from '../../types';

interface SurpriseMeProps {
  games: GameRuleConfig[];
  onSelectGame: (gameId: GameId) => void;
  onLaunchArena: (gameId: GameId) => void;
}

export const SurpriseMe: React.FC<SurpriseMeProps> = ({
  games,
  onSelectGame,
  onLaunchArena
}) => {
  // Filters for group matching
  const [groupSize, setGroupSize] = useState<'all' | 'pairs' | 'family' | 'party'>('family');
  const [energyLevel, setEnergyLevel] = useState<'all' | 'mind' | 'dexterity' | 'athletic'>('all');
  const [locationType, setLocationType] = useState<'all' | 'indoor' | 'tabletop' | 'outdoor'>('all');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  // Match games according to group preferences
  const recommendedGames = useMemo(() => {
    return games.filter(g => {
      const matchSize = groupSize === 'all' || !g.suitableGroup || g.suitableGroup === 'all' || g.suitableGroup === groupSize;
      const matchEnergy = energyLevel === 'all' || !g.energyLevel || g.energyLevel === energyLevel;
      const matchLoc = locationType === 'all' || !g.locationType || g.locationType === locationType;
      return matchSize && matchEnergy && matchLoc;
    });
  }, [games, groupSize, energyLevel, locationType]);

  // Ensure index is within range
  const safeIndex = recommendedGames.length > 0 ? (currentIndex % recommendedGames.length) : 0;
  const currentGame = recommendedGames[safeIndex] || games[0];

  const handleNext = () => {
    if (recommendedGames.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % recommendedGames.length);
    }
  };

  const handlePrev = () => {
    if (recommendedGames.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + recommendedGames.length) % recommendedGames.length);
    }
  };

  const handleRandomDice = () => {
    setIsRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setCurrentIndex(Math.floor(Math.random() * games.length));
      if (count >= 8) {
        clearInterval(interval);
        setIsRolling(false);
      }
    }, 80);
  };

  // Compute calculated match percentage for group
  const matchScore = useMemo(() => {
    let score = 84;
    if (currentGame.suitableGroup === groupSize) score += 8;
    if (currentGame.energyLevel === energyLevel) score += 5;
    if (currentGame.locationType === locationType) score += 3;
    return Math.min(score, 99);
  }, [currentGame, groupSize, energyLevel, locationType]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Top Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C9ADA1]/20 border border-[#C9ADA1]/30 text-[#EAE0CC] text-xs font-semibold uppercase tracking-wider">
          <Dices className="w-3.5 h-3.5 text-[#C9ADA1]" />
          Group Matchmaker & Smart Recommendations
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Surprise Me: <span className="gold-gradient-text">Find Tonight's Game</span>
        </h1>
        <p className="text-sm text-slate-300 max-w-xl mx-auto">
          Tell us about your gathering and discover the perfect traditional game suited for your family's space, energy, and group size.
        </p>
      </div>

      {/* Interactive Group Filter Controls */}
      <div className="navy-card rounded-2xl p-6 border border-[#4D6A6D]/30 space-y-4 shadow-xl">
        <div className="text-xs font-bold uppercase tracking-wider text-[#EAE0CC] flex items-center gap-2">
          <span>Configure Your Group Parameters:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Group Size Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Group Size</span>
            </label>
            <select
              value={groupSize}
              onChange={e => { setGroupSize(e.target.value as any); setCurrentIndex(0); }}
              className="w-full px-3 py-2 rounded-xl bg-[#060B18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4D6A6D]"
            >
              <option value="all">Any Group Size</option>
              <option value="pairs">Solo or Pairs (1-2 Players)</option>
              <option value="family">Family Gathering (3-5 Players)</option>
              <option value="party">Large Clan / Party (6+ Players)</option>
            </select>
          </div>

          {/* Energy Level Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#C9ADA1]" />
              <span>Energy & Pace</span>
            </label>
            <select
              value={energyLevel}
              onChange={e => { setEnergyLevel(e.target.value as any); setCurrentIndex(0); }}
              className="w-full px-3 py-2 rounded-xl bg-[#060B18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4D6A6D]"
            >
              <option value="all">Any Energy Level</option>
              <option value="mind">Mind & Strategy (Quiet Focus)</option>
              <option value="dexterity">Dexterity & Rhythm (Toss & Aim)</option>
              <option value="athletic">Athletic & Running (High Energy)</option>
            </select>
          </div>

          {/* Location Setting */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#A0A083]" />
              <span>Playing Space</span>
            </label>
            <select
              value={locationType}
              onChange={e => { setLocationType(e.target.value as any); setCurrentIndex(0); }}
              className="w-full px-3 py-2 rounded-xl bg-[#060B18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4D6A6D]"
            >
              <option value="all">Any Space</option>
              <option value="indoor">Indoor Living Room / Majlis</option>
              <option value="tabletop">Tabletop / Floor Board</option>
              <option value="outdoor">Outdoor Sand Pitch / Courtyard</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Swipeable Showcase Card Deck */}
      {currentGame ? (
        <div className="relative">
          
          <div className={`navy-card rounded-3xl p-8 border border-[#4D6A6D]/40 space-y-6 shadow-2xl transition-all duration-300 ${
            isRolling ? 'scale-95 opacity-80' : 'scale-100 opacity-100'
          }`}>
            
            {/* Top Match Badge Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{currentGame.flagEmoji || '🇦🇪'}</span>
                <span className="text-xs font-bold text-[#EAE0CC]">
                  {currentGame.country || 'Traditional Heritage'}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#C9ADA1]">
                  {currentGame.category}
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>{matchScore}% Match</span>
              </div>
            </div>

            {/* Game Title & Native Script */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl sm:text-4xl font-black text-white">
                  {currentGame.name}
                </h2>
                <span className="text-lg font-bold text-[#D4AF37] font-arabic">
                  {currentGame.arabicName}
                </span>
              </div>
              <p className="text-sm text-slate-300 italic">
                "{currentGame.tagline}"
              </p>
            </div>

            {/* Description & Cultural lore */}
            <p className="text-sm text-slate-300 leading-relaxed">
              {currentGame.description}
            </p>

            {/* Why This Fits Your Group Callout */}
            <div className="p-4 rounded-2xl bg-[#4D6A6D]/15 border border-[#4D6A6D]/30 space-y-2">
              <span className="text-xs font-bold uppercase text-[#EAE0CC] block flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-[#C9ADA1] fill-[#C9ADA1]" />
                <span>Why It Fits Your Gathering:</span>
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {currentGame.culturalConnections || currentGame.culturalBackground}
              </p>
            </div>

            {/* Key Game Attributes Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#060B18] border border-white/5 space-y-1">
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Players</span>
                <span className="font-bold text-white">{currentGame.playersPerTeam}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#060B18] border border-white/5 space-y-1">
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Round Duration</span>
                <span className="font-bold text-[#EAE0CC]">{currentGame.durationMinutes || 12} mins</span>
              </div>
              <div className="p-3 rounded-xl bg-[#060B18] border border-white/5 space-y-1">
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Equipment</span>
                <span className="font-bold text-slate-300 truncate block" title={currentGame.equipmentNeeded}>
                  {currentGame.equipmentNeeded || 'Standard'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#060B18] border border-white/5 space-y-1">
                <span className="text-[10px] uppercase text-slate-500 font-bold block">AI Referee Angle</span>
                <span className="font-bold text-[#D4AF37] truncate block" title={currentGame.recommendedAngle}>
                  {currentGame.recommendedAngle}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
              
              {/* Prev / Next / Random Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 cursor-pointer"
                  title="Previous game"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={handleNext}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Pass / Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={handleRandomDice}
                  disabled={isRolling}
                  className="px-4 py-2.5 rounded-xl bg-[#4D6A6D]/30 hover:bg-[#4D6A6D]/50 text-[#EAE0CC] border border-[#4D6A6D]/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Roll the dice for instant surprise"
                >
                  <Dices className={`w-4 h-4 text-[#D4AF37] ${isRolling ? 'animate-spin' : ''}`} />
                  <span>Dice Roll</span>
                </button>
              </div>

              {/* Primary Action Button */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => onLaunchArena(currentGame.id)}
                  className="gold-button flex-1 sm:flex-none px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xl"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Let's Play This Now!</span>
                </button>
              </div>

            </div>

          </div>

          {/* Cards Count Indicator */}
          <div className="text-center text-xs text-slate-500 pt-3">
            Showing game {safeIndex + 1} of {recommendedGames.length} recommendations
          </div>

        </div>
      ) : (
        <div className="navy-card rounded-2xl p-12 text-center text-slate-400 space-y-4">
          <p>No games matched the selected filter criteria.</p>
          <button
            onClick={() => { setGroupSize('all'); setEnergyLevel('all'); setLocationType('all'); }}
            className="gold-button px-5 py-2.5 rounded-xl text-xs font-bold"
          >
            Reset Filters
          </button>
        </div>
      )}

    </div>
  );
};
