
import React, { useState } from 'react';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import { useFlashcardState, useFlashcardDispatch } from '../contexts/FlashcardContext';
import { TabID } from '../types';
import { 
  BrainIcon, 
  ClipboardDocumentCheckIcon, 
  PuzzlePieceIcon, 
  TagIcon, 
  PlusIcon, 
  UploadIcon, 
  SparklesIcon, 
  DownloadIcon, 
  ChartBarIcon, 
  PencilIcon
} from '../components/icons';
import LoadingState from '../components/LoadingState';

// --- LAZY COMPONENTS ---
const ManualAddTab = React.lazy(() => import('../components/management/questions/ManualAddTab'));
const ImportTxtTab = React.lazy(() => import('../components/management/questions/ImportTxtTab'));
const ExportTab = React.lazy(() => import('../components/management/questions/ExportTab'));
const ImportPromptTab = React.lazy(() => import('../components/management/questions/ImportPromptTab'));

const CreateFlashcardTab = React.lazy(() => import('../components/management/flashcards/CreateFlashcardTab'));
const ImportFlashcardTab = React.lazy(() => import('../components/management/flashcards/ImportFlashcardTab'));
const ExportFlashcardTab = React.lazy(() => import('../components/management/flashcards/ExportFlashcardTab'));

const TopicsView = React.lazy(() => import('../components/management/TopicsView'));
const SubjectPrioritiesTab = React.lazy(() => import('../components/management/SubjectPrioritiesTab'));

// --- TYPES & DATA ---

type MainSection = 'questions' | 'flashcards' | 'topics';

interface AddQuestionViewProps {
  setActiveTab: (tab: TabID) => void;
}

// --- SUB-COMPONENTS ---

const MainCategoryCard: React.FC<{
  id: MainSection;
  label: string;
  description: string;
  icon: React.ReactNode;
  isActive: boolean;
  colorClass: string;
  onClick: () => void;
}> = ({ label, description, icon, isActive, colorClass, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-start text-left p-4 rounded-2xl border-2 transition-all duration-200 relative overflow-hidden group w-full md:w-auto flex-1
      ${isActive 
        ? `bg-transparent dark:bg-bunker-800 ${colorClass.replace('text-', 'border-')} shadow-md text-slate-900 dark:text-white` 
        : 'bg-bunker-50 dark:bg-bunker-900 border-transparent hover:bg-transparent dark:hover:bg-bunker-800 hover:border-bunker-200 dark:hover:border-bunker-700 text-bunker-600 dark:text-bunker-400'
      }
    `}
  >
    <div className={`p-3 rounded-xl mb-3 ${isActive ? colorClass.replace('text-', 'bg-').replace('500', '100') + ' dark:bg-opacity-20' : 'bg-bunker-200 dark:bg-bunker-800 text-bunker-500'}`}>
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `w-6 h-6 ${isActive ? colorClass : ''}` })}
    </div>
    <span className={`font-bold text-lg ${isActive ? 'text-slate-950 dark:text-white' : 'text-bunker-600 dark:text-bunker-400'}`}>
      {label}
    </span>
    <span className={`text-xs mt-1 leading-snug ${isActive ? 'text-slate-700 dark:text-bunker-500' : 'text-bunker-50'}`}>
      {description}
    </span>
  </button>
);

const PillNav: React.FC<{
  items: { id: string; label: string; icon: React.ReactNode }[];
  activeId: string;
  onChange: (id: any) => void;
}> = ({ items, activeId, onChange }) => (
  <div className="bg-bunker-100 dark:bg-bunker-900 p-1.5 rounded-xl inline-flex flex-wrap gap-1 w-full md:w-auto">
    {items.map(item => (
      <button
        key={item.id}
        onClick={() => onChange(item.id)}
        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
          ${activeId === item.id 
            ? 'bg-transparent dark:bg-bunker-800 text-slate-950 dark:text-white shadow-sm' 
            : 'text-bunker-500 dark:text-bunker-400 hover:text-slate-700 dark:hover:text-bunker-200 hover:bg-bunker-200/50 dark:hover:bg-bunker-800/50'
          }
        `}
      >
        {item.icon}
        <span className="whitespace-nowrap">{item.label}</span>
      </button>
    ))}
  </div>
);

// --- MAIN COMPONENT ---

const AddQuestionView: React.FC<AddQuestionViewProps> = ({ setActiveTab }) => {
  const [mainTab, setMainTab] = useState<MainSection>('questions');
  const [activeQuestionSubTab, setActiveQuestionSubTab] = useState<'manual' | 'txt' | 'ai' | 'export' | 'priorities'>('manual');
  const [activeFlashcardSubTab, setActiveFlashcardSubTab] = useState<'create' | 'import' | 'export' | 'priorities'>('create');

  const questionSubTabs = [
    { id: 'manual', label: 'Manual', icon: <PencilIcon className="w-4 h-4" /> },
    { id: 'ai', label: 'IA Mágica', icon: <SparklesIcon className="w-4 h-4 text-purple-500" /> },
    { id: 'txt', label: 'Lote (.txt)', icon: <UploadIcon className="w-4 h-4" /> },
    { id: 'priorities', label: 'Prioridades', icon: <ChartBarIcon className="w-4 h-4" /> },
    { id: 'export', label: 'Backup', icon: <DownloadIcon className="w-4 h-4" /> },
  ];

  const flashcardSubTabs = [
    { id: 'create', label: 'Novo Card', icon: <PlusIcon className="w-4 h-4" /> },
    { id: 'import', label: 'Importar', icon: <UploadIcon className="w-4 h-4" /> },
    { id: 'priorities', label: 'Prioridades', icon: <ChartBarIcon className="w-4 h-4" /> },
    { id: 'export', label: 'Backup', icon: <DownloadIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 text-slate-900 dark:text-white">
      
      {/* Header */}
      <div className="text-center md:text-left space-y-2">
        <h2 className="text-3xl font-black text-slate-950 dark:text-white tracking-tight">Central de Conteúdo</h2>
        <p className="text-bunker-500 dark:text-bunker-400 text-lg font-medium">Gerencie sua base de conhecimento.</p>
      </div>

      {/* Main Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <MainCategoryCard 
          id="questions" 
          label="Questões" 
          description="Bancos de questões de prova."
          icon={<BrainIcon />} 
          isActive={mainTab === 'questions'} 
          colorClass="text-sky-500"
          onClick={() => setMainTab('questions')} 
        />
        <MainCategoryCard 
          id="flashcards" 
          label="Flashcards" 
          description="Cartões de memorização rápida."
          icon={<ClipboardDocumentCheckIcon />} 
          isActive={mainTab === 'flashcards'} 
          colorClass="text-teal-500"
          onClick={() => setMainTab('flashcards')} 
        />
        <MainCategoryCard 
          id="topics" 
          label="Tópicos" 
          description="Organização das disciplinas."
          icon={<TagIcon />} 
          isActive={mainTab === 'topics'} 
          colorClass="text-amber-500"
          onClick={() => setMainTab('topics')} 
        />
      </div>

      {/* Content Area */}
      <div className="animate-fade-in bg-transparent dark:bg-bunker-900/50 rounded-3xl border border-bunker-200 dark:border-bunker-800 p-1 md:p-6 shadow-sm text-slate-900 dark:text-slate-100">
        <React.Suspense fallback={<LoadingState message="Carregando módulo..." />}>
          
          {/* Question Logic */}
          {mainTab === 'questions' && (
            <div className="space-y-6">
              <div className="flex justify-center md:justify-start border-b border-bunker-100 dark:border-bunker-800 pb-4 md:pb-0">
                <PillNav items={questionSubTabs} activeId={activeQuestionSubTab} onChange={setActiveQuestionSubTab} />
              </div>
              <div className="p-2 md:p-4">
                {activeQuestionSubTab === 'manual' && <ManualAddTab setActiveTab={setActiveTab} />}
                {activeQuestionSubTab === 'txt' && <ImportTxtTab setActiveTab={setActiveTab} />}
                {activeQuestionSubTab === 'ai' && <ImportPromptTab setActiveTab={setActiveTab} />}
                {activeQuestionSubTab === 'export' && <ExportTab />}
                {activeQuestionSubTab === 'priorities' && <SubjectPrioritiesTab />}
              </div>
            </div>
          )}

          {/* Flashcard Logic */}
          {mainTab === 'flashcards' && (
            <div className="space-y-6">
              <div className="flex justify-center md:justify-start border-b border-bunker-100 dark:border-bunker-800 pb-4 md:pb-0">
                <PillNav items={flashcardSubTabs} activeId={activeFlashcardSubTab} onChange={setActiveFlashcardSubTab} />
              </div>
              <div className="p-2 md:p-4">
                {activeFlashcardSubTab === 'create' && <CreateFlashcardTab />}
                {activeFlashcardSubTab === 'import' && <ImportFlashcardTab />}
                {activeFlashcardSubTab === 'export' && <ExportFlashcardTab />}
                {activeFlashcardSubTab === 'priorities' && <SubjectPrioritiesTab />}
              </div>
            </div>
          )}

          {/* Topics Logic */}
          {mainTab === 'topics' && (
            <div className="p-2 md:p-4">
                <div className="mb-6 pb-4 border-b border-bunker-100 dark:border-bunker-800">
                    <h3 className="font-bold text-xl text-amber-700 dark:text-amber-400">Gerenciar Tópicos</h3>
                    <p className="text-sm text-bunker-500 font-medium">Adicione descrições e organize sua hierarquia de estudo.</p>
                </div>
                <TopicsView />
            </div>
          )}

        </React.Suspense>
      </div>
    </div>
  );
};

export default AddQuestionView;
