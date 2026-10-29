import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  X, 
  Play, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  ShieldCheck, 
  Trophy, 
  Sparkles,
  ArrowRight,
  Clock,
  RotateCcw,
  Volume2,
  CheckCheck
} from 'lucide-react';
import { Match, ProposedEvent, ReviewStatus } from '../../types';
import { GAMES_CONFIG } from '../../config/games';
import { api } from '../../services/api/client';
import { soundEffects } from '../../services/audio/whistle';
import { userProfileStorage, JUDGE_PERSONAS } from '../../services/storage/userProfile';

interface EventReviewProps {
  jobId?: string;
  match: Match;
  onMatchFinalized: (match: Match) => void;
  onBack: () => void;
}

export const EventReview: React.FC<EventReviewProps> = ({
  jobId,
  match,
  onMatchFinalized,
  onBack
}) => {
  const [events, setEvents] = useState<ProposedEvent[]>([]);
  const [currentScores, setCurrentScores] = useState<Record<string, number>>(match.scores || {});
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Video player reference for jumping to timestamp
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Manual host event modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualEventType, setManualEventType] = useState('');
  const [manualTeamId, setManualTeamId] = useState(match.teamA.id);
  const [manualTimestamp, setManualTimestamp] = useState(0);
  const [manualPoints, setManualPoints] = useState(1);
  const [manualNotes, setManualNotes] = useState('');

  // Host match finalization notes
  const [hostNotes, setHostNotes] = useState(match.hostNotes || '');
  const [isFinalizing, setIsFinalizing] = useState(false);

  const game = GAMES_CONFIG[match.gameId] || {
    id: match.gameId,
    name: match.gameId.replace('ai_', 'Custom: ').replace('_', ' '),
    arabicName: '',
    scoringRules: []
  };

  // Load events
  useEffect(() => {
    loadEvents();
  }, [match.id, jobId]);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      if (jobId) {
        const res = await api.getJobEvents(jobId);
        setEvents(res.events || []);
      } else {
        const m = await api.getMatch(match.id);
        setEvents(m.events || []);
        setCurrentScores(m.scores || {});
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load proposed match events');
    } finally {
      setIsLoading(false);
    }
  };

  const userProfile = userProfileStorage.getProfile();
  const judgeInfo = JUDGE_PERSONAS[userProfile.judgePersona] || JUDGE_PERSONAS.standard;

  // Confirm or reject event
  const handleReview = async (eventId: string, newStatus: ReviewStatus) => {
    try {
      if (newStatus === 'confirmed') {
        soundEffects.playScoreChime();
      } else {
        soundEffects.playWhistle('short');
      }
      const res = await api.reviewEvent(eventId, newStatus);
      
      // Update local events list
      setEvents(prev => prev.map(e => e.id === eventId ? res.event : e));
      setCurrentScores(res.matchScores);
    } catch (err: any) {
      setError(err.message || 'Failed to review event');
    }
  };

  // 1-Click Accept All AI Judge Decisions
  const handleAcceptAllJudgeDecisions = async () => {
    const pendingEvents = events.filter(e => e.reviewStatus === 'pending');
    if (pendingEvents.length === 0) return;

    soundEffects.playScoreChime();
    setIsLoading(true);
    try {
      for (const evt of pendingEvents) {
        await api.reviewEvent(evt.id, 'confirmed');
      }
      await loadEvents();
    } catch (err: any) {
      setError(err.message || 'Failed to batch confirm AI decisions');
    } finally {
      setIsLoading(false);
    }
  };

  // Jump video player to event timestamp
  const handleJumpToVideo = (timestampSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, timestampSeconds - 1);
      videoRef.current.play().catch(() => {});
    }
  };

  // Add manual host event
  const handleAddManualEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEventType) return;

    try {
      const rule = game?.scoringRules.find(r => r.eventType === manualEventType);
      const res = await api.addHostEvent(match.id, {
        eventType: manualEventType,
        eventLabel: rule ? rule.label : manualEventType,
        teamId: manualTeamId,
        timestampSeconds: manualTimestamp,
        pointsAwarded: manualPoints,
        notes: manualNotes || 'Host manually logged event'
      });

      setEvents(prev => [...prev, res.data]);
      setCurrentScores(res.updatedScores);
      setShowAddModal(false);
      setManualNotes('');
    } catch (err: any) {
      setError(err.message || 'Failed to add host event');
    }
  };

  // Finalize match and calculate official winner
  const handleFinalize = async () => {
    setIsFinalizing(true);
    setError(null);
    try {
      const { match: finalizedMatch } = await api.finalizeMatch(match.id, {
        hostNotes: hostNotes.trim() || undefined,
        durationSeconds: match.durationSeconds || 60
      });

      onMatchFinalized(finalizedMatch);
    } catch (err: any) {
      setError(err.message || 'Failed to finalize match');
    } finally {
      setIsFinalizing(false);
    }
  };

  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true;
    return e.reviewStatus === filter;
  });

  const pendingCount = events.filter(e => e.reviewStatus === 'pending').length;
  const confirmedCount = events.filter(e => e.reviewStatus === 'confirmed').length;

  const scoreA = currentScores[match.teamA.id] || 0;
  const scoreB = currentScores[match.teamB.id] || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#d4af37] uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            Host-In-The-Loop Judicial Review
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Review Gameplay Events</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#d4af37]/20 text-[#fce09b] font-bold font-arabic">
              {game?.name} ({game?.arabicName})
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review every AI-detected candidate event. Only confirmed events update the official score.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-2 cursor-pointer self-start sm:self-auto border border-white/10"
        >
          <Plus className="w-4 h-4 text-[#d4af37]" />
          <span>Add Host Manual Event</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Live Match Scoreboard Bar */}
      <div className="navy-card rounded-2xl p-5 border border-[#d4af37]/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: match.teamA.color }} />
            <div>
              <div className="text-sm font-extrabold text-white">{match.teamA.name}</div>
              <div className="text-[10px] text-slate-400">Team Side A</div>
            </div>
          </div>

          <div className="px-6 py-2 rounded-xl bg-[#060b18] border border-white/10 flex items-center gap-3 font-mono">
            <span className="text-3xl font-black text-[#fce09b]">{scoreA}</span>
            <span className="text-slate-600 text-xl">:</span>
            <span className="text-3xl font-black text-[#fce09b]">{scoreB}</span>
          </div>

          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-extrabold text-white">{match.teamB.name}</div>
              <div className="text-[10px] text-slate-400">Team Side B</div>
            </div>
            <span className="w-4 h-4 rounded-full" style={{ backgroundColor: match.teamB.color }} />
          </div>
        </div>

        {/* Quick Review Progress */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right text-xs">
            <div className="text-slate-300">
              <strong className="text-white font-mono">{confirmedCount}</strong> Confirmed • <strong className="text-amber-400 font-mono">{pendingCount}</strong> Pending
            </div>
            <div className="text-[11px] text-slate-500">
              {pendingCount === 0 ? 'All events resolved' : 'Pending host review'}
            </div>
          </div>

          {pendingCount > 0 && (
            <button
              onClick={handleAcceptAllJudgeDecisions}
              disabled={isLoading}
              className="px-4 py-3 rounded-xl bg-[#4D6A6D] hover:bg-[#4D6A6D]/80 border border-[#A0A083]/40 text-[#EAE0CC] font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
              title="1-Click accept all pending events ruled by AI Judge"
            >
              <CheckCheck className="w-4 h-4 text-[#FCE09B]" />
              <span>Accept All AI ({pendingCount})</span>
            </button>
          )}

          <button
            onClick={handleFinalize}
            disabled={isFinalizing}
            className="gold-button px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
          >
            <Trophy className="w-4 h-4" />
            <span>Finalize Match Score</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Video Player + Event List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Video Playback & Timestamp seek (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="navy-card rounded-2xl p-4 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-[#d4af37]" />
                Gameplay Footage
              </span>
              <span className="text-slate-500 text-[11px]">Click event to jump timestamp</span>
            </div>

            <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-white/10">
              {match.videoUrl ? (
                <video
                  ref={videoRef}
                  src={match.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 text-xs text-slate-500">
                  <Play className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p>No video footage attached to this match session.</p>
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 p-2.5 rounded-lg bg-[#060b18] border border-white/5 space-y-1">
              <span className="font-bold text-slate-300">Host Scrutiny Tip:</span>
              <p>Seek video to inspect frame evidence. If detector confidence is below 85% or unclear, make host decision manually.</p>
            </div>
          </div>

          {/* Host Notes Field */}
          <div className="navy-card rounded-2xl p-4 border border-white/10 space-y-2">
            <label className="text-xs font-bold uppercase text-slate-300 block">
              Host / Umpire Notes (Optional)
            </label>
            <textarea
              value={hostNotes}
              onChange={e => setHostNotes(e.target.value)}
              placeholder="e.g. Clean sportsmanship, disputed marble settled by mutual family agreement."
              className="w-full p-3 rounded-xl bg-[#060b18] border border-white/10 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-[#d4af37] resize-none h-20"
            />
          </div>
        </div>

        {/* Right: Events List & Review Cards (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Filter Pills */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#060b18] border border-white/10 text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${filter === 'all' ? 'bg-[#d4af37] text-[#060b18]' : 'text-slate-400 hover:text-white'}`}
              >
                All ({events.length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${filter === 'pending' ? 'bg-amber-400 text-[#060b18]' : 'text-slate-400 hover:text-white'}`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setFilter('confirmed')}
                className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${filter === 'confirmed' ? 'bg-emerald-400 text-[#060b18]' : 'text-slate-400 hover:text-white'}`}
              >
                Confirmed ({confirmedCount})
              </button>
              <button
                onClick={() => setFilter('rejected')}
                className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${filter === 'rejected' ? 'bg-rose-400 text-[#060b18]' : 'text-slate-400 hover:text-white'}`}
              >
                Rejected ({events.filter(e => e.reviewStatus === 'rejected').length})
              </button>
            </div>

            <button
              onClick={loadEvents}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Events Stack */}
          {isLoading ? (
            <div className="navy-card rounded-2xl p-8 text-center text-slate-400 text-xs">
              Loading proposed events...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="navy-card rounded-2xl p-8 text-center text-slate-400 text-xs space-y-3">
              <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
              <p>No events found for current filter.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="gold-button px-4 py-2 rounded-lg text-xs"
              >
                + Add Manual Host Event
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map(event => {
                const isPending = event.reviewStatus === 'pending';
                const isConfirmed = event.reviewStatus === 'confirmed';
                const isRejected = event.reviewStatus === 'rejected';

                const minutes = Math.floor(event.timestampSeconds / 60);
                const seconds = Math.floor(event.timestampSeconds % 60);
                const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                return (
                  <div
                    key={event.id}
                    className={`navy-card rounded-xl p-4 border transition-all ${
                      isConfirmed
                        ? 'border-emerald-500/40 bg-emerald-950/10'
                        : isRejected
                        ? 'border-rose-500/30 bg-rose-950/10 opacity-75'
                        : 'border-white/10 hover:border-[#d4af37]/40'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      {/* Left: Event Details */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isConfirmed
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                              : isRejected
                              ? 'bg-rose-950/80 text-rose-400 border border-rose-500/40'
                              : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                          }`}>
                            {event.reviewStatus}
                          </span>

                          <button
                            onClick={() => handleJumpToVideo(event.timestampSeconds)}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-[#fce09b] hover:text-white px-2 py-0.5 rounded bg-black/40 hover:bg-black/60 cursor-pointer transition-colors"
                            title="Jump video to timestamp"
                          >
                            <Clock className="w-3 h-3 text-[#d4af37]" />
                            <span>{timeStr}</span>
                          </button>

                          {event.confidence !== undefined && (
                            <span className="text-[10px] font-mono text-slate-400">
                              {(event.confidence * 100).toFixed(0)}% conf
                            </span>
                          )}

                          <span className="text-[10px] text-slate-500 italic">
                            ({event.source.replace('_', ' ')})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">
                            {event.eventLabel}
                          </h4>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/5 text-slate-300">
                            +{event.pointsAwarded} pt
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <span>Team: <strong className="text-slate-200">{event.teamName}</strong></span>
                          {event.playerName && (
                            <>
                              <span>•</span>
                              <span>Player: <strong className="text-slate-200">{event.playerName}</strong></span>
                            </>
                          )}
                        </div>

                        {/* AI Judge Formal Ruling Box */}
                        {(event.judgeRuling || event.ruleCited) && (
                          <div className="mt-2 p-2.5 rounded-xl bg-[#4D6A6D]/15 border border-[#4D6A6D]/35 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-[#FCE09B] font-bold text-[11px]">
                              <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                              <span>AI Judge Verdict ({event.aiJudgePersona || judgeInfo.name}):</span>
                              {event.ruleCited && (
                                <span className="text-[10px] font-mono text-[#A0A083] font-normal">
                                  • {event.ruleCited}
                                </span>
                              )}
                            </div>
                            {event.judgeRuling && (
                              <p className="text-[#EAE0CC] text-[11px] italic leading-relaxed pl-5">
                                "{event.judgeRuling}"
                              </p>
                            )}
                          </div>
                        )}

                        {event.notes && !event.judgeRuling && (
                          <p className="text-[11px] text-slate-500 italic pt-1">
                            {event.notes}
                          </p>
                        )}
                      </div>

                      {/* Right: Confirmation Buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleReview(event.id, 'confirmed')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isConfirmed
                              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                              : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isConfirmed ? 'Confirmed' : 'Confirm'}</span>
                        </button>

                        <button
                          onClick={() => handleReview(event.id, 'rejected')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isRejected
                              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                              : 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{isRejected ? 'Rejected' : 'Reject'}</span>
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

      {/* Manual Host Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="navy-card rounded-2xl p-6 border border-[#d4af37]/40 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#d4af37]" />
                Add Host Manual Event
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualEvent} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">
                  Event Type
                </label>
                <select
                  value={manualEventType}
                  onChange={e => {
                    setManualEventType(e.target.value);
                    const rule = game?.scoringRules.find(r => r.eventType === e.target.value);
                    if (rule) setManualPoints(rule.points);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#060b18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#d4af37]"
                  required
                >
                  <option value="">Select event rule...</option>
                  {game?.scoringRules.map(rule => (
                    <option key={rule.eventType} value={rule.eventType}>
                      {rule.label} (+{rule.points} pt)
                    </option>
                  ))}
                  <option value="custom_host_point">Custom Host Award (+1 pt)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">
                  Award To Team
                </label>
                <select
                  value={manualTeamId}
                  onChange={e => setManualTeamId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#060b18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#d4af37]"
                >
                  <option value={match.teamA.id}>{match.teamA.name}</option>
                  <option value={match.teamB.id}>{match.teamB.name}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">
                    Timestamp (seconds)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={manualTimestamp}
                    onChange={e => setManualTimestamp(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#060b18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">
                    Points Awarded
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={manualPoints}
                    onChange={e => setManualPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#060b18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">
                  Host Note / Reason
                </label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={e => setManualNotes(e.target.value)}
                  placeholder="e.g. Clean goal scored outside camera view"
                  className="w-full px-3 py-2 rounded-xl bg-[#060b18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gold-button px-5 py-2 rounded-lg text-xs font-bold"
                >
                  Add Confirmed Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
