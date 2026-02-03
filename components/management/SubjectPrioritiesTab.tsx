
import React, { useMemo, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useQuestionState } from '../../contexts/QuestionContext';
import { useFlashcardState } from '../../contexts/FlashcardContext';
import { PriorityLevel } from '../../types';
import { SearchIcon, FireIcon, TrendingUpIcon, PauseIcon, BrainIcon, ClipboardDocumentCheckIcon } from '../icons';
import ConfirmationModal from '../ConfirmationModal';

// Snowflake Icon Component specifically for this UI
const SnowflakeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M2 12h20" />
        <path d="M12 2v20" />
        <path d="M20 20l-4-4" />
        <path d="M4 4l4 4" />
        <path d="M4 20l4-4" />
        <path d="M20 4l-4 4" />
        <path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
    </svg>
);

const SubjectPrioritiesTab: React.FC = () => {
    const { settings, updateSettings } = useSettings();
    const questions = useQuestionState();
    const flashcards = useFlashcardState();
    const [searchTerm, setSearchTerm] = useState('');
    const [subjectToToggle, setSubjectToToggle] = useState<string | null>(null);

    const subjectData = useMemo(() => {
        const stats: Record<string, { qCount: number; fCount: number }> = {};
        
        // Count questions
        questions.forEach(q => {
            if (!stats[q.subject]) stats[q.subject] = { qCount: 0, fCount: 0 };
            stats[q.subject].qCount++;
        });

        // Count flashcards
        flashcards.forEach(fc => {
            if (!stats[fc.discipline]) stats[fc.discipline] = { qCount: 0, fCount: 0 };
            stats[fc.discipline].fCount++;
        });

        const subjects = Object.keys(stats).sort();
        return subjects.map(subject => ({
            name: subject,
            ...stats[subject]
        }));
    }, [questions, flashcards]);

    const filteredSubjects = useMemo(() => {
        return subjectData.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [subjectData, searchTerm]);

    const handlePriorityChange = (subject: string, priority: PriorityLevel) => {
        const currentConfig = settings.subjectConfigs[subject] || { priority: 'medium', isFrozen: false };
        updateSettings({
            subjectConfigs: {
                ...settings.subjectConfigs,
                [subject]: { ...currentConfig, priority }
            }
        });
    };

    const initiateFreezeToggle = (subject: string) => {
        setSubjectToToggle(subject);
    };

    const confirmFreezeToggle = () => {
        if (subjectToToggle) {
            const currentConfig = settings.subjectConfigs[subjectToToggle] || { priority: 'medium', isFrozen: false };
            updateSettings({
                subjectConfigs: {
                    ...settings.subjectConfigs,
                    [subjectToToggle]: { ...currentConfig, isFrozen: !currentConfig.isFrozen }
                }
            });
            setSubjectToToggle(null);
        }
    };

    const isSubjectFrozen = (subject: string) => {
        return settings.subjectConfigs[subject]?.isFrozen || false;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
                <div>
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white">Gerenciar Disciplinas</h3>
                    <p className="text-sm text-bunker-500 dark:text-bunker-400 mt-1 font-medium">
                        Defina prioridades para o algoritmo ou congele o que não está estudando agora.
                    </p>
                </div>
                <div className="relative w-full md:w-64">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-bunker-400">
                        <SearchIcon />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Buscar disciplina..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-bunker-100 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-sky-500 outline-none text-slate-900 dark:text-white"
                    />
                </div>
            </div>

            {filteredSubjects.length === 0 ? (
                <div className="text-center py-12 bg-bunker-100 dark:bg-bunker-900/50 rounded-xl border border-dashed border-bunker-300 dark:border-bunker-700">
                    <p className="text-bunker-500 dark:text-bunker-400 font-medium">Nenhuma disciplina encontrada.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSubjects.map(({ name, qCount, fCount }) => {
                        const config = settings.subjectConfigs[name] || { priority: 'medium', isFrozen: false };
                        const isFrozen = config.isFrozen;

                        return (
                            <div 
                                key={name} 
                                className={`relative rounded-xl border p-4 transition-all duration-300 flex flex-col justify-between group
                                    ${isFrozen 
                                        ? 'bg-sky-50/80 dark:bg-sky-900/10 border-sky-200 dark:border-sky-800/50 shadow-inner' 
                                        : 'bg-transparent dark:bg-bunker-900 border-bunker-200 dark:border-bunker-800 shadow-sm hover:shadow-md'
                                    }`}
                            >
                                {/* Frozen Overlay Effect */}
                                {isFrozen && (
                                    <div className="absolute top-2 right-2 text-sky-400 opacity-20 pointer-events-none transform rotate-12 scale-150">
                                        <SnowflakeIcon className="w-24 h-24" />
                                    </div>
                                )}

                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className={`font-bold text-lg leading-tight pr-2 ${isFrozen ? 'text-sky-800 dark:text-sky-300' : 'text-slate-900 dark:text-slate-100'}`}>
                                            {name}
                                        </h4>
                                        <button 
                                            onClick={() => initiateFreezeToggle(name)}
                                            className={`p-2 rounded-full transition-all shrink-0 ${
                                                isFrozen 
                                                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30 rotate-180 hover:bg-sky-600' 
                                                    : 'bg-bunker-100 dark:bg-bunker-800 text-bunker-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20'
                                            }`}
                                            title={isFrozen ? "Descongelar Disciplina" : "Congelar Disciplina"}
                                        >
                                            {isFrozen ? <SnowflakeIcon className="w-5 h-5" /> : <PauseIcon />}
                                        </button>
                                    </div>

                                    <div className="flex gap-3 mb-4">
                                        {qCount > 0 && (
                                            <span className={`text-xs font-semibold px-2 py-1 rounded flex items-center gap-1.5 ${isFrozen ? 'bg-sky-200/50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-bunker-100 dark:bg-bunker-800 text-bunker-600 dark:text-bunker-400'}`}>
                                                <BrainIcon /> {qCount}
                                            </span>
                                        )}
                                        {fCount > 0 && (
                                            <span className={`text-xs font-semibold px-2 py-1 rounded flex items-center gap-1.5 ${isFrozen ? 'bg-sky-200/50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-bunker-100 dark:bg-bunker-800 text-bunker-600 dark:text-bunker-400'}`}>
                                                <ClipboardDocumentCheckIcon /> {fCount}
                                            </span>
                                        )}
                                        {qCount === 0 && fCount === 0 && <span className="text-xs text-bunker-400 italic">Sem conteúdo</span>}
                                    </div>
                                </div>

                                <div className={`pt-3 border-t ${isFrozen ? 'border-sky-200 dark:border-sky-800/30 opacity-50 pointer-events-none grayscale' : 'border-bunker-100 dark:border-bunker-800'}`}>
                                    <p className="text-[10px] uppercase font-bold text-bunker-500 dark:text-bunker-400 mb-2 tracking-wider">Frequência de Revisão</p>
                                    <div className="flex bg-bunker-100 dark:bg-bunker-800 p-1 rounded-lg">
                                        <button
                                            onClick={() => handlePriorityChange(name, 'low')}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.priority === 'low' ? 'bg-transparent dark:bg-bunker-700 text-slate-700 dark:text-slate-300 shadow-sm' : 'text-bunker-400 hover:text-bunker-600'}`}
                                        >
                                            Baixa
                                        </button>
                                        <button
                                            onClick={() => handlePriorityChange(name, 'medium')}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.priority === 'medium' ? 'bg-transparent dark:bg-bunker-700 text-sky-700 dark:text-sky-400 shadow-sm' : 'text-bunker-400 hover:text-bunker-600'}`}
                                        >
                                            Média
                                        </button>
                                        <button
                                            onClick={() => handlePriorityChange(name, 'high')}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${config.priority === 'high' ? 'bg-transparent dark:bg-bunker-700 text-amber-600 shadow-sm' : 'text-bunker-400 hover:text-bunker-600'}`}
                                        >
                                            Alta <FireIcon />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmationModal
                isOpen={!!subjectToToggle}
                onClose={() => setSubjectToToggle(null)}
                onConfirm={confirmFreezeToggle}
                title={subjectToToggle && isSubjectFrozen(subjectToToggle) ? "Descongelar Disciplina?" : "Congelar Disciplina?"}
            >
                {subjectToToggle && isSubjectFrozen(subjectToToggle) ? (
                    <p>
                        A disciplina <strong>{subjectToToggle}</strong> voltará a aparecer nas suas filas de revisão diária e sessões de estudo.
                    </p>
                ) : (
                    <p>
                        Ao congelar <strong>{subjectToToggle}</strong>, todas as questões e flashcards desta disciplina serão ocultados das revisões e estatísticas até que você a descongele.
                    </p>
                )}
            </ConfirmationModal>
        </div>
    );
};

export default SubjectPrioritiesTab;
