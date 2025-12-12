import React, { useState } from 'react';
import { Language, StudySession } from '../types';
import { FEATURED_SESSIONS } from '../constants';
import { SessionView } from './SessionView';
import { 
  Settings, 
  Search, 
  LayoutGrid, 
  Menu, 
  Plus, 
  Mic, 
  MoreVertical,
  BookOpen,
  Sparkles
} from 'lucide-react';

interface MainAppPlaceholderProps {
  language: Language;
}

export const MainAppPlaceholder: React.FC<MainAppPlaceholderProps> = ({ language }) => {
  const [view, setView] = useState<'dashboard' | 'session'>('dashboard');

  if (view === 'session') {
    return <SessionView language={language} onBack={() => setView('dashboard')} />;
  }

  return (
    <div className="min-h-screen bg-nl-bg text-nl-text font-sans flex flex-col">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-nl-bg sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="p-2 hover:bg-nl-surfaceHover rounded-full cursor-pointer md:hidden">
            <Menu size={24} />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">
              AL
            </div>
            <span className="text-xl font-medium tracking-tight hidden sm:block">AfroLearnAI</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-nl-surface hover:bg-nl-surfaceHover rounded-full border border-nl-border transition-colors">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">PRO</span>
            </button>
            <div className="w-px h-6 bg-nl-border mx-1 hidden md:block"></div>
            <button className="p-2 text-nl-textDim hover:text-nl-text hover:bg-nl-surfaceHover rounded-full transition-colors">
                <Settings size={20} />
            </button>
            <div className="w-9 h-9 rounded-full bg-blue-900 text-blue-200 flex items-center justify-center font-semibold text-sm border border-blue-700 cursor-pointer">
                JS
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-6 md:px-12 py-8 max-w-[1600px] mx-auto w-full">
        
        {/* Filter / Action Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
                <button className="px-4 py-1.5 rounded-full bg-brand-100 text-brand-900 text-sm font-medium whitespace-nowrap">
                    All
                </button>
                <button className="px-4 py-1.5 rounded-full border border-nl-border text-nl-textDim hover:bg-nl-surfaceHover hover:text-nl-text text-sm font-medium transition-colors whitespace-nowrap">
                    My sessions
                </button>
                <button className="px-4 py-1.5 rounded-full border border-nl-border text-nl-textDim hover:bg-nl-surfaceHover hover:text-nl-text text-sm font-medium transition-colors whitespace-nowrap">
                    Shared with me
                </button>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center bg-nl-surface border border-nl-border rounded-full px-3 py-1.5 flex-1 md:w-64">
                    <Search size={16} className="text-nl-textDim" />
                    <input 
                        type="text" 
                        placeholder="Search sessions..." 
                        className="bg-transparent border-none focus:outline-none text-sm ml-2 text-nl-text w-full placeholder-nl-textDim"
                    />
                </div>
                <button className="p-2 text-nl-textDim hover:bg-nl-surfaceHover rounded-full hidden sm:block">
                    <LayoutGrid size={20} />
                </button>
                <button 
                  onClick={() => setView('session')}
                  className="flex items-center gap-2 bg-nl-text text-nl-bg px-4 py-2 rounded-full font-semibold text-sm hover:bg-white transition-colors"
                >
                    <Plus size={18} />
                    <span className="hidden sm:inline">Create new</span>
                </button>
            </div>
        </div>

        {/* Featured Notebooks Section */}
        <div className="mb-12">
            <h2 className="text-lg font-medium mb-4 text-nl-text">Featured sessions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {FEATURED_SESSIONS.map((session) => (
                    <div 
                        key={session.id}
                        onClick={() => setView('session')}
                        className={`
                            group relative aspect-[4/3] rounded-3xl overflow-hidden cursor-pointer border border-transparent hover:border-nl-border transition-all duration-300
                            bg-gradient-to-br ${session.gradient}
                        `}
                    >
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                            <div className="flex items-center gap-2 mb-2 text-white/80 text-xs uppercase tracking-wider font-semibold">
                                <Sparkles size={12} />
                                <span>Google Research</span>
                            </div>
                            <h3 className="text-xl font-bold text-white leading-tight mb-1">{session.title}</h3>
                            <p className="text-sm text-white/70 line-clamp-2">{session.subtitle}</p>
                            <div className="flex items-center gap-2 mt-3 text-xs text-white/50">
                                <span>{session.date}</span>
                                <span>•</span>
                                <span>{session.sourceCount} sources</span>
                            </div>
                        </div>
                        <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-md p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <BookOpen size={16} className="text-white" />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Recent Notebooks Section */}
        <div>
            <div className="flex items-center justify-between mb-4">
                 <h2 className="text-lg font-medium text-nl-text">Recent sessions</h2>
                 <button className="text-sm text-brand-500 hover:text-brand-400 font-medium">See all</button>
            </div>
           
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* New Notebook Card */}
                <div 
                  onClick={() => setView('session')}
                  className="aspect-[4/3] rounded-3xl bg-nl-surface border border-nl-border hover:bg-nl-surfaceHover transition-colors cursor-pointer flex flex-col items-center justify-center group relative"
                >
                    <div className="w-12 h-12 rounded-full border border-nl-border flex items-center justify-center mb-3 group-hover:border-brand-500 group-hover:text-brand-500 transition-colors">
                        <Plus size={24} />
                    </div>
                    <span className="font-medium">Create new session</span>
                </div>

                {/* Example Active Session */}
                <div 
                  onClick={() => setView('session')}
                  className="aspect-[4/3] rounded-3xl bg-nl-surface border border-nl-border hover:bg-nl-surfaceHover transition-colors cursor-pointer flex flex-col relative group p-5"
                >
                    <div className="flex justify-between items-start mb-auto">
                        <div className="w-10 h-10 rounded-full bg-brand-900/30 text-brand-500 flex items-center justify-center">
                            <Mic size={20} />
                        </div>
                        <button className="text-nl-textDim hover:text-nl-text p-1 rounded-full hover:bg-nl-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical size={16} />
                        </button>
                    </div>
                    
                    <div>
                        <h3 className="text-lg font-bold text-nl-text mb-1 line-clamp-1">Physics: Thermodynamics</h3>
                        <p className="text-sm text-nl-textDim mb-3 line-clamp-2">
                             Discussing the laws of thermodynamics in {language.name}.
                        </p>
                        <div className="flex items-center gap-2 text-xs text-nl-textDim">
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span>Active now</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Example Past Session */}
                <div 
                  onClick={() => setView('session')}
                  className="aspect-[4/3] rounded-3xl bg-nl-surface border border-nl-border hover:bg-nl-surfaceHover transition-colors cursor-pointer flex flex-col relative group p-5"
                >
                    <div className="flex justify-between items-start mb-auto">
                         <div className="w-10 h-10 rounded-full bg-purple-900/30 text-purple-400 flex items-center justify-center">
                            <BookOpen size={20} />
                        </div>
                         <button className="text-nl-textDim hover:text-nl-text p-1 rounded-full hover:bg-nl-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical size={16} />
                        </button>
                    </div>
                    
                    <div>
                        <h3 className="text-lg font-bold text-nl-text mb-1 line-clamp-1">African Literature</h3>
                        <p className="text-sm text-nl-textDim mb-3 line-clamp-2">
                             Notes on Chinua Achebe's "Things Fall Apart"
                        </p>
                        <div className="flex items-center gap-2 text-xs text-nl-textDim">
                            <span>Edited 2 days ago</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

      </main>
    </div>
  );
};
