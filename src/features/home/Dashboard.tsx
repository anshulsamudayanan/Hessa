import React from 'react';
import { 
  Trophy, 
  Play, 
  ArrowRight, 
  Camera, 
  Cpu, 
  Users, 
  ChevronRight,
  Clock,
  Sparkles,
  Globe2,
  Dices,
  PlusCircle,
  Compass,
  Layers,
  ShieldCheck,
  Palette,
  Volume2
} from 'lucide-react';
import { Tournament, Match, GameId, GameRuleConfig } from '../../types';
import { userProfileStorage, JUDGE_PERSONAS } from '../../services/storage/userProfile';
import { soundEffects } from '../../services/audio/whistle';

interface DashboardProps {
  games: GameRuleConfig[];
  tournaments: Tournament[];
  activeTournament: Tournament | null;
  recentMatches: Match[];
  onNavigate: (tab: string, meta?: any) => void;
  onSelectGame: (gameId: GameId) => void;
  onSelectMatch: (match: Match) => void;
  onOpenCustomizer?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  games,
  tournaments,
  activeTournament,
  recentMatches,
  onNavigate,
  onSelectGame,
  onSelectMatch,
  onOpenCustomizer
}) => {
  const profile = userProfileStorage.getProfile();
  const judge = JUDGE_PERSONAS[profile.judgePersona] || JUDGE_PERSONAS.standard;

  return (
    <div className="space-y-12">
      
      {/* Hero Tournament Banner */}
      <section className="relative overflow-hidden rounded-3xl navy-card p-8 md:p-12 border border-[#4D6A6D]/40 shadow-2xl">
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-gradient-to-br from-[#4D6A6D]/20 via-[#A0A083]/15 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute right-10 bottom-0 opacity-10 pointer-events-none hidden lg:block">
          <Trophy className="w-96 h-96 text-[#D4AF37]" />
        </div>

        <div className="relative z-10 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#4D6A6D]/20 border border-[#4D6A6D]/40 text-[#EAE0CC] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            Student Tech Competition • AI for Family
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Emirati Traditional Games, <span className="gold-gradient-text">Powered by AI</span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            FAREEG AI unites families in celebrating beloved Emirati heritage games and global play traditions. Record live gameplay with any camera, review AI-assisted event proposals, and maintain official tournament standings.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => onNavigate('tournament-setup')}
              className="gold-button px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Trophy className="w-4 h-4" />
              <span>Start Tournament</span>
            </button>

            {activeTournament && (
              <button
                onClick={() => onNavigate('leaderboard', { tournamentId: activeTournament.id })}
                className="px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-white/10 hover:bg-white/15 text-white border border-white/15 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span>Continue: {activeTournament.name}</span>
                <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
              </button>
            )}

            <button
              onClick={() => onNavigate('camera-arena')}
              className="px-5 py-3.5 rounded-xl font-semibold text-xs uppercase tracking-wider bg-[#0a142e] hover:bg-[#112046] text-[#EAE0CC] border border-[#4D6A6D]/40 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4 text-[#D4AF37]" />
              <span>Quick Arena</span>
            </button>
          </div>
        </div>
      </section>

      {/* PERSONALIZED FAMILY MAJLIS & ACTIVE AI JUDGE CARD */}
      <section className="p-6 rounded-2xl navy-card border border-[#4D6A6D]/40 bg-gradient-to-r from-[#0a1326] via-[#0e1c38] to-[#0a1326] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-xl border-2 border-[#D4AF37]/40 shrink-0"
            style={{ backgroundColor: profile.primaryColor }}
          >
            {profile.emblemEmoji}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]">
                Your Majlis Arena
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono">
                {profile.emblemName}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#4D6A6D]/40 text-[#EAE0CC] font-bold">
                {judge.strictnessLevel}
              </span>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">{profile.familyClanName}</h3>
            <p className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                Presiding AI Referee: <strong className="text-[#FCE09B]">{judge.name}</strong>
              </span>
              <span>•</span>
              <span className="text-slate-400 italic">"{judge.tagline}"</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
          <button
            type="button"
            onClick={() => soundEffects.playWhistle('short')}
            className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            title="Sound referee whistle"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Whistle</span>
          </button>

          <button
            type="button"
            onClick={onOpenCustomizer}
            className="gold-button px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Customize Majlis & AI Judge</span>
          </button>
        </div>
      </section>

      {/* THREE PROMINENT FEATURE EXPANSION TILES */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Explore, Match & Create
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Three interactive pathways connecting your family to tradition and AI innovation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Cultural Game Explorer */}
          <div
            onClick={() => onNavigate('explorer')}
            className="navy-card rounded-2xl p-6 border border-[#4D6A6D]/40 hover:border-[#D4AF37]/50 transition-all duration-300 cursor-pointer group flex flex-col justify-between space-y-5 shadow-lg"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#4D6A6D]/20 border border-[#4D6A6D]/40 flex items-center justify-center text-[#EAE0CC] group-hover:scale-105 transition-transform">
                <Globe2 className="w-6 h-6 text-[#A0A083]" />
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A083]">Interactive World Map</span>
                <h3 className="text-xl font-black text-white group-hover:text-[#EAE0CC] transition-colors mt-0.5">
                  Explore Cultures
                </h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Discover traditional games across Korea, India, Egypt, France, and the Gulf. Uncover the direct historical siblings of Emirati games on a responsive world map.
              </p>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-bold text-[#EAE0CC]">
              <span>Explore Interactive Map</span>
              <ChevronRight className="w-4 h-4 text-[#D4AF37] group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Surprise Me */}
          <div
            onClick={() => onNavigate('surpriseme')}
            className="navy-card rounded-2xl p-6 border border-[#C9ADA1]/30 hover:border-[#D4AF37]/50 transition-all duration-300 cursor-pointer group flex flex-col justify-between space-y-5 shadow-lg"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#C9ADA1]/20 border border-[#C9ADA1]/40 flex items-center justify-center text-[#C9ADA1] group-hover:scale-105 transition-transform">
                <Dices className="w-6 h-6 text-[#C9ADA1]" />
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9ADA1]">Group Matchmaker</span>
                <h3 className="text-xl font-black text-white group-hover:text-[#EAE0CC] transition-colors mt-0.5">
                  Surprise Me
                </h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Filter by group size, room space, and energy level. Swipe through tailored recommendations or roll the dice for an instant family match pick.
              </p>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-bold text-[#C9ADA1]">
              <span>Find Tonight's Game</span>
              <ChevronRight className="w-4 h-4 text-[#D4AF37] group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: AI Game Creator & Universal Referee */}
          <div
            onClick={() => onNavigate('creator')}
            className="navy-card rounded-2xl p-6 border border-[#D4AF37]/30 hover:border-[#D4AF37]/60 transition-all duration-300 cursor-pointer group flex flex-col justify-between space-y-5 shadow-lg"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6 text-[#D4AF37]" />
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">Universal AI Judge</span>
                <h3 className="text-xl font-black text-white group-hover:text-[#EAE0CC] transition-colors mt-0.5">
                  Create Your Own Game
                </h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Describe any playground or majlis game. FAREEG AI generates official scoring mechanics, camera placement instructions, and automated referee rules.
              </p>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-bold text-[#D4AF37]">
              <span>Build Custom Referee</span>
              <ChevronRight className="w-4 h-4 text-[#D4AF37] group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>
      </section>

      {/* Five Supported Core Emirati Games Grid */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Arena Traditional Games</span>
              <span className="text-xs px-2.5 py-0.5 rounded bg-[#4D6A6D]/30 text-[#EAE0CC] font-bold font-mono">
                {games.length} Games Available
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select any game to review camera positioning guides and launch into live match judging.
            </p>
          </div>
          <button
            onClick={() => onNavigate('games')}
            className="text-xs text-[#D4AF37] hover:text-[#EAE0CC] font-bold flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>View All Rules & Setups</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {games.slice(0, 5).map((game, idx) => (
            <div
              key={game.id}
              className="navy-card rounded-xl p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 group border border-white/5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A083] px-2 py-0.5 rounded bg-white/5">
                    {game.category}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">0{idx + 1}</span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-[#EAE0CC] transition-colors">
                    {game.name}
                  </h3>
                  <p className="text-xs font-semibold text-[#D4AF37] tracking-wider mt-0.5 font-arabic">
                    {game.arabicName}
                  </p>
                </div>

                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {game.description}
                </p>
              </div>

              <div className="pt-4 border-t border-white/5 mt-4">
                <button
                  onClick={() => onSelectGame(game.id)}
                  className="w-full py-2 rounded-lg bg-white/5 hover:bg-[#D4AF37] hover:text-[#060b18] text-xs font-bold text-slate-300 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Select Game</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How AI Judging Works (Anti-Slop, Deterministic & Family-Centric) */}
      <section className="rounded-2xl bg-gradient-to-br from-[#0c162e] to-[#070d1e] border border-[#4D6A6D]/30 p-8 shadow-xl">
        <div className="max-w-2xl mb-8">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-2">
            <Cpu className="w-4 h-4" />
            Transparent AI Architecture
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            How Family AI Judging Works
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            FAREEG AI combines computer vision proposal with host human verification and deterministic scoring rules.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#4D6A6D]/20 border border-[#4D6A6D]/40 flex items-center justify-center text-[#EAE0CC] font-bold text-xs">
              1
            </div>
            <h4 className="text-sm font-bold text-white">Record or Upload</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Family captures gameplay using a phone, laptop, or camera with game-specific positioning guides.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#798478]/20 border border-[#798478]/40 flex items-center justify-center text-[#EAE0CC] font-bold text-xs">
              2
            </div>
            <h4 className="text-sm font-bold text-white">Vision Detectors</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Specialized OpenCV detectors track ball trajectories, ring boundaries, marble displacement, or freeze states.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] font-bold text-xs">
              3
            </div>
            <h4 className="text-sm font-bold text-white">Host Human Review</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every candidate event is flagged with a timestamp for the host family to review and confirm or reject.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#C9ADA1]/20 border border-[#C9ADA1]/40 flex items-center justify-center text-[#C9ADA1] font-bold text-xs">
              4
            </div>
            <h4 className="text-sm font-bold text-white">Deterministic Scoring</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Rules engine applies official configurable points, updates match scores, and recalculates tournament standings.
            </p>
          </div>

        </div>
      </section>

      {/* Two Column Section: Recent Matches & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Recent Matches */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#D4AF37]" />
              <span>Recent Arena Matches</span>
            </h3>
            <button
              onClick={() => onNavigate('camera-arena')}
              className="text-xs text-[#D4AF37] hover:underline font-semibold cursor-pointer"
            >
              + New Match
            </button>
          </div>

          <div className="space-y-3">
            {recentMatches.length === 0 ? (
              <div className="navy-card rounded-xl p-8 text-center text-slate-400 text-xs">
                <p>No matches recorded yet. Start your first match from the arena!</p>
              </div>
            ) : (
              recentMatches.slice(0, 4).map(match => {
                const game = games.find(g => g.id === match.gameId);
                const scoreA = match.scores[match.teamA.id] || 0;
                const scoreB = match.scores[match.teamB.id] || 0;

                return (
                  <div
                    key={match.id}
                    onClick={() => onSelectMatch(match)}
                    className="navy-card rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-[#D4AF37]/40 transition-all border border-white/5"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#D4AF37]">
                          {game?.name || match.gameId}
                        </span>
                        <span className="text-slate-500 text-xs">•</span>
                        <span className="text-[11px] text-slate-400 capitalize">
                          {match.tournamentName || 'Quick Match'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm font-bold text-white">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: match.teamA.color || '#D4AF37' }} />
                          {match.teamA.name}
                        </span>
                        <span className="font-mono text-base text-[#EAE0CC] px-2 py-0.5 rounded bg-black/40">
                          {scoreA} : {scoreB}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: match.teamB.color || '#3b82f6' }} />
                          {match.teamB.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                        match.status === 'completed' 
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                          : match.status === 'reviewing'
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-950/60 text-blue-300 border border-blue-500/30'
                      }`}>
                        {match.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Current Leaderboard Standings Preview */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#D4AF37]" />
              <span>Tournament Standings</span>
            </h3>
            <button
              onClick={() => onNavigate('leaderboard')}
              className="text-xs text-[#D4AF37] hover:underline font-semibold cursor-pointer"
            >
              Full Leaderboard
            </button>
          </div>

          <div className="navy-card rounded-xl p-5 border border-white/5 space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 border-b border-white/10 pb-3">
              <span>Team</span>
              <div className="flex items-center gap-6">
                <span>P</span>
                <span>W</span>
                <span>PTS</span>
              </div>
            </div>

            {activeTournament && activeTournament.teams.length > 0 ? (
              <div className="space-y-2.5">
                {activeTournament.teams.map((team, idx) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between text-sm py-2 px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-extrabold ${
                        idx === 0 ? 'bg-[#D4AF37] text-[#060b18]' : 'bg-white/10 text-slate-300'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: team.color }} />
                        <span className="font-semibold text-white">{team.name}</span>
                        {team.arabicName && (
                          <span className="text-xs text-slate-400 hidden sm:inline font-arabic">({team.arabicName})</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 font-mono text-xs">
                      <span className="text-slate-400">1</span>
                      <span className="text-slate-300">{idx === 0 ? 1 : 0}</span>
                      <span className="font-extrabold text-[#EAE0CC]">{idx === 0 ? 3 : 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                <p>Create or select a tournament to track standings.</p>
                <button
                  onClick={() => onNavigate('tournament-setup')}
                  className="mt-3 gold-button px-4 py-1.5 rounded-lg text-xs"
                >
                  Create Tournament
                </button>
              </div>
            )}
          </div>
        </section>

      </div>

    </div>
  );
};
