
import React, { useState, lazy, Suspense, useEffect, useMemo, useCallback } from 'react';
import { TabID, StudyRef, DailyTaskType } from './types';
import Header from './components/Header';
import SideBar from './components/SideBar';
import { useSettings } from './contexts/SettingsContext';
import { useQuestionState } from './contexts/QuestionContext';
import { useFlashcardState } from './contexts/FlashcardContext';
import XpNotification from './components/XpNotification';
import GalaxyBackground from './components/GalaxyBackground';
import LoadingState from './components/LoadingState';
import GoogleDriveSync from './components/GoogleDriveSync';
import QRCodeModal from './components/QRCodeModal';
import { 
  BoltIcon, SearchIcon, CalendarIcon, BrainIcon, ClipboardDocumentCheckIcon, 
  GamepadIcon, PlusIcon, ListBulletIcon, GraphIcon, ChartBarIcon, TrophyIcon, 
  UserCircleIcon, CogIcon, ClipboardListIcon, RoadIcon, ScaleIcon, GavelIcon, 
  RadarIcon, ChevronUpIcon 
} from './components/icons';
import * as srs from './services/srsService';

// Views - Lazy Loaded
const TodayView = lazy(() => import('./views/TodayView'));
const StudyView = lazy(() => import('./views/StudyView'));
const FlashcardsView = lazy(() => import('./views/FlashcardsView'));
const AddQuestionView = lazy(() => import('./views/AddQuestionView'));
const ListView = lazy(() => import('./views/ListView'));
const MapView = lazy(() => import('./views/MapView'));
const DashboardView = lazy(() => import('./views/DashboardView'));
const ProfileView = lazy(() => import('./views/ProfileView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const PorradaGameView = lazy(() => import('./views/PorradaGameView'));
const LiteralnessView = lazy(() => import('./views/LiteralnessView'));
const TrailView = lazy(() => import('./views/TrailView'));
const SplashView = lazy(() => import('./views/SplashView'));
const SectorsExploreView = lazy(() => import('./views/SectorsExploreView'));
const TrapscanView = lazy(() => import('./views/TrapscanView'));

// Types for Navigation
const NAV_LABELS: Record<TabID, string> = {
  'today': 'Hoje',
  'study': 'Estudar',
  'flashcards': 'Cards',
  'porrada': 'Arena',
  'manage': 'Adicionar',
  'list': 'Banco',
  'map': 'Galaxy',
  'dash': 'Dashboard',
  'profile': 'Perfil',
  'settings': 'Ajustes',
  'trail': 'Trilhas',
  'pair-match': 'Pares', // Mantido para compatibilidade de tipos, mas removido da UI
  'literalness': 'Lei Seca',
  'normas': 'Normas',
  'jurisprudencia': 'Juris.',
  'sectors': 'Setores',
  'radar': 'Trapscan',
  'battle': 'Batalha'
};

const NAV_ICONS: Record<TabID, React.ReactNode> = {
  'today': <CalendarIcon />,
  'study': <BrainIcon />,
  'flashcards': <ClipboardDocumentCheckIcon />,
  'porrada': <GamepadIcon />,
  'manage': <PlusIcon />,
  'list': <ListBulletIcon />,
  'map': <GraphIcon />,
  'dash': <ChartBarIcon />,
  'profile': <UserCircleIcon />,
  'settings': <CogIcon />,
  'trail': <RoadIcon />,
  'pair-match': <BoltIcon />,
  'literalness': <ScaleIcon />,
  'normas': <ClipboardDocumentCheckIcon />,
  'jurisprudencia': <GavelIcon />,
  'sectors': <SearchIcon />,
  'radar': <RadarIcon />,
  'battle': <GamepadIcon />
};

export const App: React.FC = () => {
    // Contexts
    const { settings, updateSettings, requestNotificationPermission } = useSettings();
    const questions = useQuestionState();
    const flashcards = useFlashcardState();
    
    // Core State
    const [activeTab, setActiveTab] = useState<TabID>(settings.navOrder ? settings.navOrder[0] as TabID : 'today');
    
    // SIDEBAR TOGGLE STATE (PERSISTED)
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('miaaula_sidebar_collapsed');
        return saved === 'true' ? false : true;
    });

    const [activeStudyRef, setActiveStudyRef] = useState<StudyRef | null>(null);
    // isDockHidden kept for MapView compatibility, though dock is removed
    const [isDockHidden, setIsDockHidden] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [isSplashVisible, setIsSplashVisible] = useState(true);
    const [splashKpis, setSplashKpis] = useState({ 
        questionsDone: 0, 
        questionsDoneToday: 0, 
        accuracy: 0,
        lastTrail: { subject: '', count: 0, bank: '' },
        lastSessions: [] 
    });

    // PWA Logic
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    // --- SIDEBAR LOGIC START ---
    
    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => {
            const nextState = !prev;
            localStorage.setItem('miaaula_sidebar_collapsed', (!nextState).toString());
            return nextState;
        });
    }, []);

    // Shortcut: Ctrl+B / Cmd+B
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                toggleSidebar();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleSidebar]);

    // Layout Sync: Update CSS Variable for width calculation in child views (Literalness/Map)
    useEffect(() => {
        const root = document.documentElement;
        if (!isSidebarOpen) {
            root.style.setProperty('--sidebar-width', '0px');
        } else {
            if (window.innerWidth < 768) {
                 root.style.setProperty('--sidebar-width', '0px');
            }
        }
    }, [isSidebarOpen]);

    // --- SIDEBAR LOGIC END ---

    // Stats Calculation for Splash
    useEffect(() => {
        const totalAttempts = questions.reduce((acc, q) => acc + (q.totalAttempts || 0), 0);
        const correct = questions.filter(q => q.totalAttempts > 0 && q.lastWasCorrect).length;
        const totalAnswered = questions.filter(q => q.totalAttempts > 0).length;
        
        const today = srs.todayISO();
        const todayCount = questions.filter(q => q.lastAttemptDate === today).length + 
                           flashcards.filter(f => f.lastAttemptDate === today).length;

        setSplashKpis({
            questionsDone: totalAnswered,
            questionsDoneToday: todayCount,
            accuracy: totalAnswered > 0 ? (correct / totalAnswered) * 100 : 0,
            lastTrail: { subject: 'Geral', count: totalAnswered, bank: 'Mista' },
            lastSessions: []
        });
    }, [questions, flashcards]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

        // Request Notification Permission on load if not granted
        if (Notification.permission === 'default') {
             requestNotificationPermission();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [requestNotificationPermission]);

    const handleInstallClick = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult: any) => {
                if (choiceResult.outcome === 'accepted') {
                    setDeferredPrompt(null);
                }
            });
        }
    };

    const handleDeepLink = (ref: StudyRef) => {
        if (ref.sourceType === 'LEI_SECA') {
            setActiveTab('literalness');
            setActiveStudyRef(ref);
        } else if (ref.sourceType === 'TRILHA') {
            setActiveTab('trail');
            setActiveStudyRef(ref);
        } else if (ref.sourceType === 'QUESTOES') {
            setActiveTab('list'); 
        } else if (ref.sourceType === 'FLASHCARDS') {
            setActiveTab('flashcards');
        }
    };

    // --- RENDER ---

    if (isSplashVisible) {
        return <SplashView 
            onStartApp={(tab) => {
                setIsSplashVisible(false);
                if (tab) setActiveTab(tab);
            }} 
            kpis={splashKpis} 
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
        />;
    }

    const activeTabInfo = {
        id: activeTab,
        label: NAV_LABELS[activeTab] || 'Início',
        icon: NAV_ICONS[activeTab] || <CalendarIcon />
    };

    const counts = {
        questions: questions.length,
        flashcards: flashcards.length
    };

    return (
        <div className={`flex h-screen bg-[var(--app-bg)] text-[var(--app-text)] font-sans overflow-hidden ${settings.appTheme}`}>
            <GalaxyBackground theme={settings.appTheme} />
            
            {/* --- SIDEBAR WRAPPER --- */}
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <div 
                className={`
                    fixed inset-y-0 left-0 z-50 h-full
                    transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:relative md:translate-x-0 
                    md:transition-[width] md:duration-300 md:ease-in-out
                    ${isSidebarOpen ? 'md:w-64' : 'md:w-0'}
                    bg-slate-900 border-r border-white/5 overflow-hidden
                `}
            >
                {/* Inner Width Fix for Transition Smoothness */}
                <div className="w-64 h-full">
                    <SideBar 
                        activeTab={activeTab} 
                        setActiveTab={(t) => { setActiveTab(t); if(window.innerWidth < 768) setIsSidebarOpen(false); }} 
                        counts={counts}
                        className="h-full"
                    />
                </div>
            </div>
            
            {/* --- MAIN CONTENT --- */}
            <div className="flex-1 flex flex-col h-full min-w-0 transition-all duration-300 relative z-0">
                <Header 
                    activeTabInfo={activeTabInfo} 
                    theme={settings.appTheme}
                    toggleTheme={() => updateSettings({ appTheme: settings.appTheme === 'dark' ? 'galaxy' : 'dark' })}
                    isOnline={isOnline}
                    isAppInstallable={!!deferredPrompt}
                    onInstallClick={handleInstallClick}
                    onToggleSidebar={toggleSidebar}
                    isSidebarOpen={isSidebarOpen}
                />

                <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-0 custom-scrollbar scroll-smooth p-4 pb-6 md:p-6 md:pb-6">
                    <Suspense fallback={<LoadingState message="Carregando módulo..." />}>
                        {activeTab === 'today' && <TodayView setActiveTab={setActiveTab} />}
                        {activeTab === 'study' && <StudyView onStudyRefNavigate={handleDeepLink} />}
                        {activeTab === 'flashcards' && <FlashcardsView onStudyRefNavigate={handleDeepLink} />}
                        {activeTab === 'porrada' && <PorradaGameView onStudyRefNavigate={handleDeepLink} />}
                        {activeTab === 'manage' && <AddQuestionView setActiveTab={setActiveTab} />}
                        {activeTab === 'list' && <ListView onStudyRefNavigate={handleDeepLink} />}
                        {activeTab === 'map' && <MapView onStudyRefNavigate={handleDeepLink} onToggleUI={setIsDockHidden} />}
                        {activeTab === 'dash' && <DashboardView />}
                        {activeTab === 'profile' && <ProfileView />}
                        {activeTab === 'settings' && <SettingsView onOpenQrModal={() => setIsQrModalOpen(true)} onOpenSyncModal={() => setIsSyncModalOpen(true)} />}
                        {activeTab === 'literalness' && <LiteralnessView type='LAW_DRY' activeStudyRef={activeStudyRef} />}
                        {activeTab === 'normas' && <LiteralnessView type='LAW_NORM' activeStudyRef={activeStudyRef} />}
                        {activeTab === 'jurisprudencia' && <LiteralnessView type='LAW_JURIS' activeStudyRef={activeStudyRef} />}
                        {activeTab === 'trail' && <TrailView activeStudyRef={activeStudyRef} />}
                        {activeTab === 'sectors' && <SectorsExploreView onExit={() => setActiveTab('today')} />}
                        {activeTab === 'radar' && <TrapscanView />}
                        {/* Legacy Redirects */}
                        {(activeTab === 'pair-match' || activeTab === 'battle') && <PorradaGameView />}
                    </Suspense>
                </main>
                
                <XpNotification />
            </div>
            
            <GoogleDriveSync isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
            <QRCodeModal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} url={window.location.href} />
        </div>
    );
};
