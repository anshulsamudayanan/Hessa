import React, { useState } from 'react';
import { 
  Sparkles, 
  Cpu, 
  Camera, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Play, 
  AlertCircle, 
  RotateCcw,
  Sliders,
  ShieldCheck,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { GameRuleConfig, ScoringRule, GameId } from '../../types';
import { api } from '../../services/api/client';

interface AiGameCreatorProps {
  onGameCreatedAndLaunch: (game: GameRuleConfig) => void;
  onCancel: () => void;
}

export const AiGameCreator: React.FC<AiGameCreatorProps> = ({
  onGameCreatedAndLaunch,
  onCancel
}) => {
  // Input fields
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('Family gathering of all ages');
  const [equipment, setEquipment] = useState('Household cups, small foam ball, chalk boundary');
  const [location, setLocation] = useState<'indoor' | 'outdoor' | 'tabletop'>('indoor');
  const [culturalInspiration, setCulturalInspiration] = useState('Emirati majlis and traditional neighborhood games');

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generated Game Result for inspection & editing
  const [generatedGame, setGeneratedGame] = useState<GameRuleConfig | null>(null);

  // Presets for inspiration
  const PRESETS = [
    {
      title: 'Majlis Precision Cup Knockout',
      desc: 'Players sit in a circle on carpet, taking turns sliding ceramic cups across a line toward a central target coin without overshooting.',
      equip: '3 plastic or wooden cups, target coin, carpet line',
      loc: 'indoor' as const
    },
    {
      title: 'Desert Sand Line Sprint & Freeze',
      desc: 'One caller shouts traditional poetry lines while runners advance toward a boundary, freezing completely when the caller spins around.',
      equip: 'Open sand pitch with two boundary ropes',
      loc: 'outdoor' as const
    },
    {
      title: 'Palm Pebble Catch Relay',
      desc: 'Players toss small stones between partners using only non-dominant hands, scoring points for consecutive catches without drops.',
      equip: '5 smooth sea pebbles',
      loc: 'indoor' as const
    }
  ];

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setDescription(preset.desc);
    setEquipment(preset.equip);
    setLocation(preset.loc);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a description of the game concept.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const result = await api.generateAiGame({
        description: description.trim(),
        targetAudience,
        equipment,
        location,
        culturalInspiration
      });
      setGeneratedGame(result);
    } catch (err: any) {
      setError(err.message || 'Failed to generate AI game referee. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Editing generated rules
  const handleAddRule = () => {
    if (!generatedGame) return;
    const newRule: ScoringRule = {
      eventType: `custom_event_${Date.now()}`,
      label: 'New Scoring Action',
      points: 1,
      description: 'Points awarded for completing this action.'
    };
    setGeneratedGame({
      ...generatedGame,
      scoringRules: [...generatedGame.scoringRules, newRule]
    });
  };

  const handleRemoveRule = (index: number) => {
    if (!generatedGame || generatedGame.scoringRules.length <= 1) return;
    const updated = generatedGame.scoringRules.filter((_, i) => i !== index);
    setGeneratedGame({ ...generatedGame, scoringRules: updated });
  };

  const handleRuleChange = (index: number, field: keyof ScoringRule, val: any) => {
    if (!generatedGame) return;
    const updated = [...generatedGame.scoringRules];
    updated[index] = { ...updated[index], [field]: val };
    setGeneratedGame({ ...generatedGame, scoringRules: updated });
  };

  const handleSaveAndLaunch = async () => {
    if (!generatedGame) return;
    try {
      // Save game to backend database
      const saved = await api.saveGame(generatedGame);
      onGameCreatedAndLaunch(saved);
    } catch (err: any) {
      setError('Failed to deploy referee: ' + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            Universal AI Referee Architect
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            AI Game Creator & Universal Referee
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Describe any playground, majlis, or family game. FAREEG AI generates official scoring mechanics, camera placement angles, and automated computer-vision referee rules.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 self-start cursor-pointer"
        >
          Back
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Preset Inspiration Pills */}
      <div className="navy-card rounded-2xl p-5 border border-[#4D6A6D]/30 space-y-3">
        <span className="text-xs font-bold uppercase text-[#EAE0CC] tracking-wider block">
          Quick Inspiration Presets:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="p-3 rounded-xl bg-[#060B18] border border-white/5 hover:border-[#D4AF37]/40 text-left transition-colors cursor-pointer group"
            >
              <div className="text-xs font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                {p.title}
              </div>
              <div className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                {p.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Creator Form */}
      {!generatedGame && (
        <form onSubmit={handleGenerate} className="navy-card rounded-2xl p-6 md:p-8 border border-white/10 space-y-6 shadow-xl">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-300 block">
              Describe Your Game Concept & Rules *
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Players stand behind a marked line and slide wooden blocks to knock down standing cones. Knocking down the red king cone awards 3 points, normal cones award 1 point. If your foot crosses the sand line, it is a foul."
              className="w-full p-4 rounded-xl bg-[#060B18] border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#4D6A6D] resize-none h-32"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">
                Location & Setting
              </label>
              <select
                value={location}
                onChange={e => setLocation(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#060B18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4D6A6D]"
              >
                <option value="indoor">Indoor Living Room / Majlis</option>
                <option value="tabletop">Tabletop / Floor Board</option>
                <option value="outdoor">Outdoor Sand Pitch / Court</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">
                Equipment Needed
              </label>
              <input
                type="text"
                value={equipment}
                onChange={e => setEquipment(e.target.value)}
                placeholder="e.g. Cups, foam ball, stones"
                className="w-full px-3 py-2.5 rounded-xl bg-[#060B18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4D6A6D]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase">
                Target Audience
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                placeholder="e.g. Family, all ages"
                className="w-full px-3 py-2.5 rounded-xl bg-[#060B18] border border-white/10 text-white text-xs focus:outline-none focus:border-[#4D6A6D]"
              />
            </div>

          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <span className="text-xs text-slate-400">
              Generated rules will be fully editable before you start playing.
            </span>

            <button
              type="submit"
              disabled={isGenerating}
              className="gold-button px-7 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isGenerating ? (
                <Cpu className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{isGenerating ? 'Synthesizing Referee Rules...' : 'Generate Game & AI Referee'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Generated Result & Rule Customization Studio */}
      {generatedGame && (
        <div className="navy-card rounded-2xl p-6 md:p-8 border border-[#4D6A6D]/40 space-y-6 shadow-2xl">
          
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Referee Generated & Configured
              </span>
              <h2 className="text-2xl font-black text-white mt-1">
                {generatedGame.name}
              </h2>
              <p className="text-sm font-bold text-[#D4AF37] font-arabic mt-0.5">
                {generatedGame.arabicName}
              </p>
            </div>

            <button
              onClick={() => setGeneratedGame(null)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Regenerate</span>
            </button>
          </div>

          {/* Description & Cultural Story */}
          <div className="space-y-2 text-xs text-slate-300">
            <p className="italic">"{generatedGame.tagline}"</p>
            <p>{generatedGame.description}</p>
            <div className="p-3 rounded-xl bg-[#060B18] border border-white/5 text-[11px] text-slate-400">
              <strong className="text-white">Cultural Heritage Connection:</strong> {generatedGame.culturalConnections}
            </div>
          </div>

          {/* Camera Setup Instructions Card */}
          <div className="p-4 rounded-xl bg-[#4D6A6D]/15 border border-[#4D6A6D]/30 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#EAE0CC]">
              <Camera className="w-4 h-4 text-[#D4AF37]" />
              <span>AI Referee Camera Placement & Tracking:</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {generatedGame.cameraSetupInstructions}
            </p>
            {generatedGame.aiDetectorGuidance && (
              <p className="text-[#C9ADA1] text-[11px] font-mono pt-1 border-t border-white/5">
                Computer Vision Focus: {generatedGame.aiDetectorGuidance}
              </p>
            )}
          </div>

          {/* Editable Scoring Rules */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Configurable Scoring Rules ({generatedGame.scoringRules.length}):</span>
              </span>
              <button
                type="button"
                onClick={handleAddRule}
                className="text-xs text-[#D4AF37] hover:underline font-semibold"
              >
                + Add Custom Rule
              </button>
            </div>

            <div className="space-y-2">
              {generatedGame.scoringRules.map((rule, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-xl bg-[#060B18] border border-white/5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs"
                >
                  <div className="sm:col-span-5">
                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">Event Name</label>
                    <input
                      type="text"
                      value={rule.label}
                      onChange={e => handleRuleChange(idx, 'label', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0c162e] border border-white/10 text-white font-medium focus:outline-none focus:border-[#4D6A6D]"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">Description</label>
                    <input
                      type="text"
                      value={rule.description}
                      onChange={e => handleRuleChange(idx, 'description', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0c162e] border border-white/10 text-slate-300 focus:outline-none focus:border-[#4D6A6D]"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">Points</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={rule.points}
                        onChange={e => handleRuleChange(idx, 'points', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#0c162e] border border-white/10 text-white font-bold font-mono text-center focus:outline-none focus:border-[#4D6A6D]"
                      />
                    </div>
                    {generatedGame.scoringRules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(idx)}
                        className="text-slate-500 hover:text-red-400 p-1.5 mt-4"
                        title="Remove rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action: Deploy Referee and Launch Match */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-400">
              Deploying saves this game into your active arena catalog.
            </span>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveAndLaunch}
                className="gold-button w-full sm:w-auto px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-xl"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Deploy Referee & Start Match in Arena</span>
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
