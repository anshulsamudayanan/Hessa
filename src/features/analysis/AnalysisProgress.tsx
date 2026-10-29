import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Cpu, 
  ArrowRight, 
  Trash2, 
  ShieldCheck, 
  Info,
  Clock,
  Sparkles
} from 'lucide-react';
import { AnalysisJob, Match } from '../../types';
import { api } from '../../services/api/client';
import { GAMES_CONFIG } from '../../config/games';

interface AnalysisProgressProps {
  jobId: string;
  match: Match;
  onProceedToReview: (jobId: string, match: Match) => void;
  onCancel: () => void;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  jobId,
  match,
  onProceedToReview,
  onCancel
}) => {
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const game = GAMES_CONFIG[match.gameId];

  // Poll job status every 1000ms until review_required or completed
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const data = await api.getAnalysisJob(jobId);
        if (isMounted) {
          setJob(data);
          if (data.status === 'queued' || data.status === 'processing') {
            timer = setTimeout(checkStatus, 1000);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to poll analysis job progress');
        }
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  const handleDeleteData = async () => {
    if (!window.confirm('Are you sure you want to delete this recording and all analysis data?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteAnalysisJob(jobId);
      onCancel();
    } catch (err: any) {
      setError('Failed to delete job data: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#d4af37] uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            AI Computer Vision Chamber
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Video Gameplay Analysis
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Job ID: <span className="font-mono text-slate-300">{jobId}</span> • Match: {match.teamA.name} vs {match.teamB.name} ({game?.name})
          </p>
        </div>

        <button
          onClick={handleDeleteData}
          disabled={isDeleting}
          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 cursor-pointer"
          title="Delete video recording & privacy data"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Recording Data</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Status Card */}
      <div className="navy-card rounded-2xl p-8 border border-white/10 space-y-6 shadow-xl">
        
        {/* Status Badge & Animation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {job?.status === 'processing' || job?.status === 'queued' ? (
              <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37]">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
            ) : job?.status === 'review_required' || job?.status === 'completed' ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <AlertCircle className="w-5 h-5" />
              </div>
            )}

            <div>
              <h3 className="text-lg font-bold text-white capitalize">
                Status: {job?.status.replace('_', ' ') || 'Initializing...'}
              </h3>
              <p className="text-xs text-slate-400">
                {job?.statusMessage || 'Connecting to computer vision processor...'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black font-mono text-[#fce09b]">
              {job?.progressPercent || 0}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-[#060b18] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#d4af37] via-[#fce09b] to-emerald-400 transition-all duration-500"
            style={{ width: `${job?.progressPercent || 0}%` }}
          />
        </div>

        {/* Vision Service Mode & Connection Clarity */}
        <div className="p-4 rounded-xl bg-[#060b18] border border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">Vision Detector State:</span>
            {job?.cvServiceConnected ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-bold">
                External Python OpenCV Engine Active
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-300 font-bold">
                Inspection Demo Mode (Clearly Labelled Candidates)
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400 leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5 flex items-start gap-2">
            <Info className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5" />
            <span>
              <strong>Compliance Notice:</strong> In accordance with competition criteria, no simulated events are presented as real AI detections without explicit labelling. Every proposed timestamp requires host confirmation before affecting official scores.
            </span>
          </div>
        </div>

        {/* Next Step Action Button */}
        {(job?.status === 'review_required' || job?.status === 'completed') && (
          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Found <strong className="text-white font-mono">{job.eventsProposedCount}</strong> candidate events for review.
            </div>

            <button
              onClick={() => onProceedToReview(job.id, match)}
              className="gold-button px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-xl animate-pulse"
            >
              <span>Review AI Proposed Events</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>

    </div>
  );
};
