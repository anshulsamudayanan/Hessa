import { Router, Request, Response } from 'express';
import { db } from '../storage';
import { GameRuleConfig, ScoringRule } from '../../src/types';
import { GoogleGenAI, Type } from '@google/genai';

export const gamesRouter = Router();

// GET /api/games - List all games (built-in + custom)
gamesRouter.get('/', (req: Request, res: Response) => {
  const games = db.getAllGames();
  res.json({ success: true, data: games });
});

// GET /api/games/:gameId - Get details of a single game
gamesRouter.get('/:gameId', (req: Request, res: Response) => {
  const game = db.getGame(req.params.gameId);
  if (!game) {
    return res.status(404).json({ success: false, error: 'Game not found' });
  }
  res.json({ success: true, data: game });
});

// POST /api/games - Create or update a custom game manually
gamesRouter.post('/', (req: Request, res: Response) => {
  const payload = req.body;
  if (!payload.name || !payload.scoringRules || !Array.isArray(payload.scoringRules)) {
    return res.status(400).json({ success: false, error: 'Game name and scoring rules are required' });
  }

  const id = payload.id || `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newGame: GameRuleConfig = {
    ...payload,
    id,
    isCustomCreated: true
  };

  db.saveCustomGame(newGame);
  res.status(201).json({ success: true, data: newGame });
});

// DELETE /api/games/:gameId - Delete a custom game
gamesRouter.delete('/:gameId', (req: Request, res: Response) => {
  const success = db.deleteCustomGame(req.params.gameId);
  res.json({ success, message: success ? 'Game removed' : 'Cannot delete built-in game or game not found' });
});

// POST /api/games/generate-ai - Describe a game and generate an AI Referee with rules & camera specs
gamesRouter.post('/generate-ai', async (req: Request, res: Response) => {
  const { description, targetAudience, equipment, location, culturalInspiration } = req.body;

  if (!description || typeof description !== 'string' || description.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a clear description of the game you want to create.'
    });
  }

  const gameId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Attempt to use Google Gemini API if GEMINI_API_KEY is available
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const prompt = `You are the lead rules architect and computer vision judge for FAREEG AI, an AI-powered tournament platform celebrating Emirati culture and global traditional family games.
The user wants to invent or configure an AI Referee for the following game:
User Prompt: "${description}"
Target Audience: "${targetAudience || 'Family & all ages'}"
Equipment Available: "${equipment || 'Any standard household or sand items'}"
Location Setting: "${location || 'indoor or outdoor'}"
Cultural Inspiration: "${culturalInspiration || 'Emirati community tradition or world heritage'}"

Generate a complete, official, highly structured Game and AI Referee configuration in JSON.
Required JSON format:
{
  "name": "Game Name in English",
  "arabicName": "Arabic title or cultural translation (e.g. لعبة ...)",
  "tagline": "A punchy, professional 1-sentence tagline",
  "category": "dexterity" | "agility" | "board" | "ball" | "marbles" | "strategy" | "tag" | "tossing",
  "description": "2-3 sentences explaining core objectives and gameplay flow",
  "culturalBackground": "Rich context explaining the community tradition, majlis connection, or historical roots",
  "culturalConnections": "1 sentence showing how this game connects to traditional Emirati games like Al Teela, Al Laqaf, Al Dama, or Qif",
  "playersPerTeam": "e.g. 2 to 4 players",
  "durationMinutes": 10,
  "equipmentNeeded": "Specific items needed (e.g. 3 wooden cups, soft ball, chalk line)",
  "locationType": "indoor" | "outdoor" | "tabletop",
  "energyLevel": "mind" | "dexterity" | "athletic",
  "recommendedAngle": "Specific camera perspective (e.g. Overhead 45° angle, Wide-angle sideline 2m height)",
  "cameraSetupInstructions": "Detailed camera setup instructions for optimal AI computer vision and host referee inspection",
  "aiDetectorGuidance": "What the computer vision detector should track (e.g. object trajectory, boundary crossing, posture freeze, contact)",
  "rulesPlaceholderNote": "Official host notice regarding scoring adjustments and local variations",
  "scoringRules": [
    {
      "eventType": "machine_key_like_goal_or_toss",
      "label": "Human-readable Event Name",
      "points": 1,
      "description": "Clear criterion for awarding points"
    }
  ]
}`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = aiResponse.text || '';
      const parsed = JSON.parse(responseText.trim());

      const generatedGame: GameRuleConfig = {
        id: gameId,
        name: parsed.name || 'Custom Arena Game',
        arabicName: parsed.arabicName || 'لعبة الميدان المبتكرة',
        tagline: parsed.tagline || 'AI-refereed custom arena game',
        category: parsed.category || 'dexterity',
        description: parsed.description || description,
        culturalBackground: parsed.culturalBackground || 'Crafted for family tournament competition.',
        culturalConnections: parsed.culturalConnections || 'Inspired by the spirit of community play in the Fareeg.',
        playersPerTeam: parsed.playersPerTeam || '2 to 4 players',
        durationMinutes: parsed.durationMinutes || 12,
        equipmentNeeded: parsed.equipmentNeeded || equipment || 'Simple family items',
        locationType: parsed.locationType || (location as any) || 'indoor',
        energyLevel: parsed.energyLevel || 'dexterity',
        recommendedAngle: parsed.recommendedAngle || 'Wide-angle clear view',
        cameraSetupInstructions: parsed.cameraSetupInstructions || 'Place camera on a stable surface facing the active playing zone.',
        aiDetectorGuidance: parsed.aiDetectorGuidance || 'Tracks candidate player action and boundary events.',
        rulesPlaceholderNote: parsed.rulesPlaceholderNote || 'Scoring is supervised by the host referee.',
        scoringRules: Array.isArray(parsed.scoringRules) && parsed.scoringRules.length > 0 ? parsed.scoringRules : [
          { eventType: 'successful_play', label: 'Successful Move', points: 1, description: 'Player completes objective cleanly.' },
          { eventType: 'bonus_round', label: 'Bonus Objective', points: 2, description: 'Mastery challenge accomplished.' }
        ],
        potentialEvents: Array.isArray(parsed.scoringRules) ? parsed.scoringRules.map((r: any) => r.eventType) : ['successful_play', 'bonus_round'],
        isCustomCreated: true,
        aiRefereePrompt: description
      };

      db.saveCustomGame(generatedGame);
      return res.status(201).json({ success: true, data: generatedGame });
    } catch (err) {
      console.warn('Gemini API call encountered error, falling back to procedural rules synthesizer:', err);
    }
  }

  // Procedural Rule Synthesizer Fallback (Deterministic, High Quality, Zero Downtime)
  const cleanName = description.split(/[,.\n]/)[0].trim().substring(0, 32) || 'Custom Arena Challenge';
  const synthGame: GameRuleConfig = {
    id: gameId,
    name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
    arabicName: `تحدي ${cleanName} التراثي`,
    tagline: `An AI-refereed family contest combining agility, strategy, and precision`,
    category: description.toLowerCase().includes('ball') ? 'ball' : description.toLowerCase().includes('board') ? 'board' : description.toLowerCase().includes('run') ? 'agility' : 'dexterity',
    description: `A dynamic family game based on player challenge: ${description}. Supervised by FAREEG AI's Universal Computer Vision Referee.`,
    culturalBackground: `Created in the spirit of the Emirati Fareeg (neighborhood), where families invent joyful challenges using local surroundings.`,
    culturalConnections: `Carries the communal play traditions of Al Teela and Al Laqaf into modern family invention.`,
    playersPerTeam: '2 to 4 players',
    durationMinutes: 10,
    equipmentNeeded: equipment || 'Standard household markers or soft play items',
    locationType: (location as any) || 'indoor',
    energyLevel: description.toLowerCase().includes('run') ? 'athletic' : 'dexterity',
    recommendedAngle: 'Elevated 45-degree angle capturing full playing boundary and player hands',
    cameraSetupInstructions: 'Place a smartphone or camera on a stable tripod at eye level (1.5m) angled toward the designated active play square.',
    aiDetectorGuidance: 'Tracks target object displacement, hand touch sequences, and boundary crossing markers.',
    rulesPlaceholderNote: 'Host referee can customize point allocations in the Match Setup review screen.',
    scoringRules: [
      { eventType: 'primary_action_score', label: 'Primary Objective Scored', points: 1, description: 'Clean execution of the primary game goal.' },
      { eventType: 'bonus_mastery', label: 'Skill Mastery Bonus', points: 2, description: 'Advanced trick, rapid sequence, or high-difficulty placement.' },
      { eventType: 'boundary_fault', label: 'Boundary Invalidation (Fault)', points: 0, description: 'Stepping outside zone or dropping equipment.' }
    ],
    potentialEvents: ['primary_action_score', 'bonus_mastery', 'boundary_fault'],
    isCustomCreated: true,
    aiRefereePrompt: description
  };

  db.saveCustomGame(synthGame);
  res.status(201).json({ success: true, data: synthGame });
});
