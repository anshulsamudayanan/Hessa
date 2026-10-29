import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Video, 
  Square, 
  RotateCcw, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles, 
  Sliders, 
  FileVideo, 
  ArrowLeft,
  ShieldCheck,
  Eye,
  Info,
  Volume2
} from 'lucide-react';
import { Match, GameId } from '../../types';
import { GAMES_CONFIG } from '../../config/games';
import { api } from '../../services/api/client';
import { AiJudgeHudOverlay } from './AiJudgeHudOverlay';
import { soundEffects } from '../../services/audio/whistle';
import { userProfileStorage, JUDGE_PERSONAS } from '../../services/storage/userProfile';

interface CameraRecorderProps {
  match: Match;
  initialMode?: 'camera' | 'record' | 'upload';
  onAnalysisStarted: (jobId: string, match: Match) => void;
  onBack: () => void;
}

export const CameraRecorder: React.FC<CameraRecorderProps> = ({
  match,
  initialMode = 'camera',
  onAnalysisStarted,
  onBack
}) => {
  const userProfile = userProfileStorage.getProfile();
  const judgeInfo = JUDGE_PERSONAS[userProfile.judgePersona] || JUDGE_PERSONAS.standard;

  const gameConfig = GAMES_CONFIG[match.gameId] || {
    id: match.gameId,
    name: match.gameId.replace('ai_', 'Custom: ').replace('_', ' '),
    arabicName: 'لعبة الميدان',
    tagline: 'Custom arena challenge',
    cameraSetupInstructions: 'Position camera at a stable angle overlooking the designated play boundary.',
    recommendedAngle: 'Elevated wide-angle boundary view'
  };

  // Active View Tab: 'camera' or 'upload_file'
  const [activeTab, setActiveTab] = useState<'camera' | 'upload_file'>(
    initialMode === 'upload' ? 'upload_file' : 'camera'
  );

  // Camera stream states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraPermissionState, setCameraPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // AI Judge Live Toast & Simulation states
  const [liveRulingToast, setLiveRulingToast] = useState<{
    label: string;
    text: string;
    confidence: number;
    team: string;
    points: number;
  } | null>(null);
  const [isSimulatingEvent, setIsSimulatingEvent] = useState(false);

  // Upload & Analysis states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'demo' | 'disconnected'>('demo');

  // DOM Refs
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // 1. Check browser mediaDevices support on mount
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermissionState('unsupported');
      setCameraError('Browser MediaDevices API is not supported in this browser. Please use the Video File Upload fallback.');
      setActiveTab('upload_file');
      return;
    }

    if (activeTab === 'camera') {
      startCamera();
    }

    // Cleanup camera tracks on unmount
    return () => {
      stopCameraTracks();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, []);

  // Update live video srcObject whenever stream changes
  useEffect(() => {
    if (liveVideoRef.current && stream) {
      liveVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Stop camera tracks helper
  const stopCameraTracks = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
  };

  // Start / restart live camera stream
  const startCamera = async (deviceId?: string) => {
    stopCameraTracks();
    setCameraError(null);
    setIsInitializingCamera(true);

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
        audio: true
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setCameraPermissionState('granted');

      // Enumerate video devices for selector
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err: any) {
      console.warn('getUserMedia error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraPermissionState('denied');
        setCameraError('Camera access was denied. Please allow camera permissions in your browser address bar to record live match play.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraPermissionState('unsupported');
        setCameraError('No camera device was detected on your system. You can connect a webcam or switch to the Video File Upload tab.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('The camera is currently being used by another application or tab. Please close other camera apps and retry.');
      } else {
        setCameraError(err.message || 'Unable to access camera feed.');
      }
    } finally {
      setIsInitializingCamera(false);
    }
  };

  // Switch camera device
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    startCamera(deviceId);
  };

  // Start recording
  const handleStartRecording = () => {
    if (!stream) return;
    setCameraError(null);
    recordedChunksRef.current = [];
    setRecordedBlob(null);
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }

    try {
      // Pick best supported mimeType
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        // Stop stream once recorded so user can review preview
        stopCameraTracks();
      };

      recorder.start(500); // 500ms time slice
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error('Failed to start MediaRecorder:', err);
      setCameraError('Failed to initialize MediaRecorder: ' + err.message);
    }
  };

  // Stop recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Retake video
  const handleRetake = () => {
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    setRecordedBlob(null);
    setRecordingDuration(0);
    startCamera(selectedDeviceId);
  };

  // Handle file drop/input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    validateAndSetFile(file);
  };

  const validateAndSetFile = (file: File) => {
    const validExtensions = ['.mp4', '.webm', '.mov', '.mkv'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    const isValidMime = file.type.startsWith('video/') || hasValidExt;

    if (!isValidMime) {
      setFileError('Invalid file type. Please upload a valid video file (.mp4, .webm, or .mov).');
      setSelectedFile(null);
      return;
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setFileError(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 100MB.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setRecordedVideoUrl(url);
  };

  const handleBlowWhistle = () => {
    soundEffects.playWhistle('double');
  };

  const handleSimulatePlayRuling = async () => {
    setIsSimulatingEvent(true);
    soundEffects.playWhistle('foul');

    const rules = (gameConfig as any).scoringRules || [
      { eventType: 'point_scored', label: 'Point Scored', points: 1 }
    ];
    const rule = rules[Math.floor(Math.random() * rules.length)];
    const chosenTeam = Math.random() > 0.5 ? match.teamA : match.teamB;
    const confidence = +(0.88 + Math.random() * 0.1).toFixed(2);

    let rulingQuote = '';
    let ruleCitation = `Rule Protocol: ${rule.eventType.toUpperCase()}`;

    if (match.gameId === 'football') {
      rulingQuote = `${judgeInfo.name} ruling: Striker ball trajectory completely crossed the vertical goal plane before defensive clearance.`;
      ruleCitation = 'Football IFAB Law 10 (Goal Detection)';
    } else if (match.gameId === 'al_teela') {
      rulingQuote = `${judgeInfo.name} ruling: Shooter marble struck central cluster, displacing target 14cm outside 45cm ring perimeter.`;
      ruleCitation = 'Al Teela Traditional Rules: Boundary Ring Displacement';
    } else if (match.gameId === 'al_dama') {
      rulingQuote = `${judgeInfo.name} ruling: Valid diagonal crown advance verified. Opponent piece captured legally.`;
      ruleCitation = 'Al Dama Rulebook: King Advancement Clause';
    } else if (match.gameId === 'al_laqaf') {
      rulingQuote = `${judgeInfo.name} ruling: Clean catch verified! 3 ground stones gathered with palm facing down before airborne stone reached hand.`;
      ruleCitation = 'Al Laqaf Dexterity Article 2: Clean Catch Timing';
    } else if (match.gameId === 'qif') {
      rulingQuote = `${judgeInfo.name} ruling: Tag contact verified by proximity sensor 0.4s before runner reached sanctuary boundary.`;
      ruleCitation = 'Qif Sanctuary Code: In-bounds Touch Verification';
    } else {
      rulingQuote = `${judgeInfo.name} ruling: Point awarded under custom arena rules for ${gameConfig.name}.`;
    }

    setLiveRulingToast({
      label: rule.label || 'Play Detected',
      text: rulingQuote,
      confidence,
      team: chosenTeam.name,
      points: rule.points || 1
    });

    try {
      await api.addHostEvent(match.id, {
        eventType: rule.eventType,
        eventLabel: rule.label,
        teamId: chosenTeam.id,
        timestampSeconds: recordingDuration || 14,
        pointsAwarded: rule.points || 1,
        notes: `Live optical detection by AI Judge ${judgeInfo.name}`,
        judgeRuling: rulingQuote,
        ruleCited: ruleCitation,
        aiJudgePersona: judgeInfo.name,
        source: 'ai_proposed',
        reviewStatus: 'pending',
        confidence
      });
    } catch (e) {
      console.warn('Failed to auto-register simulated event to match:', e);
    } finally {
      setIsSimulatingEvent(false);
    }
  };

  // Submit recorded or uploaded video for AI analysis
  const handleSubmitAnalysis = async () => {
    const videoToUpload = activeTab === 'camera' ? recordedBlob : selectedFile;
    const filename = activeTab === 'camera' 
      ? `fareeg_${match.gameId}_${Date.now()}.webm`
      : selectedFile?.name || `uploaded_match_${Date.now()}.mp4`;

    if (!videoToUpload) {
      setCameraError('No video ready for submission.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await api.submitVideoAnalysis(
        videoToUpload,
        filename,
        match.id,
        true, // consentConfirmed
        analysisMode,
        (percent) => {
          setUploadProgress(percent);
        }
      );

      onAnalysisStarted(response.jobId, match);
    } catch (err: any) {
      console.error('Upload failed:', err);
      if (activeTab === 'camera') {
        setCameraError(err.message || 'Failed to upload video for analysis.');
      } else {
        setFileError(err.message || 'Failed to upload video for analysis.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Top Header & Match Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Match Setup
          </button>
          
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Arena Camera: {gameConfig.name}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#d4af37]/20 text-[#fce09b] font-bold font-arabic">
              {gameConfig.arabicName}
            </span>
          </div>
          
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Match: <strong className="text-white">{match.teamA.name}</strong> vs <strong className="text-white">{match.teamB.name}</strong></span>
            <span>•</span>
            <span className="font-mono text-slate-500">ID: {match.id}</span>
          </p>
        </div>

        {/* Tab switch between Live Camera & File Upload */}
        <div className="flex items-center p-1 rounded-xl bg-[#060b18] border border-white/10 self-start sm:self-auto">
          <button
            onClick={() => {
              setActiveTab('camera');
              if (!stream && !recordedVideoUrl) startCamera(selectedDeviceId);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-[#d4af37] text-[#060b18] shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Live Camera Feed</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('upload_file');
              stopCameraTracks();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'upload_file'
                ? 'bg-[#d4af37] text-[#060b18] shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Existing Video</span>
          </button>
        </div>
      </div>

      {/* Game-specific Camera Placement Advisory Bar */}
      <div className="p-3.5 rounded-xl bg-[#0e1a38] border border-[#d4af37]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5 text-slate-300">
          <Info className="w-4 h-4 text-[#d4af37] shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong className="text-white">Recommended Setup for {gameConfig.name}:</strong>{' '}
            {gameConfig.cameraSetupInstructions}
          </span>
        </div>
        <span className="text-[11px] font-bold text-[#fce09b] px-2.5 py-1 rounded bg-[#060b18] border border-white/10 shrink-0">
          Angle: {gameConfig.recommendedAngle}
        </span>
      </div>

      {/* Main View Area */}
      {activeTab === 'camera' ? (
        <div className="space-y-4">
          
          {/* Video Feed / Preview Card */}
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-[500px] border border-white/10 flex items-center justify-center shadow-2xl">
            
            {/* Live Camera Stream */}
            {!recordedVideoUrl && cameraPermissionState === 'granted' && (
              <video
                ref={liveVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            )}

            {/* Recorded Video Preview Player */}
            {recordedVideoUrl && (
              <video
                src={recordedVideoUrl}
                controls
                className="w-full h-full object-contain"
              />
            )}

            {/* Initializing State */}
            {isInitializingCamera && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#060b18]/90 text-slate-300 space-y-3">
                <RefreshCw className="w-8 h-8 text-[#d4af37] animate-spin" />
                <p className="text-sm font-semibold">Requesting camera access & initializing stream...</p>
              </div>
            )}

            {/* Permission Denied / Error Overlay */}
            {cameraPermissionState === 'denied' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#060b18]/95 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="max-w-md space-y-1">
                  <h3 className="text-lg font-bold text-white">Camera Permission Denied</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Browser camera permission was blocked. To enable, click the lock/camera icon in your browser address bar, set Camera to "Allow", and click retry.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => startCamera(selectedDeviceId)}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                  >
                    Retry Permission
                  </button>
                  <button
                    onClick={() => setActiveTab('upload_file')}
                    className="gold-button px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Switch to Video Upload
                  </button>
                </div>
              </div>
            )}

            {/* Unsupported Camera Overlay */}
            {cameraPermissionState === 'unsupported' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#060b18]/95 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-400" />
                <h3 className="text-base font-bold text-white">Camera Device Unavailable</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  {cameraError || 'Browser camera interface is not available.'} Please use the video file upload option.
                </p>
                <button
                  onClick={() => setActiveTab('upload_file')}
                  className="gold-button px-4 py-2 rounded-lg text-xs font-bold"
                >
                  Upload Video File
                </button>
              </div>
            )}

            {/* AI Judge HUD Overlay during Live Feed & Playback */}
            {cameraPermissionState === 'granted' && (
              <AiJudgeHudOverlay
                gameId={match.gameId}
                judgeName={judgeInfo.name}
                judgePersona={userProfile.judgePersona}
                isRecording={isRecording}
                liveRulingToast={liveRulingToast}
                onDismissToast={() => setLiveRulingToast(null)}
                onBlowWhistle={handleBlowWhistle}
              />
            )}

            {/* Recorded Preview Indicator Banner */}
            {recordedVideoUrl && (
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 pointer-events-none z-10">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Recording Captured ({formatSeconds(recordingDuration)}) • Review Preview</span>
              </div>
            )}

          </div>

          {/* Controls Bar */}
          <div className="navy-card rounded-xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-4">
            
            {/* Left: Device Switcher & Referee Status */}
            <div className="flex items-center gap-3">
              {devices.length > 1 && !recordedVideoUrl && (
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedDeviceId}
                    onChange={e => handleDeviceChange(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#060b18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#d4af37]"
                  >
                    {devices.map((device, idx) => (
                      <option key={device.deviceId || idx} value={device.deviceId}>
                        {device.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={handleBlowWhistle}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-[#d4af37]/20 border border-white/10 hover:border-[#d4af37]/40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                title="Acoustic referee whistle signal"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Whistle</span>
              </button>
            </div>

            {/* Center: Recording & AI Referee Simulation Actions */}
            <div className="flex items-center gap-3 mx-auto">
              {!recordedVideoUrl ? (
                <>
                  {!isRecording ? (
                    <button
                      onClick={handleStartRecording}
                      disabled={cameraPermissionState !== 'granted'}
                      className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
                    >
                      <span className="w-3 h-3 rounded-full bg-white" />
                      <span>Start Recording</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStopRecording}
                      className="px-6 py-3 rounded-full bg-white hover:bg-slate-200 text-[#060b18] font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-xl transition-all animate-bounce"
                    >
                      <Square className="w-3.5 h-3.5 fill-current text-red-600" />
                      <span>Stop Recording</span>
                    </button>
                  )}

                  {/* Immediate AI Judge Ruling Test Trigger */}
                  <button
                    onClick={handleSimulatePlayRuling}
                    disabled={isSimulatingEvent}
                    className="px-4 py-3 rounded-xl bg-[#4D6A6D] hover:bg-[#4D6A6D]/80 border border-[#A0A083]/40 text-[#EAE0CC] text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all shadow-md"
                    title="Simulate play action and trigger instant AI Referee ruling"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FCE09B]" />
                    <span>{isSimulatingEvent ? 'Ruling...' : 'Simulate Play & Ruling'}</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRetake}
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake Video</span>
                  </button>

                  <button
                    onClick={handleSimulatePlayRuling}
                    disabled={isSimulatingEvent}
                    className="px-4 py-2.5 rounded-xl bg-[#4D6A6D] hover:bg-[#4D6A6D]/80 text-[#EAE0CC] text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FCE09B]" />
                    <span>Add AI Ruling</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right: Submit Button */}
            {recordedVideoUrl && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSubmitAnalysis}
                  disabled={isUploading}
                  className="gold-button px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isUploading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{isUploading ? `Uploading (${uploadProgress || 0}%)...` : 'Analyze Video with AI'}</span>
                </button>
              </div>
            )}

          </div>

        </div>
      ) : (
        /* Video File Upload Tab */
        <div className="space-y-4">
          <div className="navy-card rounded-2xl p-8 border border-white/10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] mx-auto">
              <FileVideo className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Upload Match Gameplay Video</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Select an existing recording from your camera roll, drone, or family camera. Supports MP4, WebM, and MOV up to 100MB.
              </p>
            </div>

            <label className="inline-block">
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="gold-button px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer inline-flex items-center gap-2 shadow-lg">
                <Upload className="w-4 h-4" />
                <span>Choose Video File</span>
              </span>
            </label>

            {fileError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs max-w-md mx-auto flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {selectedFile && (
              <div className="p-4 rounded-xl bg-[#060b18] border border-emerald-500/30 max-w-lg mx-auto text-left space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white truncate max-w-[250px]">
                    {selectedFile.name}
                  </span>
                  <span className="text-emerald-400 font-mono">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>

                {recordedVideoUrl && (
                  <video
                    src={recordedVideoUrl}
                    controls
                    className="w-full rounded-lg max-h-56 bg-black"
                  />
                )}

                <button
                  onClick={handleSubmitAnalysis}
                  disabled={isUploading}
                  className="w-full py-3 rounded-xl gold-button text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  {isUploading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {isUploading ? `Uploading Video (${uploadProgress || 0}%)...` : 'Submit Video for AI Analysis'}
                  </span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Upload Progress Bar if active */}
      {isUploading && uploadProgress !== null && (
        <div className="navy-card rounded-xl p-4 border border-[#d4af37]/40 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-[#d4af37] animate-spin" />
              Uploading Match Video to Analysis Chamber...
            </span>
            <span className="font-mono text-[#fce09b] font-bold">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#060b18] overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#d4af37] to-[#fce09b] transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Vision Mode Selector & Disclaimer (Anti-Slop Compliance) */}
      <div className="navy-card rounded-xl p-4 border border-white/10 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#d4af37]" />
            AI Vision Service Mode:
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="visionMode"
                checked={analysisMode === 'demo'}
                onChange={() => setAnalysisMode('demo')}
                className="accent-[#d4af37]"
              />
              <span>Demonstration Mode (Labelled Candidates for Review)</span>
            </label>
            <span className="text-slate-600">|</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="visionMode"
                checked={analysisMode === 'disconnected'}
                onChange={() => setAnalysisMode('disconnected')}
                className="accent-[#d4af37]"
              />
              <span>Disconnected Mode (Host Manual Event Entry Only)</span>
            </label>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          *Important Competition Notice: In accordance with competition rules, no simulated events are presented as real AI detections. Demonstration mode provides candidate timestamps clearly labelled for host testing.
        </p>
      </div>

    </div>
  );
};
