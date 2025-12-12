import { Language, StudySession } from './types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { 
    id: 'en', 
    name: 'English', 
    nativeName: 'English', 
    greeting: 'Hello',
    flagEmoji: '🇬🇧'
  },
  { 
    id: 'sw', 
    name: 'Kiswahili', 
    nativeName: 'Kiswahili', 
    greeting: 'Hujambo',
    flagEmoji: '🇹🇿' 
  },
  { 
    id: 'tw', 
    name: 'Twi', 
    nativeName: 'Twi', 
    greeting: 'Maakye',
    flagEmoji: '🇬🇭'
  },
  { 
    id: 'yo', 
    name: 'Yoruba', 
    nativeName: 'Yorùbá', 
    greeting: 'Bawo',
    flagEmoji: '🇳🇬'
  },
  { 
    id: 'rw', 
    name: 'Kinyarwanda', 
    nativeName: 'Ikinyarwanda', 
    greeting: 'Muraho',
    flagEmoji: '🇷🇼'
  },
  { 
    id: 'am', 
    name: 'Amharic', 
    nativeName: 'አማርኛ', 
    greeting: 'Selam',
    flagEmoji: '🇪🇹'
  },
  { 
    id: 'ha', 
    name: 'Hausa', 
    nativeName: 'Harshen Hausa', 
    greeting: 'Sannu',
    flagEmoji: '🇳🇬'
  },
];

export const FEATURED_SESSIONS: StudySession[] = [
  {
    id: '1',
    title: 'Pan-African History',
    subtitle: 'From Ancient Civilizations to Modern Independence',
    date: '12 Jul 2025',
    sourceCount: 36,
    gradient: 'from-blue-900 via-indigo-900 to-purple-900',
    icon: 'History'
  },
  {
    id: '2',
    title: 'Introduction to Swahili',
    subtitle: 'Basic grammar and conversational skills',
    date: '15 May 2025',
    sourceCount: 12,
    gradient: 'from-brand-900 via-amber-900 to-orange-900',
    icon: 'Languages'
  },
  {
    id: '3',
    title: 'Agriculture Tech in Africa',
    subtitle: 'Innovations driving food security',
    date: '10 Aug 2025',
    sourceCount: 24,
    gradient: 'from-green-900 via-emerald-900 to-teal-900',
    icon: 'Sprout'
  },
  {
    id: '4',
    title: 'The Geneva Convention',
    subtitle: 'Key protocols and international law',
    date: '2 Sep 2025',
    sourceCount: 8,
    gradient: 'from-slate-800 via-gray-800 to-zinc-800',
    icon: 'Scale'
  }
];
