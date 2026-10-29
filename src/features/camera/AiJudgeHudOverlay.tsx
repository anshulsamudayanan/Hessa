import React from 'react';
import { ShieldCheck, Volume2, Sparkles, X, CheckCircle2, Crosshair, Target } from 'lucide-react';

interface AiJudgeHudOverlayProps {
  gameId: string;
  judgeName: string;
  judgePersona: string;
  isRecording: boolean;
  liveRulingToast: {
    label: string;
    text: string;
    confidence: number;
    team: string;
    points: number;
  } | null;
  onDismissToast: () => void;
  onBlowWhistle: () => void;
}

export const AiJudgeHudOverlay: React.FC<AiJudgeHudOverlayProps> = ({
  gameId,
  judgeName,
  judgePersona,
  isRecording,
  liveRulingToast,
  onDismissToast,
  onBlowWhistle
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 overflow-hidden select-none">
      
      {/* Top HUD Telemetry Bar */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-[#d4af37]/40 text-xs shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-extrabold text-[#fce09b] tracking-wider text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37]" />
              AI JUDGE: {judgeName.toUpperCase()}
            </span>
            <span className="text-slate-400 font-mono text-[10px]">
              [{judgePersona.toUpperCase()}]
            </span>
          </div>

          <button
            onClick={onBlowWhistle}
            title="Blow Referee Whistle"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-[#d4af37]/30 border border-white/20 hover:border-[#d4af37] text-white text-[11px] font-bold cursor-pointer transition-all shadow"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#d4af37]" />
            <span className="hidden sm:inline">Whistle</span>
          </button>
        </div>

        {/* Live CV Tracking State */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-300">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/60 border border-white/10">
            <Crosshair className="w-3 h-3 text-[#d4af37]" />
            <span>PLANE: CALIBRATED (60FPS)</span>
          </div>
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/80 border border-red-500/50 text-red-300 font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>AI SCAN ACTIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Center: Dynamic Game-Specific Computer Vision Graphic Overlays */}
      <div className="relative w-full h-full flex items-center justify-center my-2 pointer-events-none">
        
        {/* FOOTBALL CV OVERLAY */}
        {gameId === 'football' && (
          <div className="relative w-[85%] h-[75%] border border-[#d4af37]/30 rounded-lg flex items-center justify-center">
            {/* Goal Line & Net Wireframe */}
            <div className="absolute inset-x-8 top-12 bottom-0 border-2 border-dashed border-emerald-400/40 rounded-t-xl" />
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            
            {/* Ball Reticle */}
            <div className="absolute top-[45%] left-[55%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full border-2 border-emerald-400/80 animate-ping absolute" />
              <div className="w-12 h-12 rounded-full border border-emerald-400 flex items-center justify-center bg-emerald-500/10">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              <span className="text-[9px] font-mono text-emerald-300 bg-black/70 px-1.5 py-0.5 rounded mt-1">
                BALL: TRACKED (96%)
              </span>
            </div>

            <div className="absolute bottom-2 left-4 text-[9px] font-mono text-emerald-400 bg-black/60 px-2 py-0.5 rounded">
              GOAL-PLANE DETECTION: ARMED
            </div>
          </div>
        )}

        {/* AL TEELA (MARBLES) CV OVERLAY */}
        {gameId === 'al_teela' && (
          <div className="relative w-72 h-72 rounded-full border-2 border-dashed border-[#d4af37]/60 flex items-center justify-center animate-pulse">
            {/* 45cm Ring Marker */}
            <div className="w-56 h-56 rounded-full border border-[#d4af37]/30 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border border-amber-400 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              </div>
            </div>

            {/* Target Marble Tracking Reticle */}
            <div className="absolute top-10 right-14 flex items-center gap-1">
              <div className="w-4 h-4 rounded-full border border-rose-400 animate-ping" />
              <span className="text-[9px] font-mono text-amber-200 bg-black/70 px-1 rounded">
                TARGET MARBLE #1
              </span>
            </div>

            <div className="absolute -bottom-6 text-[10px] font-mono text-[#fce09b] bg-black/80 px-2.5 py-0.5 rounded-full border border-[#d4af37]/30">
              AL TEELA ARENA: 45CM RADIUS LOCKED
            </div>
          </div>
        )}

        {/* AL DAMA (STRATEGY BOARD) CV OVERLAY */}
        {gameId === 'al_dama' && (
          <div className="relative w-80 h-80 grid grid-cols-8 grid-rows-8 border-2 border-[#d4af37]/40 rounded-lg p-1 bg-black/20 backdrop-blur-[1px]">
            {Array.from({ length: 64 }).map((_, i) => (
              <div 
                key={i} 
                className={`border border-[#d4af37]/15 ${i === 27 || i === 36 ? 'bg-[#d4af37]/20 border-[#d4af37]' : ''}`} 
              />
            ))}
            <div className="absolute -bottom-6 inset-x-0 text-center">
              <span className="text-[10px] font-mono text-[#fce09b] bg-black/80 px-2.5 py-0.5 rounded-full border border-[#d4af37]/30">
                8x8 MATRIX REGISTERED • ACTIVE CROWN LANES
              </span>
            </div>
          </div>
        )}

        {/* AL LAQAF (STONE TOSSING) CV OVERLAY */}
        {gameId === 'al_laqaf' && (
          <div className="relative w-80 h-72 flex flex-col items-center justify-between">
            {/* Parabolic flight arc */}
            <svg className="w-full h-44 overflow-visible" viewBox="0 0 300 160">
              <path
                d="M 30,150 Q 150,10 270,150"
                fill="none"
                stroke="#d4af37"
                strokeWidth="2"
                strokeDasharray="6 4"
                className="animate-pulse"
              />
              <circle cx="150" cy="80" r="6" fill="#FCE09B" />
              <text x="165" y="80" fill="#EAE0CC" fontSize="10" fontFamily="monospace">APEX: 1.4M</text>
            </svg>

            <div className="w-48 h-16 border-2 border-emerald-400/50 rounded-xl flex items-center justify-center bg-emerald-500/10">
              <span className="text-[10px] font-mono text-emerald-300">CATCHMENT ZONE ARMED</span>
            </div>
          </div>
        )}

        {/* QIF (AGILITY TAG) CV OVERLAY */}
        {gameId === 'qif' && (
          <div className="relative w-full h-[80%] border-2 border-[#d4af37]/30 rounded-2xl flex items-center justify-center">
            <div className="absolute inset-y-0 left-1/2 w-0.5 bg-rose-400/80 shadow-[0_0_10px_rgba(244,63,94,0.6)]" />
            <div className="absolute top-4 left-6 text-[10px] font-mono text-emerald-300 bg-black/60 px-2 py-0.5 rounded">
              DEFENDER SAFE ZONE
            </div>
            <div className="absolute top-4 right-6 text-[10px] font-mono text-rose-300 bg-black/60 px-2 py-0.5 rounded">
              CHASER ACTIVE ZONE
            </div>
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-amber-400 animate-spin" />
          </div>
        )}

        {/* GENERIC / CUSTOM GAME OVERLAY */}
        {gameId !== 'football' && gameId !== 'al_teela' && gameId !== 'al_dama' && gameId !== 'al_laqaf' && gameId !== 'qif' && (
          <div className="relative w-[80%] h-[75%] border border-[#d4af37]/40 rounded-2xl flex items-center justify-center">
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[#d4af37]" />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[#d4af37]" />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[#d4af37]" />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[#d4af37]" />
            <span className="text-[10px] font-mono text-[#fce09b] bg-black/70 px-3 py-1 rounded-full border border-[#d4af37]/30">
              CUSTOM ARENA BOUNDARY: ACTIVE SCAN
            </span>
          </div>
        )}

      </div>

      {/* Bottom Live Ruling Toast (Triggered on detector trigger / simulation) */}
      {liveRulingToast && (
        <div className="pointer-events-auto self-center max-w-lg w-full bg-[#0a1326]/95 border-2 border-[#d4af37] rounded-xl p-3.5 shadow-2xl backdrop-blur-md animate-bounce-once">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#d4af37] text-black font-black flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    {liveRulingToast.label}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold font-mono">
                    +{(liveRulingToast.points)} PTS
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {(liveRulingToast.confidence * 100).toFixed(0)}% CONF
                  </span>
                </div>
                <p className="text-xs text-[#EAE0CC] font-medium leading-snug">
                  {liveRulingToast.text}
                </p>
                <p className="text-[10px] text-slate-400">
                  Beneficiary: <strong className="text-white">{liveRulingToast.team}</strong> • Added to Match Review
                </p>
              </div>
            </div>

            <button
              onClick={onDismissToast}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Corner Watermark */}
      <div className="w-full flex justify-between items-center text-[9px] font-mono text-slate-500 pt-1 pointer-events-none">
        <span>FAREEG AI OPTICAL CV ENGINE</span>
        <span>VAR VERIFICATION PROTOCOL 2.4</span>
      </div>

    </div>
  );
};
