import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Dashboard } from './features/home/Dashboard';
import { TournamentSetup } from './features/tournaments/TournamentSetup';
import { LeaderboardView } from './features/tournaments/LeaderboardView';
import { GameSelection } from './features/games/GameSelection';
import { MatchSetup } from './features/match/MatchSetup';
import { CameraRecorder } from './features/camera/CameraRecorder';
import { AnalysisProgress } from './features/analysis/AnalysisProgress';
import { EventReview } from './features/review/EventReview';
import { MatchResults } from './features/results/MatchResults';
import { VisionServiceDocs } from './features/vision/VisionServiceDocs';

import { CulturalExplorer } from './features/explorer/CulturalExplorer';
import { SurpriseMe } from './features/surpriseme/SurpriseMe';
import { AiGameCreator } from './features/creator/AiGameCreator';
import { UserMajlisModal } from './features/customizer/UserMajlisModal';

import { Tournament, Match, GameId, GameRuleConfig, UserMajlisProfile } from './types';
import { api } from './services/api/client';
import { ALL_GAMES } from './config/games';
import { userProfileStorage } from './services/storage/userProfile';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [userProfile, setUserProfile] = useState<UserMajlisProfile>(() => userProfileStorage.getProfile());
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  const [games, setGames] = useState<GameRuleConfig[]>(ALL_GAMES);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<GameId>('football');

  // Match and Job in progress
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [cameraInitialMode, setCameraInitialMode] = useState<'camera' | 'record' | 'upload'>('camera');

  const [isLoading, setIsLoading] = useState(true);

  // Load initial games, tournaments & matches
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      const [gamesList, tourns, matchesList] = await Promise.all([
        api.getGames().catch(() => ALL_GAMES),
        api.getTournaments(),
        api.getMatches()
      ]);
      if (Array.isArray(gamesList) && gamesList.length > 0) {
        setGames(gamesList);
      }
      setTournaments(tourns || []);
      setRecentMatches(matchesList || []);

      // Check active tournament from localStorage or first in list
      const savedId = localStorage.getItem('fareeg_active_tournament_id');
      if (savedId) {
        const found = tourns.find(t => t.id === savedId);
        if (found) {
          setActiveTournament(found);
          return;
        }
      }
      if (tourns.length > 0 && !activeTournament) {
        setActiveTournament(tourns[0]);
      }
    } catch (e) {
      console.error('Failed to load initial data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (tab: string, meta?: any) => {
    setCurrentTab(tab);
    if (meta?.tournamentId) {
      const found = tournaments.find(t => t.id === meta.tournamentId);
      if (found) setActiveTournament(found);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectGame = (gameId: GameId) => {
    setSelectedGameId(gameId);
    setCurrentTab('match-setup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLaunchArenaFromExplorer = (gameId: GameId) => {
    setSelectedGameId(gameId);
    setCurrentTab('match-setup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGameCreatedAndLaunch = (newGame: GameRuleConfig) => {
    setGames(prev => [newGame, ...prev]);
    setSelectedGameId(newGame.id);
    setCurrentTab('match-setup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTournamentCreated = (newTourn: Tournament) => {
    setTournaments(prev => [newTourn, ...prev]);
    setActiveTournament(newTourn);
    setCurrentTab('leaderboard');
    refreshData();
  };

  const handleStartMatch = (match: Match, startMode: 'camera' | 'record' | 'upload') => {
    setActiveMatch(match);
    setCameraInitialMode(startMode);
    setCurrentTab('camera-arena');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnalysisStarted = (jobId: string, match: Match) => {
    setActiveJobId(jobId);
    setActiveMatch(match);
    setCurrentTab('analysis');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedToReview = (jobId: string, match: Match) => {
    setActiveJobId(jobId);
    setActiveMatch(match);
    setCurrentTab('review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMatchFinalized = (finalizedMatch: Match) => {
    setActiveMatch(finalizedMatch);
    setCurrentTab('match-results');
    refreshData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectMatchForView = (match: Match) => {
    setActiveMatch(match);
    if (match.status === 'completed') {
      setCurrentTab('match-results');
    } else if (match.status === 'reviewing') {
      setCurrentTab('review');
    } else {
      setCurrentTab('camera-arena');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#060b18] text-white flex flex-col font-sans selection:bg-[#D4AF37] selection:text-[#060b18]">
      
      {/* Navigation */}
      <Navbar
        currentTab={currentTab}
        onNavigate={handleNavigate}
        activeTournament={activeTournament}
        userProfile={userProfile}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {currentTab === 'dashboard' && (
          <Dashboard
            games={games}
            tournaments={tournaments}
            activeTournament={activeTournament}
            recentMatches={recentMatches}
            onNavigate={handleNavigate}
            onSelectGame={handleSelectGame}
            onSelectMatch={handleSelectMatchForView}
            onOpenCustomizer={() => setIsCustomizerOpen(true)}
          />
        )}

        {/* Feature 1: Cultural Game Explorer */}
        {currentTab === 'explorer' && (
          <CulturalExplorer
            games={games}
            onSelectGame={handleSelectGame}
            onLaunchArena={handleLaunchArenaFromExplorer}
          />
        )}

        {/* Feature 2: Surprise Me */}
        {currentTab === 'surpriseme' && (
          <SurpriseMe
            games={games}
            onSelectGame={handleSelectGame}
            onLaunchArena={handleLaunchArenaFromExplorer}
          />
        )}

        {/* Feature 3: AI Game Creator & Universal Referee */}
        {currentTab === 'creator' && (
          <AiGameCreator
            onGameCreatedAndLaunch={handleGameCreatedAndLaunch}
            onCancel={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'tournament-setup' && (
          <TournamentSetup
            onTournamentCreated={handleTournamentCreated}
            onCancel={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'tournaments' && (
          <LeaderboardView
            tournaments={tournaments}
            initialTournamentId={activeTournament?.id}
            onNavigateNewTournament={() => setCurrentTab('tournament-setup')}
            onNavigateArena={() => setCurrentTab('games')}
            onSelectMatch={handleSelectMatchForView}
          />
        )}

        {currentTab === 'games' && (
          <GameSelection
            onSelectGame={handleSelectGame}
            onNavigateArena={() => {
              setSelectedGameId('football');
              setCurrentTab('match-setup');
            }}
          />
        )}

        {currentTab === 'match-setup' && (
          <MatchSetup
            initialGameId={selectedGameId}
            games={games}
            tournaments={tournaments}
            activeTournament={activeTournament}
            onStartMatch={handleStartMatch}
            onBack={() => setCurrentTab('games')}
          />
        )}

        {currentTab === 'camera-arena' && activeMatch && (
          <CameraRecorder
            match={activeMatch}
            initialMode={cameraInitialMode}
            onAnalysisStarted={handleAnalysisStarted}
            onBack={() => setCurrentTab('match-setup')}
          />
        )}

        {currentTab === 'camera-arena' && !activeMatch && (
          <MatchSetup
            initialGameId={selectedGameId}
            games={games}
            tournaments={tournaments}
            activeTournament={activeTournament}
            onStartMatch={handleStartMatch}
            onBack={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'analysis' && activeJobId && activeMatch && (
          <AnalysisProgress
            jobId={activeJobId}
            match={activeMatch}
            onProceedToReview={handleProceedToReview}
            onCancel={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'review' && activeMatch && (
          <EventReview
            jobId={activeJobId || undefined}
            match={activeMatch}
            onMatchFinalized={handleMatchFinalized}
            onBack={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'match-results' && activeMatch && (
          <MatchResults
            match={activeMatch}
            onNavigateDashboard={() => setCurrentTab('dashboard')}
            onNavigateLeaderboard={() => setCurrentTab('leaderboard')}
            onStartNewMatch={() => {
              setActiveMatch(null);
              setCurrentTab('games');
            }}
          />
        )}

        {currentTab === 'leaderboard' && (
          <LeaderboardView
            tournaments={tournaments}
            initialTournamentId={activeTournament?.id}
            onNavigateNewTournament={() => setCurrentTab('tournament-setup')}
            onNavigateArena={() => setCurrentTab('games')}
            onSelectMatch={handleSelectMatchForView}
          />
        )}

        {currentTab === 'vision-docs' && (
          <VisionServiceDocs />
        )}
      </main>

      {/* Global Footer */}
      <Footer />

      {/* User Family Majlis & AI Judge Customizer Modal */}
      <UserMajlisModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        onSave={(updated) => setUserProfile(updated)}
      />

    </div>
  );
}
