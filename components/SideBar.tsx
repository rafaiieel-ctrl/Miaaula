
import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { TabID } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { CalendarIcon, BrainIcon, PlusIcon, ListBulletIcon, ChartBarIcon, GraphIcon, TrophyIcon, CogIcon, UserCircleIcon, LockClosedIcon, ClipboardDocumentCheckIcon, BoltIcon, PuzzlePieceIcon, ScaleIcon, GamepadIcon, ClipboardListIcon, RoadIcon, SearchIcon, GavelIcon, RadarIcon, PencilIcon, CheckCircleIcon, XMarkIcon, ArrowPathIcon, GripVerticalIcon, ArrowUpIcon, ArrowDownIcon } from './icons';
import * as srs from '../services/srsService';

export const allNavItems: { id: TabID; label: string; icon: React.ReactNode }[] = [
  { id: 'today', label: 'Início', icon: <CalendarIcon /> },
  { id: 'study', label: 'Estudo', icon: <BrainIcon /> },
  { id: 'radar', label: 'Radar TRAPSCAN', icon: <RadarIcon /> },
  { id: 'sectors', label: 'Setores', icon: <SearchIcon /> },
  { id: 'flashcards', label: 'Cards', icon: <ClipboardDocumentCheckIcon /> },
  { id: 'trail', label: 'Trilhas', icon: <RoadIcon /> },
  { id: 'porrada', label: 'Arena', icon: <GamepadIcon /> },
  { id: 'literalness', label: 'Lei Seca', icon: <ScaleIcon /> },
  { id: 'normas', label: 'Normas', icon: <ClipboardDocumentCheckIcon /> },
  { id: 'jurisprudencia', label: 'Jurisprudência', icon: <GavelIcon /> },
  { id: 'manage', label: 'Gerir', icon: <PlusIcon /> },
  { id: 'list', label: 'Banco', icon: <ListBulletIcon /> },
  { id: 'map', label: 'Galaxy', icon: <GraphIcon /> },
  { id: 'dash', label: 'Analítico', icon: <ChartBarIcon /> },
  { id: 'profile', label: 'Perfil', icon: <UserCircleIcon /> },
  { id: 'settings', label: 'Ajustes', icon: <CogIcon /> },
];

const DEFAULT_ORDER: TabID[] = allNavItems.map(i => i.id);

interface SideBarProps {
  activeTab: TabID;
  setActiveTab: (tab: TabID) => void;
  counts: { questions: number; flashcards: number };
  className?: string;
}

const SideBar: React.FC<SideBarProps> = ({ activeTab, setActiveTab, counts, className = "" }) => {
    const { settings, updateSettings } = useSettings();
    const { level, progressPercent } = srs.getLevelInfo(settings.userXp);
    const sidebarRef = useRef<HTMLElement>(null);

    // State for Edit Mode
    const [isEditing, setIsEditing] = useState(false);
    const [localOrder, setLocalOrder] = useState<TabID[]>([]);
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    // --- EFFECT: SYNC ORDER FROM SETTINGS ---
    // Calculates the "current effective order" by merging saved settings with any new items found in code
    const currentEffectiveOrder = useMemo(() => {
        let baseOrder = settings.navOrder && settings.navOrder.length > 0 
            ? settings.navOrder as TabID[]
            : DEFAULT_ORDER;
        
        // Resilience: Add any new items that are in 'allNavItems' but missing from 'baseOrder'
        // This ensures updates don't break the menu
        const existingIds = new Set(baseOrder);
        const missingItems = allNavItems.filter(i => !existingIds.has(i.id)).map(i => i.id);
        
        // Special case: inject 'radar' near top if missing (legacy migration logic from previous version)
        if (missingItems.includes('radar')) {
             const radarIdx = missingItems.indexOf('radar');
             missingItems.splice(radarIdx, 1);
             // Insert 'radar' after 'study' (usually index 1) or append
             const studyIdx = baseOrder.indexOf('study');
             if (studyIdx >= 0) {
                 const newOrder = [...baseOrder];
                 newOrder.splice(studyIdx + 1, 0, 'radar');
                 baseOrder = newOrder;
             } else {
                 baseOrder = ['radar', ...baseOrder];
             }
        }
        
        return [...baseOrder, ...missingItems];
    }, [settings.navOrder]);

    // Initialize local state when not editing
    useEffect(() => {
        if (!isEditing) {
            setLocalOrder(currentEffectiveOrder);
        }
    }, [currentEffectiveOrder, isEditing]);


    // Auto-measure sidebar width for layout offsets (zoom support)
    useEffect(() => {
        if (!sidebarRef.current) return;
        const updateWidth = () => {
            if (sidebarRef.current) {
                const width = sidebarRef.current.getBoundingClientRect().width;
                document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
            }
        };
        const observer = new ResizeObserver(updateWidth);
        observer.observe(sidebarRef.current);
        updateWidth();
        return () => observer.disconnect();
    }, []);

    // --- DRAG AND DROP HANDLERS (Native HTML5) ---

    const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, index: number) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Ghost image transparency fix
        e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
    };

    const handleDragOver = (e: React.DragEvent<HTMLButtonElement>, index: number) => {
        e.preventDefault(); // Necessary to allow dropping
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        
        // Reorder on hover for smoother feel
        const newOrder = [...localOrder];
        const [movedItem] = newOrder.splice(draggedItemIndex, 1);
        newOrder.splice(index, 0, movedItem);
        
        setLocalOrder(newOrder);
        setDraggedItemIndex(index);
    };

    const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setDraggedItemIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
    };

    // --- ACCESSIBILITY / MOBILE HANDLERS ---

    const moveItem = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= localOrder.length) return;
        
        const newOrder = [...localOrder];
        [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
        setLocalOrder(newOrder);
    };

    // --- ACTION BUTTONS ---

    const handleSave = () => {
        updateSettings({ navOrder: localOrder });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setLocalOrder(currentEffectiveOrder); // Revert
        setIsEditing(false);
    };

    const handleResetDefault = () => {
        if (window.confirm("Restaurar a ordem padrão do menu?")) {
            setLocalOrder(DEFAULT_ORDER);
        }
    };

    // --- RENDER HELPERS ---
    
    // Create map for fast lookup during render
    const itemsMap = useMemo(() => {
        return new Map(allNavItems.map(i => [i.id, i]));
    }, []);

    return (
        <aside ref={sidebarRef} className={`w-64 bg-slate-900 border-r border-white/5 flex-col flex select-none ${className}`}>
            
            {/* Header: Logo */}
            <div className="p-6 flex items-center gap-3 shrink-0">
                <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-sky-500/20">
                    <span className="text-white font-black text-xs">M</span>
                </div>
                <h1 className="text-xl font-black text-white tracking-tighter italic">MIAAULA</h1>
            </div>

            {/* Scrollable Nav List */}
            <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
                {localOrder.map((itemId, index) => {
                    const itemConfig = itemsMap.get(itemId);
                    if (!itemConfig) return null; // Should not happen

                    const isDragged = draggedItemIndex === index;

                    if (isEditing) {
                        return (
                            <div
                                key={itemId}
                                draggable
                                onDragStart={(e) => handleDragStart(e as any, index)}
                                onDragOver={(e) => handleDragOver(e as any, index)}
                                onDrop={(e) => handleDrop(e as any)}
                                onDragEnd={handleDragEnd}
                                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-bold transition-all duration-200 border-2 
                                    ${isDragged 
                                        ? 'bg-sky-500/20 border-sky-500 text-sky-300 opacity-50' 
                                        : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                                    } cursor-grab active:cursor-grabbing`}
                            >
                                <div className="flex items-center gap-3 pointer-events-none">
                                    <GripVerticalIcon className="w-4 h-4 text-slate-500" />
                                    {React.cloneElement(itemConfig.icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5 text-slate-400' })}
                                    <span>{itemConfig.label}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <button onClick={() => moveItem(index, 'up')} disabled={index === 0} className="text-slate-500 hover:text-white disabled:opacity-20 p-0.5"><ArrowUpIcon className="w-3 h-3" /></button>
                                    <button onClick={() => moveItem(index, 'down')} disabled={index === localOrder.length - 1} className="text-slate-500 hover:text-white disabled:opacity-20 p-0.5"><ArrowDownIcon className="w-3 h-3" /></button>
                                </div>
                            </div>
                        );
                    }

                    // Normal Mode Item
                    return (
                        <button
                            key={itemId}
                            onClick={() => setActiveTab(itemId)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group
                                ${activeTab === itemId 
                                    ? 'bg-sky-500/10 text-sky-400 shadow-inner' 
                                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                                }
                            `}
                        >
                            <div className={`transition-transform duration-200 ${activeTab === itemId ? 'scale-110' : 'group-hover:scale-110'}`}>
                                {React.cloneElement(itemConfig.icon as React.ReactElement<{ className?: string }>, { 
                                    className: `w-5 h-5 ${activeTab === itemId ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}` 
                                })}
                            </div>
                            <span>{itemConfig.label}</span>
                        </button>
                    );
                })}
            </nav>
            
            {/* Edit Controls (Sticky at Bottom of List area, or above footer) */}
            {isEditing && (
                <div className="px-4 py-3 bg-slate-950/50 border-t border-white/5 flex flex-col gap-2 shrink-0">
                    <div className="flex gap-2">
                        <button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors">
                            <CheckCircleIcon className="w-4 h-4" /> Salvar
                        </button>
                        <button onClick={handleCancel} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors">
                            <XMarkIcon className="w-4 h-4" /> Cancelar
                        </button>
                    </div>
                    <button onClick={handleResetDefault} className="w-full text-slate-500 hover:text-rose-400 py-1 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition-colors">
                        <ArrowPathIcon className="w-3 h-3" /> Restaurar Padrão
                    </button>
                </div>
            )}

            {/* Footer: Toggle Edit & XP */}
            <div className="p-4 border-t border-white/5 shrink-0 bg-slate-900">
                 {!isEditing && (
                     <button 
                        onClick={() => setIsEditing(true)} 
                        className="w-full mb-4 flex items-center justify-center gap-2 text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest py-2 hover:bg-white/5 rounded-lg transition-all"
                     >
                        <PencilIcon className="w-3.5 h-3.5" /> Editar Menu
                     </button>
                 )}

                 <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
                     <div className="flex justify-between items-end mb-2">
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nível {level}</span>
                         <span className="text-xs font-bold text-sky-500">{settings.userXp} XP</span>
                     </div>
                     <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                         <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: `${Math.min(100, progressPercent)}%` }}></div>
                     </div>
                 </div>
            </div>
        </aside>
    );
};

export default SideBar;
