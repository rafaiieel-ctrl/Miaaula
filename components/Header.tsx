
import React, { useState, useRef } from 'react';
import { TabID } from '../types';
import { DownloadIcon, SidebarOpenIcon, SidebarCloseIcon, Bars3Icon, RadarIcon, LockClosedIcon } from './icons';
import { useSettings } from '../contexts/SettingsContext';
import * as srs from '../services/srsService';
import TrapscanMenu from './TrapscanMenu';

interface HeaderProps {
  activeTabInfo: { id: TabID; label: string; icon: React.ReactNode };
  theme: 'dark' | 'galaxy';
  toggleTheme: () => void;
  isOnline: boolean;
  isAppInstallable: boolean;
  onInstallClick: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
    activeTabInfo, 
    theme, 
    toggleTheme, 
    isOnline, 
    isAppInstallable, 
    onInstallClick,
    onToggleSidebar,
    isSidebarOpen
}) => {
  const { settings } = useSettings();
  const { level, progressPercent } = srs.getLevelInfo(settings.userXp);
  
  // Trapscan UI Logic
  const [isTrapscanOpen, setIsTrapscanOpen] = useState(false);
  const trapscanBtnRef = useRef<HTMLButtonElement>(null);
  
  // Identify if current view supports Trapscan Assist
  // It should be disabled in 'porrada' (Arena), 'battle' and 'pair-match' (Games)
  const isGameMode = ['porrada', 'battle', 'pair-match'].includes(activeTabInfo.id);
  
  const tsConfig = settings.trapscan || { enabled: true, assistMode: true, defaultMode: 'TREINO', lockLevel: 'SOFT' };
  
  const getTrapscanStatus = () => {
      if (isGameMode) return { label: 'INDISPONÍVEL', color: 'text-slate-600', bg: 'bg-slate-800/50' };
      if (!tsConfig.assistMode) return { label: 'OFF', color: 'text-slate-500', bg: 'bg-white/5' };
      if (tsConfig.defaultMode === 'GUIA') return { label: 'GUIA', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' };
      return { 
          label: tsConfig.lockLevel === 'HARD' ? 'HARD LOCK' : 'TREINO', 
          color: tsConfig.lockLevel === 'HARD' ? 'text-rose-400' : 'text-indigo-400', 
          bg: tsConfig.lockLevel === 'HARD' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-indigo-500/10 border-indigo-500/30' 
      };
  };

  const tsStatus = getTrapscanStatus();

  return (
    <header className="sticky top-0 z-40 px-4 pt-4 pb-2 pointer-events-none">
      <div className="mx-auto bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-full px-5 h-16 flex items-center justify-between shadow-2xl pointer-events-auto max-w-4xl">
          
          {/* Path / Breadcrumb with Toggle */}
          <div className="flex items-center gap-4">
            <button 
                onClick={onToggleSidebar}
                className="p-2 rounded-full hover:bg-white/10 text-slate-300 transition-colors active:scale-95"
                title={isSidebarOpen ? "Recolher Menu" : "Expandir Menu"}
                aria-label={isSidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
            >
                <div className="md:hidden">
                    <Bars3Icon className="w-6 h-6" />
                </div>
                <div className="hidden md:block text-slate-400 hover:text-white">
                     {isSidebarOpen ? <SidebarCloseIcon className="w-5 h-5" /> : <SidebarOpenIcon className="w-5 h-5" />}
                </div>
            </button>

            <div className="w-px h-6 bg-white/10 hidden md:block"></div>

            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-slate-300 border border-white/5">
                    {React.cloneElement(activeTabInfo.icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
                </div>
                <h1 className="text-sm font-bold text-white uppercase tracking-wider hidden sm:block">{activeTabInfo.label}</h1>
            </div>
          </div>

          {/* Center: Global Trapscan Control */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <button
                  ref={trapscanBtnRef}
                  onClick={() => !isGameMode && setIsTrapscanOpen(!isTrapscanOpen)}
                  disabled={isGameMode}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all active:scale-95 ${tsStatus.bg} ${isGameMode ? 'opacity-50 cursor-not-allowed border-transparent' : 'border border-white/5 hover:border-white/20 cursor-pointer shadow-sm'}`}
                  title={isGameMode ? "Trapscan indisponível neste modo" : "Configurar Trapscan Assist"}
              >
                  <RadarIcon className={`w-3.5 h-3.5 ${tsStatus.color}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${tsStatus.color}`}>
                      {tsStatus.label}
                  </span>
                  {tsConfig.defaultMode === 'TREINO' && !isGameMode && tsConfig.assistMode && (
                      <LockClosedIcon className={`w-3 h-3 ${tsStatus.color} opacity-70`} />
                  )}
              </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-4">
            {/* Level XP Progress */}
            <div className="hidden sm:flex flex-col items-end gap-1 min-w-[100px]">
                <div className="flex justify-between w-full text-[9px] font-black uppercase tracking-widest">
                    <span className="text-sky-400">Lvl {level}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: `${progressPercent}%` }}></div>
                </div>
            </div>

            <div className="flex items-center gap-2 pl-4 border-l border-white/10">
                {isAppInstallable && (
                    <button onClick={onInstallClick} className="p-2 text-slate-400 hover:text-white transition-all bg-white/5 rounded-full" title="Instalar">
                        <DownloadIcon className="w-4 h-4" />
                    </button>
                )}
                <div className={`w-2.5 h-2.5 rounded-full border border-slate-900 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} title={isOnline ? "Online" : "Offline"}></div>
            </div>
          </div>
          
          <TrapscanMenu 
              isOpen={isTrapscanOpen} 
              onClose={() => setIsTrapscanOpen(false)} 
              anchorRect={trapscanBtnRef.current?.getBoundingClientRect()} 
          />
      </div>
    </header>
  );
};

export default Header;
