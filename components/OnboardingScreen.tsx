import React from 'react';
import { SUPPORTED_LANGUAGES } from '../constants';
import { Language } from '../types';
import { LanguageCard } from './LanguageCard';
import { Globe2 } from 'lucide-react';

interface OnboardingScreenProps {
  selectedLanguage: Language | null;
  onLanguageSelect: (lang: Language) => void;
  onContinue: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  selectedLanguage,
  onLanguageSelect,
  onContinue
}) => {
  return (
    <div className="min-h-screen bg-nl-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Subtle Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none" />
      
      <main className="w-full max-w-5xl z-10 flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center mb-8">
            <div className="mb-6 p-4 bg-nl-surface rounded-full border border-nl-border">
                <Globe2 className="w-8 h-8 text-brand-500" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-medium text-center text-nl-text mb-4 tracking-tight">
             Welcome to AfroLearnAI
            </h1>
            <p className="text-lg text-nl-textDim text-center max-w-lg mb-12">
              Select your preferred language to get started with your personalized learning assistant.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full px-4 md:px-0">
            {SUPPORTED_LANGUAGES.map((lang) => (
                <LanguageCard
                key={lang.id}
                language={lang}
                isSelected={selectedLanguage?.id === lang.id}
                onSelect={onLanguageSelect}
                />
            ))}
            </div>
        </div>

        <div className="sticky bottom-0 p-4 w-full flex justify-center bg-gradient-to-t from-nl-bg via-nl-bg to-transparent pb-8">
            <button
                onClick={onContinue}
                disabled={!selectedLanguage}
                className={`
                    px-8 py-4 rounded-full font-semibold text-base transition-all duration-200 min-w-[200px] flex items-center justify-center gap-2
                    ${selectedLanguage 
                        ? 'bg-nl-text text-nl-bg hover:bg-white hover:scale-105' 
                        : 'bg-nl-surfaceHover text-nl-textDim cursor-not-allowed'
                    }
                `}
            >
                {selectedLanguage 
                    ? `Continue in ${selectedLanguage.nativeName}` 
                    : 'Select a Language'
                }
            </button>
        </div>
      </main>
    </div>
  );
};