import React, { useState } from 'react';
import { OnboardingScreen } from './components/OnboardingScreen';
import { MainAppPlaceholder } from './components/MainAppPlaceholder';
import { Language, UserSession } from './types';

const App: React.FC = () => {
  // Session state to track onboarding progress and user choices
  const [session, setSession] = useState<UserSession>({
    hasOnboarded: false,
    language: null,
  });

  const handleLanguageSelect = (language: Language) => {
    setSession(prev => ({ ...prev, language }));
  };

  const handleContinue = () => {
    if (session.language) {
      setSession(prev => ({ ...prev, hasOnboarded: true }));
    }
  };

  return (
    <div className="antialiased text-gray-900">
      {!session.hasOnboarded ? (
        <OnboardingScreen 
          selectedLanguage={session.language}
          onLanguageSelect={handleLanguageSelect}
          onContinue={handleContinue}
        />
      ) : (
        <MainAppPlaceholder language={session.language!} />
      )}
    </div>
  );
};

export default App;
