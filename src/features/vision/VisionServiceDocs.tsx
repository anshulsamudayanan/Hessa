import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Code2, 
  Layers, 
  ExternalLink,
  Send,
  FileCode2,
  Copy
} from 'lucide-react';
import { api } from '../../services/api/client';

export const VisionServiceDocs: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [serviceUrl, setServiceUrl] = useState('http://localhost:8000');
  const [isChecking, setIsChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkServiceStatus();
  }, []);

  const checkServiceStatus = async () => {
    setIsChecking(true);
    try {
      const data = await api.getCvServiceStatus();
      setStatus(data);
      if (data.url) setServiceUrl(data.url);
    } catch (e) {
      console.warn('Status check failed:', e);
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdateUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    try {
      await api.updateCvServiceConfig(serviceUrl);
      await checkServiceStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setIsChecking(false);
    }
  };

  const sampleWebhookPayload = `{
  "match_id": "match-demo-001",
  "game": "al_teela",
  "events": [
    {
      "event_id": "evt-cv-101",
      "event_type": "marble_knockout",
      "timestamp_seconds": 18.5,
      "confidence": 0.94,
      "team_id": "team-falcons",
      "metadata": {
        "detector_name": "detectors/al_teela.py",
        "notes": "Target marble displaced outside boundary ring (radius 60cm)"
      }
    }
  ]
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sampleWebhookPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#d4af37] uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            Computer Vision Architecture
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Python OpenCV Vision Service Contract
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            FAREEG AI decouples tournament management and camera acquisition from computer vision inference. A separate Python FastAPI microservice can be connected at any time without rebuilding the application.
          </p>
        </div>

        <button
          onClick={checkServiceStatus}
          disabled={isChecking}
          className="gold-button px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>Ping Service</span>
        </button>
      </div>

      {/* Live Service Connection Bar */}
      <div className="navy-card rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              status?.isConnected 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}>
              <Cpu className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">External Python Vision Service</h3>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  status?.isConnected
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                }`}>
                  {status?.isConnected ? 'ONLINE & CONNECTED' : 'STANDALONE / DISCONNECTED'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {status?.isConnected
                  ? 'Ready to receive video feeds and stream real-time detection events.'
                  : 'App operates smoothly in inspection/demonstration mode. Ready for future Python microservice.'}
              </p>
            </div>
          </div>
        </div>

        {/* Endpoint Config Form */}
        <form onSubmit={handleUpdateUrl} className="flex gap-2 pt-2 border-t border-white/5">
          <input
            type="text"
            value={serviceUrl}
            onChange={e => setServiceUrl(e.target.value)}
            placeholder="http://localhost:8000"
            className="flex-1 px-3 py-2 rounded-xl bg-[#060b18] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[#d4af37]"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
          >
            Update Endpoint
          </button>
        </form>
      </div>

      {/* 5 Specialized Detectors Catalog */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#d4af37]" />
          <span>Game-Specific OpenCV Detectors</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              id: 'football',
              name: 'Football Detector',
              module: 'detectors/football.py',
              tech: 'YOLOv8 + Goal Homography',
              desc: 'Ball trajectory polynomial fitting across frames and 3D crossing evaluation of the goalpost plane.'
            },
            {
              id: 'al_teela',
              name: 'Al Teela Detector',
              module: 'detectors/al_teela.py',
              tech: 'Hough Circles + Collision Impulse',
              desc: 'Overhead ring detection, shooter flick tracking, and marble displacement outside the boundary.'
            },
            {
              id: 'al_dama',
              name: 'Al Dama Detector',
              module: 'detectors/al_dama.py',
              tech: 'Perspective Transform + Grid ROI',
              desc: 'Warps 64-square board to orthogonal top-down plane and validates jump captures and crowned kings.'
            },
            {
              id: 'al_laqaf',
              name: 'Al Laqaf Detector',
              module: 'detectors/al_laqaf.py',
              tech: 'MediaPipe Hands + Projectile Arc',
              desc: 'Tracks wrist and palm landmark gestures, airborne pebble flight arc, and clean hand catches.'
            },
            {
              id: 'qif',
              name: 'Qif (Freeze Tag) Detector',
              module: 'detectors/qif.py',
              tech: 'Pose Estimation + Velocity Analysis',
              desc: 'Measures body velocity drop post-"Qif!" vocal cue and calculates tagger proximity bounding distance.'
            }
          ].map(det => (
            <div key={det.id} className="navy-card rounded-xl p-5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-[#d4af37] px-2 py-0.5 rounded bg-[#d4af37]/10 font-mono">
                  {det.module}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">READY</span>
              </div>
              <h4 className="text-base font-bold text-white">{det.name}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{det.desc}</p>
              <div className="text-[11px] text-[#fce09b] font-mono pt-1 border-t border-white/5">
                Pipeline: {det.tech}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Specification & Ingestion Code */}
      <div className="navy-card rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-[#d4af37]" />
            <h3 className="text-base font-bold text-white">
              Webhook Ingestion Contract (`POST /api/cv-service/webhook`)
            </h3>
          </div>
          <button
            onClick={copyToClipboard}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'Copied!' : 'Copy Payload'}</span>
          </button>
        </div>

        <p className="text-xs text-slate-400">
          When the external Python service analyzes video frames, it delivers verified events to FAREEG AI via this HTTP webhook payload:
        </p>

        <pre className="p-4 rounded-xl bg-[#060b18] border border-white/10 text-xs font-mono text-emerald-300 overflow-x-auto">
          {sampleWebhookPayload}
        </pre>
      </div>

    </div>
  );
};
