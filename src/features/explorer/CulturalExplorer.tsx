import React, { useState } from 'react';
import { 
  Globe2, 
  MapPin, 
  Play, 
  ArrowRight, 
  Compass, 
  Sparkles, 
  Camera, 
  Users, 
  Clock, 
  Layers, 
  CheckCircle2, 
  Info,
  ChevronRight,
  Search,
  ExternalLink
} from 'lucide-react';
import { GameRuleConfig, GameId } from '../../types';

interface CulturalExplorerProps {
  games: GameRuleConfig[];
  onSelectGame: (gameId: GameId) => void;
  onLaunchArena: (gameId: GameId) => void;
}

type RegionFilter = 'all' | 'gcc' | 'middle_east' | 'asia' | 'europe' | 'africa';

export const CulturalExplorer: React.FC<CulturalExplorerProps> = ({
  games,
  onSelectGame,
  onLaunchArena
}) => {
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGameId, setActiveGameId] = useState<string>(games[1]?.id || 'al_teela');

  const filteredGames = games.filter(game => {
    const matchesRegion = selectedRegion === 'all' || game.region === selectedRegion;
    const matchesSearch = searchQuery === '' || 
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.arabicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (game.country && game.country.toLowerCase().includes(searchQuery.toLowerCase())) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRegion && matchesSearch;
  });

  const activeGame = games.find(g => g.id === activeGameId) || filteredGames[0] || games[0];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl navy-card p-6 md:p-8 border border-[#4D6A6D]/40">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-bl from-[#4D6A6D]/20 via-[#A0A083]/10 to-transparent blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4D6A6D]/20 border border-[#4D6A6D]/40 text-[#EAE0CC] text-xs font-semibold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-[#EAE0CC]" />
            Cultural Game Explorer & Global Heritage Map
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Discover Traditional Games <span className="gold-gradient-text">Across the World</span>
          </h1>

          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Every culture has traditional games that bring families together. Explore the deep cultural connections between Emirati heritage—like <strong className="text-white">Al Teela</strong> and <strong className="text-white">Al Laqaf</strong>—and their traditional siblings across Asia, Africa, Europe, and the Mediterranean.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Region Segmented Controls (No pills, clean button states) */}
        <div className="flex items-center gap-1 p-1 bg-[#091224] border border-[#4D6A6D]/30 rounded-xl overflow-x-auto w-full md:w-auto">
          {[
            { id: 'all', label: 'All Traditions' },
            { id: 'gcc', label: '🇦🇪 Emirati & Gulf' },
            { id: 'asia', label: '🌏 East & South Asia' },
            { id: 'middle_east', label: '🏛️ Middle East & Egypt' },
            { id: 'europe', label: '🌍 Mediterranean & Europe' },
            { id: 'africa', label: '🌍 Africa & Levant' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRegion(r.id as RegionFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedRegion === r.id
                  ? 'bg-[#4D6A6D] text-[#EAE0CC] shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by game, country, rule..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#070d1c] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#4D6A6D]"
          />
        </div>
      </div>

      {/* Interactive Map & Active Game Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: Interactive Vector World Map (7 cols) */}
        <div className="lg:col-span-7 navy-card rounded-2xl p-6 border border-[#4D6A6D]/30 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-[#D4AF37]" />
              Interactive Heritage Map & Hotspots
            </span>
            <span className="text-slate-400">
              Click any pin to inspect game
            </span>
          </div>

          {/* SVG Map Canvas with Interactive Pinpoints */}
          <div className="relative w-full rounded-xl bg-[#040813] border border-white/5 overflow-hidden aspect-[16/9] flex items-center justify-center p-2">
            
            {/* Ambient grid lines */}
            <svg 
              viewBox="0 0 1000 500" 
              className="w-full h-full opacity-60 select-none pointer-events-none"
            >
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(77, 106, 109, 0.15)" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="1000" height="500" fill="url(#grid)" />
              
              {/* Stylized continent landmass paths */}
              {/* North America */}
              <path d="M 120 100 Q 180 80 240 120 T 320 180 T 260 260 T 180 240 T 110 180 Z" fill="rgba(121, 132, 120, 0.2)" stroke="rgba(160, 160, 131, 0.3)" strokeWidth="1" />
              {/* South America */}
              <path d="M 270 280 Q 340 310 320 400 T 260 460 T 230 380 T 250 300 Z" fill="rgba(121, 132, 120, 0.2)" stroke="rgba(160, 160, 131, 0.3)" strokeWidth="1" />
              {/* Europe */}
              <path d="M 460 110 Q 520 90 560 130 T 520 200 T 450 180 T 440 130 Z" fill="rgba(121, 132, 120, 0.25)" stroke="rgba(160, 160, 131, 0.35)" strokeWidth="1" />
              {/* Africa */}
              <path d="M 460 210 Q 560 200 580 280 T 540 400 T 460 380 T 430 270 Z" fill="rgba(121, 132, 120, 0.2)" stroke="rgba(160, 160, 131, 0.3)" strokeWidth="1" />
              {/* Asia */}
              <path d="M 580 90 Q 750 70 880 140 T 890 280 T 780 320 T 630 260 T 570 170 Z" fill="rgba(121, 132, 120, 0.25)" stroke="rgba(160, 160, 131, 0.35)" strokeWidth="1" />
              {/* Arabian Peninsula Highlight (UAE & Gulf) */}
              <path d="M 590 220 Q 640 220 660 260 T 630 300 T 580 270 Z" fill="rgba(212, 175, 55, 0.3)" stroke="#D4AF37" strokeWidth="1.5" />
              {/* Australia */}
              <path d="M 780 360 Q 860 350 880 400 T 820 450 T 760 410 Z" fill="rgba(121, 132, 120, 0.2)" stroke="rgba(160, 160, 131, 0.3)" strokeWidth="1" />

              {/* Cultural connection arc between UAE and Korea (Al Laqaf <-> Gonggi) */}
              <path 
                d="M 640 240 Q 740 150 840 200" 
                fill="none" 
                stroke="#D4AF37" 
                strokeWidth="1.5" 
                strokeDasharray="4 4" 
                className="opacity-70"
              />
              {/* Cultural connection arc between UAE and France (Al Teela <-> Petanque) */}
              <path 
                d="M 640 240 Q 550 160 480 150" 
                fill="none" 
                stroke="#4D6A6D" 
                strokeWidth="1.5" 
                strokeDasharray="4 4" 
                className="opacity-70"
              />
            </svg>

            {/* Interactive Pins */}
            {filteredGames.map((game) => {
              const isActive = activeGame?.id === game.id;
              const coords = game.coordinates || { x: 50, y: 50 };

              return (
                <button
                  key={game.id}
                  onClick={() => setActiveGameId(game.id)}
                  style={{
                    left: `${coords.x}%`,
                    top: `${coords.y}%`
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-transform duration-200 ${
                    isActive ? 'scale-125 z-20' : 'hover:scale-110 z-10'
                  }`}
                  title={`${game.name} (${game.country || 'Global'})`}
                >
                  <div className="relative flex items-center justify-center">
                    {/* Pulsing ring if active */}
                    {isActive && (
                      <span className="absolute w-8 h-8 rounded-full bg-[#D4AF37]/30 animate-map-ping pointer-events-none" />
                    )}

                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg border transition-colors ${
                      isActive 
                        ? 'bg-[#D4AF37] text-[#060B18] border-white' 
                        : game.region === 'gcc' 
                        ? 'bg-[#C9ADA1] text-[#060B18] border-[#EAE0CC]'
                        : 'bg-[#4D6A6D] text-[#EAE0CC] border-white/20'
                    }`}>
                      {game.flagEmoji || '📍'}
                    </div>
                  </div>

                  {/* Hover Tag */}
                  <span className={`absolute left-1/2 -translate-x-1/2 top-7 whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-bold tracking-tight pointer-events-none transition-opacity ${
                    isActive ? 'opacity-100 bg-[#060B18] text-[#EAE0CC] border border-[#D4AF37]' : 'opacity-0 group-hover:opacity-100 bg-[#060B18]/90 text-white border border-white/10'
                  }`}>
                    {game.name}
                  </span>
                </button>
              );
            })}

          </div>

          {/* Quick Cultural Connection Banner below map */}
          {activeGame?.culturalConnections && (
            <div className="p-3.5 rounded-xl bg-[#060B18]/80 border border-[#A0A083]/30 text-xs flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#EAE0CC] block">Cultural Sibling Link:</span>
                <p className="text-slate-300 leading-relaxed text-[11px] mt-0.5">
                  {activeGame.culturalConnections}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Detailed Cultural Spotlight Card (5 cols) */}
        {activeGame && (
          <div className="lg:col-span-5 navy-card rounded-2xl p-6 border border-[#4D6A6D]/40 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              
              {/* Country & Category Header */}
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-[#EAE0CC]">
                  <span className="text-base">{activeGame.flagEmoji || '🌐'}</span>
                  <span>{activeGame.country || 'International'}</span>
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#C9ADA1]">
                  {activeGame.category}
                </span>
              </div>

              {/* Title & Arabic name */}
              <div>
                <h3 className="text-2xl font-black text-white">
                  {activeGame.name}
                </h3>
                <p className="text-sm font-bold text-[#D4AF37] font-arabic mt-0.5">
                  {activeGame.arabicName}
                </p>
                <p className="text-xs text-slate-400 italic mt-1">
                  "{activeGame.tagline}"
                </p>
              </div>

              {/* Description & Cultural Lore */}
              <div className="space-y-2 text-xs leading-relaxed text-slate-300">
                <p>{activeGame.description}</p>
                <div className="p-3 rounded-xl bg-[#040813] border border-white/5 space-y-1">
                  <span className="font-bold text-white block text-[11px]">Heritage Background:</span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {activeGame.culturalBackground}
                  </p>
                </div>
              </div>

              {/* Game Parameters */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[#040813] border border-white/5 space-y-0.5">
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">Players</span>
                  <span className="font-semibold text-white">{activeGame.playersPerTeam}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#040813] border border-white/5 space-y-0.5">
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">Pace / Energy</span>
                  <span className="font-semibold text-[#EAE0CC] capitalize">{activeGame.energyLevel || 'Dexterity'}</span>
                </div>
              </div>

              {/* AI Camera & Referee Guidance */}
              <div className="p-3 rounded-xl bg-[#4D6A6D]/15 border border-[#4D6A6D]/30 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[#EAE0CC]">
                  <Camera className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>AI Referee Camera Placement:</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {activeGame.cameraSetupInstructions}
                </p>
              </div>

              {/* Scoring Rules List */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Referee Scoring Events:
                </span>
                <div className="space-y-1">
                  {activeGame.scoringRules.map(rule => (
                    <div 
                      key={rule.eventType}
                      className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5 text-[11px]"
                    >
                      <span className="text-white font-medium">{rule.label}</span>
                      <span className="font-mono text-[#D4AF37] font-bold">+{rule.points} pt</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Launch Arena CTA */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <button
                onClick={() => onLaunchArena(activeGame.id)}
                className="w-full py-3 rounded-xl gold-button text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch Match in Camera Arena</span>
              </button>

              <button
                onClick={() => onSelectGame(activeGame.id)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <span>View Full Rules & Details</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Grid of All Filtered Games Cards */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#D4AF37]" />
            <span>Games Catalog ({filteredGames.length})</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredGames.map(game => (
            <div
              key={game.id}
              onClick={() => setActiveGameId(game.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                activeGame?.id === game.id
                  ? 'bg-[#4D6A6D]/20 border-[#D4AF37] shadow-lg'
                  : 'navy-card border-white/5 hover:border-[#4D6A6D]/50'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-base">{game.flagEmoji || '📍'}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {game.category}
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-white">{game.name}</h4>
                  <p className="text-xs text-[#D4AF37] font-arabic mt-0.5">{game.arabicName}</p>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {game.description}
                </p>
              </div>

              <div className="pt-3 border-t border-white/5 mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono text-[11px]">{game.playersPerTeam}</span>
                <span className="text-[#EAE0CC] font-bold text-[11px] flex items-center gap-0.5">
                  <span>Inspect</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
