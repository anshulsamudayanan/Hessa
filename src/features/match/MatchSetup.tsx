import React, { useState } from 'react';
import { 
  Camera, 
  Upload, 
  Video, 
  Users, 
  AlertCircle, 
  ShieldCheck, 
  CheckCircle2, 
  Info,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { GameId, Tournament, Match, Team, GameRuleConfig } from '../../types';
import { GAMES_CONFIG } from '../../config/games';
import { api } from '../../services/api/client';
import { userProfileStorage } from '../../services/storage/userProfile';

interface MatchSetupProps {
  initialGameId?: GameId;
  games?: GameRuleConfig[];
  tournaments: Tournament[];
  activeTournament: Tournament | null;
  onStartMatch: (match: Match, startMode: 'camera' | 'record' | 'upload') => void;
  onBack: () => void;
}

export const MatchSetup: React.FC<MatchSetupProps> = ({
  initialGameId = 'football',
  games,
  tournaments,
  activeTournament,
  onStartMatch,
  onBack
}) => {
  const userProfile = userProfileStorage.getProfile();
  const allAvailableGames = games && games.length > 0 ? games : Object.values(GAMES_CONFIG);
  const [selectedGameId, setSelectedGameId] = useState<GameId>(initialGameId);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    activeTournament ? activeTournament.id : tournaments[0]?.id || ''
  );

  const currentTournament = tournaments.find(t => t.id === selectedTournamentId) || activeTournament;

  const defaultTeamA = currentTournament?.teams[0] || {
    id: 'team-a',
    name: `${userProfile.emblemEmoji} ${userProfile.familyClanName}`,
    color: userProfile.primaryColor || '#4D6A6D',
    players: userProfile.defaultRoster.slice(0, 2).map((name, i) => ({ id: `p${i+1}`, name }))
  };

  const defaultTeamB = currentTournament?.teams[1] || {
    id: 'team-b',
    name: 'Desert Knights',
    color: '#3B82F6',
    players: [{ id: 'p3', name: 'Hamad' }, { id: 'p4', name: 'Sultan' }]
  };

  const [teamAId, setTeamAId] = useState<string>(defaultTeamA.id);
  const [teamBId, setTeamBId] = useState<string>(defaultTeamB.id);

  // Custom team names for quick matches if no tournament
  const [customTeamAName, setCustomTeamAName] = useState(defaultTeamA.name);
  const [customTeamBName, setCustomTeamBName] = useState(defaultTeamB.name);

  const [matchId] = useState<string>(
    `match-${Date.now().toString(36).toUpperCase()}`
  );

  const [familyConsentConfirmed, setFamilyConsentConfirmed] = useState(false);
  const [teamsConfirmed, setTeamsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const selectedGame = allAvailableGames.find(g => g.id === selectedGameId) || allAvailableGames[0];

  const handleAction = async (startMode: 'camera' | 'record' | 'upload') => {
    setError(null);

    if (!teamsConfirmed) {
      setError('Please review and confirm participating teams before proceeding.');
      return;
    }

    if (!familyConsentConfirmed) {
      setError('Please confirm family recording and privacy permission.');
      return;
    }

    if (currentTournament && teamAId === teamBId) {
      setError('Team A and Team B must be different teams.');
      return;
    }

    setIsCreating(true);
    try {
      let teamAObj: any;
      let teamBObj: any;

      if (currentTournament) {
        teamAObj = currentTournament.teams.find(t => t.id === teamAId) || {
          name: customTeamAName,
          color: '#D4AF37'
        };
        teamBObj = currentTournament.teams.find(t => t.id === teamBId) || {
          name: customTeamBName,
          color: '#3B82F6'
        };
      } else {
        teamAObj = {
          name: customTeamAName.trim() || 'Team A',
          color: '#D4AF37'
        };
        teamBObj = {
          name: customTeamBName.trim() || 'Team B',
          color: '#3B82F6'
        };
      }

      const createdMatch = await api.createMatch({
        tournamentId: currentTournament?.id,
        gameId: selectedGameId,
        teamA: teamAObj,
        teamB: teamBObj
      });

      onStartMatch(createdMatch, startMode);
    } catch (err: any) {
      setError(err.message || 'Failed to create match session.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Games
          </button>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Match Setup & Arena Chamber</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/30 text-[#fce09b] font-mono">
              ID: {matchId}
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure participating teams, review specialized camera angles, and confirm recording permission.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Match & Team Selection (2 Cols) */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Game & Tournament Selector */}
          <div className="navy-card rounded-xl p-6 border border-white/10 space-y-4">
            <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#d4af37]/20 text-[#fce09b] text-xs flex items-center justify-center font-bold">1</span>
              Game & Tournament Selection
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
                  Selected Game
                </label>
                <select
                  value={selectedGameId}
                  onChange={e => setSelectedGameId(e.target.value as GameId)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#060b18] border border-white/10 text-white text-sm focus:outline-none focus:border-[#d4af37]"
                >
                  {allAvailableGames.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.flagEmoji ? `${g.flagEmoji} ` : ''}{g.name} ({g.arabicName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
                  Tournament Context
                </label>
                <select
                  value={selectedTournamentId}
                  onChange={e => setSelectedTournamentId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#060b18] border border-white/10 text-white text-sm focus:outline-none focus:border-[#d4af37]"
                >
                  <option value="">Quick Match (Friendly Exhibition)</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Participating Teams Confirmation */}
          <div className="navy-card rounded-xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#d4af37]/20 text-[#fce09b] text-xs flex items-center justify-center font-bold">2</span>
                Participating Teams Confirmation
              </h2>
              <span className="text-xs text-amber-400 font-semibold">
                *Required before recording
              </span>
            </div>

            {currentTournament ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#060b18] border border-white/10 space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Team 1 (Side A)</label>
                  <select
                    value={teamAId}
                    onChange={e => setTeamAId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b1428] border border-white/10 text-white text-sm"
                  >
                    {currentTournament.teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-400">
                    Roster: {currentTournament.teams.find(t => t.id === teamAId)?.players.map(p => p.name).join(', ') || 'Team Players'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#060b18] border border-white/10 space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Team 2 (Side B)</label>
                  <select
                    value={teamBId}
                    onChange={e => setTeamBId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0b1428] border border-white/10 text-white text-sm"
                  >
                    {currentTournament.teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-400">
                    Roster: {currentTournament.teams.find(t => t.id === teamBId)?.players.map(p => p.name).join(', ') || 'Team Players'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Team A Name</label>
                  <input
                    type="text"
                    value={customTeamAName}
                    onChange={e => setCustomTeamAName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#060b18] border border-white/10 text-white text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase">Team B Name</label>
                  <input
                    type="text"
                    value={customTeamBName}
                    onChange={e => setCustomTeamBName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#060b18] border border-white/10 text-white text-sm"
                  />
                </div>
              </div>
            )}

            {/* Checkbox: User confirms participating teams */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/10 cursor-pointer hover:bg-white/[0.04]">
              <input
                type="checkbox"
                checked={teamsConfirmed}
                onChange={e => setTeamsConfirmed(e.target.checked)}
                className="mt-0.5 accent-[#d4af37] w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-slate-200 leading-relaxed">
                I confirm that the selected teams and players above are active participants for this match.
              </span>
            </label>
          </div>

          {/* Privacy & Family Recording Consent */}
          <div className="navy-card rounded-xl p-6 border border-white/10 space-y-3">
            <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Family Recording & Privacy Consent
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              In accordance with child protection and family competition guidelines, videos recorded in this applet remain under host supervision, are not published publicly, and can be deleted at any time.
            </p>

            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 cursor-pointer hover:bg-emerald-950/30">
              <input
                type="checkbox"
                checked={familyConsentConfirmed}
                onChange={e => setFamilyConsentConfirmed(e.target.checked)}
                className="mt-0.5 accent-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-emerald-200 font-medium leading-relaxed">
                I confirm that all participants (and parents/guardians of minors) have granted permission to be recorded for gameplay judging.
              </span>
            </label>
          </div>

        </div>

        {/* Right Column: Game Camera Guide & Action Buttons */}
        <div className="space-y-6">
          
          {/* Camera Instructions Card */}
          <div className="navy-card rounded-xl p-6 border border-[#d4af37]/30 space-y-4">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#d4af37]" />
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                Camera Setup: {selectedGame.name}
              </h3>
            </div>

            <div className="p-3 rounded-lg bg-[#060b18] border border-white/5 space-y-2 text-xs">
              <p className="text-[#fce09b] font-bold">
                {selectedGame.recommendedAngle}
              </p>
              <p className="text-slate-300 leading-relaxed">
                {selectedGame.cameraSetupInstructions}
              </p>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1">
              <div className="font-bold text-slate-300">Tips for AI Detector accuracy:</div>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Avoid backlighting or direct sun glare.</li>
                <li>Keep camera stationary (use tripod or flat surface).</li>
                <li>Ensure playing perimeter lines are clearly in frame.</li>
              </ul>
            </div>
          </div>

          {/* Action Launch Buttons */}
          <div className="navy-card rounded-xl p-6 border border-white/10 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Choose Capture Mode:
            </h4>

            {/* 1. Set Up Camera */}
            <button
              onClick={() => handleAction('camera')}
              disabled={isCreating}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-white/10 transition-colors"
            >
              <Camera className="w-4 h-4 text-[#d4af37]" />
              <span>Set Up & Test Camera Feed</span>
            </button>

            {/* 2. Direct Record Match */}
            <button
              onClick={() => handleAction('record')}
              disabled={isCreating}
              className="w-full py-3.5 rounded-xl gold-button text-xs font-black tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Video className="w-4 h-4" />
              <span>Record Live Match</span>
            </button>

            {/* 3. Upload Existing Video */}
            <button
              onClick={() => handleAction('upload')}
              disabled={isCreating}
              className="w-full py-3 rounded-xl bg-[#0a1532] hover:bg-[#10204a] text-slate-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-white/10 transition-colors"
            >
              <Upload className="w-4 h-4 text-blue-400" />
              <span>Upload Existing Video File</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
