import React from 'react';
import { Language } from '../types';
import { Check } from 'lucide-react';

interface LanguageCardProps {
  language: Language;
  isSelected: boolean;
  onSelect: (language: Language) => void;
}

export const LanguageCard: React.FC<LanguageCardProps> = ({ language, isSelected, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(language)}
      className={`
        relative flex flex-col items-start justify-center p-6 rounded-3xl border transition-all duration-200 w-full text-left group
        ${isSelected 
          ? 'border-brand-500 bg-nl-surfaceHover ring-1 ring-brand-500' 
          : 'border-nl-border bg-nl-surface hover:bg-nl-surfaceHover hover:border-gray-500'
        }
      `}
      aria-pressed={isSelected}
    >
      <div className="flex justify-between w-full items-start mb-3">
        <span className="text-3xl filter">{language.flagEmoji}</span>
        {isSelected && (
          <div className="bg-brand-500 text-white rounded-full p-0.5 shadow-sm">
            <Check size={16} strokeWidth={3} />
          </div>
        )}
      </div>
      
      <div className="mt-1">
        <h3 className={`text-lg font-bold ${isSelected ? 'text-brand-400' : 'text-nl-text'}`}>
          {language.nativeName}
        </h3>
        <p className="text-sm text-nl-textDim mt-1">
          {language.name}
        </p>
      </div>
    </button>
  );
};