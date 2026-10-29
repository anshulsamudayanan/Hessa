import { UserMajlisProfile } from '../../types';

export const COOLORS_PALETTE = [
  { hex: '#4D6A6D', name: 'Arabian Teal', text: '#EAE0CC' },
  { hex: '#798478', name: 'Mineral Green', text: '#FFFFFF' },
  { hex: '#A0A083', name: 'Desert Sage', text: '#060B18' },
  { hex: '#C9ADA1', name: 'Sand Rose', text: '#060B18' },
  { hex: '#EAE0CC', name: 'Pearl Linen', text: '#060B18' },
  { hex: '#D4AF37', name: 'Emirati Gold', text: '#060B18' }
];

export const JUDGE_PERSONAS: Record<'family' | 'standard' | 'strict', {
  name: string;
  arabicTitle: string;
  badge: string;
  tagline: string;
  description: string;
  strictnessLevel: string;
}> = {
  family: {
    name: 'Uncle Rashid',
    arabicTitle: 'العم راشد (المحكم العائلي)',
    badge: '👴 Warm & Encouraging',
    tagline: 'Prioritizes fun, gives benefit of the doubt, and encourages sportsmanship.',
    description: 'Forgives minor boundary crossing, celebrates team effort, and keeps the energy positive for players of all ages.',
    strictnessLevel: 'Lenient / High-Spirited'
  },
  standard: {
    name: 'Coach Sultan',
    arabicTitle: 'الكابتن سلطان (حكم البطولة)',
    badge: '⚖️ Balanced & Fair',
    tagline: 'Official tournament arbiter who applies standard traditional rules with fairness.',
    description: 'Evaluates video evidence systematically with clear rationale and rules citations for every event.',
    strictnessLevel: 'Standard Competition'
  },
  strict: {
    name: 'International VAR Umpire',
    arabicTitle: 'محكم الفيديو الدقيق (VAR)',
    badge: '🔍 Frame-by-Frame VAR',
    tagline: 'Ultra-strict millisecond precision, zero margin for error.',
    description: 'Demands absolute boundary clarity, strict marble perimeter checks, and high confidence detections.',
    strictnessLevel: 'Championship Strict'
  }
};

const DEFAULT_PROFILE: UserMajlisProfile = {
  familyClanName: 'Al Saqr Majlis',
  emblemEmoji: '🦅',
  emblemName: 'Golden Falcon',
  primaryColor: '#4D6A6D',
  judgePersona: 'standard',
  judgeName: 'Coach Sultan',
  defaultRoster: ['Rashid', 'Fatima', 'Zayed', 'Mariam', 'Hamad']
};

const STORAGE_KEY = 'fareeg_user_majlis_profile';

export const userProfileStorage = {
  getProfile(): UserMajlisProfile {
    if (typeof window === 'undefined') return DEFAULT_PROFILE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PROFILE, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to parse user profile from localStorage:', e);
    }
    return DEFAULT_PROFILE;
  },

  saveProfile(profile: UserMajlisProfile): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to save user profile to localStorage:', e);
    }
  }
};
