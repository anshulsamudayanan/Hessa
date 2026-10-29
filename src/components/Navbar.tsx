import React from 'react';
import { 
  Trophy, 
  Video, 
  Gamepad2, 
  Award, 
  Cpu, 
  Home, 
  Globe2, 
  Dices, 
  Sparkles,
  Plus
} from 'lucide-react';
import { Tournament, UserMajlisProfile } from '../types';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string, meta?: any) => void;
  activeTournament?: Tournament | null;
  userProfile?: UserMajlisProfile;
  onOpenCustomizer?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentTab, 
  onNavigate, 
  activeTournament,
  userProfile,
  onOpenCustomizer
}) => {
  return (
    <header className="sticky top-0 z-50 border-b border-[#4D6A6D]/20 bg-[#060b18]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          
          {/* Logo & Brand Mark */}
          <div 
            onClick={() => onNavigate('dashboard')} 
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EAE0CC] via-[#D4AF37] to-[#C9ADA1] p-0.5 shadow-lg shadow-[#D4AF37]/15 flex items-center justify-center">
              <div className="w-full h-full bg-[#0a1226] rounded-[10px] flex items-center justify-center group-hover:bg-[#0f1b38] transition-colors">
                <Trophy className="w-5 h-5 text-[#D4AF37]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-wider text-white">FAREEG</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-[#D4AF37] text-[#060b18]">AI</span>
              </div>
              <p className="text-[9px] tracking-widest uppercase text-[#A0A083] -mt-0.5">Emirati & World Games Arena</p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold text-slate-300">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-white/10 text-white shadow-inner font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => onNavigate('explorer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'explorer'
                  ? 'bg-[#4D6A6D] text-[#EAE0CC] shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Globe2 className="w-4 h-4 text-[#A0A083]" />
              <span>Explore Cultures</span>
            </button>

            <button
              onClick={() => onNavigate('surpriseme')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'surpriseme'
                  ? 'bg-[#C9ADA1]/20 text-[#EAE0CC] border border-[#C9ADA1]/40 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Dices className="w-4 h-4 text-[#C9ADA1]" />
              <span>Surprise Me</span>
            </button>

            <button
              onClick={() => onNavigate('creator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'creator'
                  ? 'bg-[#D4AF37]/20 text-[#EAE0CC] border border-[#D4AF37]/40 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span>AI Creator</span>
            </button>

            <button
              onClick={() => onNavigate('camera-arena')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'camera-arena' || currentTab === 'match-setup'
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Video className="w-4 h-4 text-[#D4AF37]" />
              <span>Arena</span>
            </button>

            <button
              onClick={() => onNavigate('tournaments')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'tournaments' || currentTab === 'tournament-setup'
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Tournaments
            </button>

            <button
              onClick={() => onNavigate('leaderboard')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'leaderboard'
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Scores
            </button>

            <button
              onClick={() => onNavigate('vision-docs')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentTab === 'vision-docs'
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Vision API
            </button>
          </nav>

          {/* Right Action */}
          <div className="flex items-center gap-2.5">
            {activeTournament ? (
              <div 
                onClick={() => onNavigate('leaderboard')}
                className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#4D6A6D]/20 border border-[#4D6A6D]/40 text-[#EAE0CC] text-xs font-medium cursor-pointer hover:bg-[#4D6A6D]/30 transition-colors"
                title="Current active tournament"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                <span className="max-w-[120px] truncate">{activeTournament.name}</span>
              </div>
            ) : null}

            {/* Personalized Majlis & AI Judge Badge */}
            {userProfile && (
              <button
                onClick={onOpenCustomizer}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 hover:border-[#D4AF37]/50 bg-[#060b18]/80 hover:bg-white/5 transition-all cursor-pointer group"
                title="Customize Family Majlis & AI Judge"
              >
                <span 
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-sm shadow-sm"
                  style={{ backgroundColor: userProfile.primaryColor }}
                >
                  {userProfile.emblemEmoji}
                </span>
                <div className="text-left hidden sm:block">
                  <div className="text-[11px] font-extrabold text-white group-hover:text-[#fce09b] leading-tight truncate max-w-[110px]">
                    {userProfile.familyClanName}
                  </div>
                  <div className="text-[9px] text-[#A0A083] leading-none">
                    Judge: {userProfile.judgeName.split(' ')[0]}
                  </div>
                </div>
              </button>
            )}

            <button
              onClick={() => onNavigate('creator')}
              className="gold-button px-3.5 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create Game</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Bar */}
      <div className="flex lg:hidden border-t border-white/5 px-2 py-2 justify-around bg-[#080e22]">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center py-1 px-2 rounded text-[11px] ${currentTab === 'dashboard' ? 'text-[#D4AF37] font-bold' : 'text-slate-400'}`}
        >
          <Home className="w-4 h-4 mb-0.5" />
          Home
        </button>
        <button
          onClick={() => onNavigate('explorer')}
          className={`flex flex-col items-center py-1 px-2 rounded text-[11px] ${currentTab === 'explorer' ? 'text-[#4D6A6D] font-bold' : 'text-slate-400'}`}
        >
          <Globe2 className="w-4 h-4 mb-0.5" />
          Explore
        </button>
        <button
          onClick={() => onNavigate('surpriseme')}
          className={`flex flex-col items-center py-1 px-2 rounded text-[11px] ${currentTab === 'surpriseme' ? 'text-[#C9ADA1] font-bold' : 'text-slate-400'}`}
        >
          <Dices className="w-4 h-4 mb-0.5" />
          Surprise
        </button>
        <button
          onClick={() => onNavigate('creator')}
          className={`flex flex-col items-center py-1 px-2 rounded text-[11px] ${currentTab === 'creator' ? 'text-[#D4AF37] font-bold' : 'text-slate-400'}`}
        >
          <Sparkles className="w-4 h-4 mb-0.5" />
          Creator
        </button>
        <button
          onClick={() => onNavigate('camera-arena')}
          className={`flex flex-col items-center py-1 px-2 rounded text-[11px] ${currentTab === 'camera-arena' ? 'text-[#EAE0CC] font-bold' : 'text-slate-400'}`}
        >
          <Video className="w-4 h-4 mb-0.5" />
          Arena
        </button>
      </div>
    </header>
  );
};
