
import React, { useState } from 'react';
import { StudyRef, TabID } from '../types';
import { useFlashcardState } from '../contexts/FlashcardContext';
import { useSettings } from '../contexts/SettingsContext';
import { PlusIcon, ListBulletIcon, BrainIcon, UploadIcon, DownloadIcon } from '../components/icons';

// Lazy load sub-views
const CreateView = React.lazy(() => import('./flashcards/CreateView'));
const DecksView = React.lazy(() => import('./flashcards/DecksView'));
const StudyView = React.lazy(() => import('./flashcards/StudyView'));
const ImportView = React.lazy(() => import('./flashcards/ImportView'));

interface FlashcardsViewProps {
    onStudyRefNavigate?: (ref: StudyRef) => void;
}

const FlashcardsView: React.FC<FlashcardsViewProps> = ({ onStudyRefNavigate }) => {
    const [subTab, setSubTab] = useState<'study' | 'decks' | 'create' | 'import'>('study');
    const allFlashcards = useFlashcardState();

    const navItems = [
        { id: 'study', label: 'Estudar', icon: <BrainIcon className="w-4 h-4" /> },
        { id: 'decks', label: 'Meus Decks', icon: <ListBulletIcon className="w-4 h-4" /> },
        { id: 'create', label: 'Criar', icon: <PlusIcon className="w-4 h-4" /> },
        { id: 'import', label: 'Importar', icon: <UploadIcon className="w-4 h-4" /> },
    ];

    return (
        <div className="max-w-5xl mx-auto pb-24">
            <div className="flex justify-center mb-8">
                <div className="bg-bunker-100 dark:bg-bunker-900 p-1 rounded-xl flex gap-1">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setSubTab(item.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                subTab === item.id 
                                    ? 'bg-white dark:bg-bunker-800 text-sky-600 dark:text-sky-400 shadow-sm' 
                                    : 'text-bunker-500 hover:text-bunker-700 dark:hover:text-bunker-300'
                            }`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <React.Suspense fallback={<div className="text-center py-10">Carregando módulo...</div>}>
                {subTab === 'study' && <StudyView allFlashcards={allFlashcards} />}
                {subTab === 'decks' && <DecksView allFlashcards={allFlashcards} />}
                {subTab === 'create' && <CreateView />}
                {subTab === 'import' && <ImportView />}
            </React.Suspense>
        </div>
    );
};

export default FlashcardsView;
