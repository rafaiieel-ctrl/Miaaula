
import React, { useState } from 'react';
import { Question } from '../types';
import { useQuestionDispatch } from '../contexts/QuestionContext';
import { useSettings } from '../contexts/SettingsContext';
import * as studyLater from '../services/studyLaterService';
import { 
    EllipsisHorizontalIcon, 
    BookmarkIcon, 
    BookmarkSolidIcon, 
    ExclamationTriangleIcon, 
    PencilIcon, 
    TrashIcon 
} from './icons';

export type QuestionContextType = 'orbital' | 'questions' | 'session' | 'literalness';

interface QuestionActionsMenuProps {
    question: Question;
    context: QuestionContextType;
    onEdit?: (q: Question) => void;
    onDelete?: (id: string) => void;
    className?: string;
}

const QuestionActionsMenu: React.FC<QuestionActionsMenuProps> = ({ 
    question, 
    context, 
    onEdit, 
    onDelete,
    className = ""
}) => {
    const { updateQuestion } = useQuestionDispatch();
    const { updateSettings } = useSettings(); 
    const [isOpen, setIsOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(studyLater.isStudyLater(question.id));

    if (context === 'literalness') {
        return null;
    }

    const handleToggleSaveLater = () => {
        const newState = studyLater.toggleStudyLater(question.id);
        setIsSaved(newState);
        setIsOpen(false);
        updateSettings({}); 
    };

    const handleToggleCritical = () => {
        updateQuestion({ ...question, isCritical: !question.isCritical });
        setIsOpen(false);
    };

    const handleEdit = () => {
        if (onEdit) onEdit(question);
        setIsOpen(false);
    };

    const handleDelete = () => {
        // A confirmação é feita no componente pai se onDelete for passado
        if (onDelete) {
             onDelete(question.id);
        }
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} onClick={e => e.stopPropagation()}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2.5 rounded-xl transition-all border ${isOpen ? 'bg-white/10 text-white border-white/10' : 'bg-transparent text-slate-500 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5'}`}
                title="Ações da Questão"
            >
                <EllipsisHorizontalIcon className="w-5 h-5" />
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-[50]" 
                        onClick={() => setIsOpen(false)} 
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-fade-in p-1.5">
                        
                        <div className="space-y-1">
                            <button 
                                onClick={handleToggleSaveLater}
                                className="w-full text-left px-3 py-2.5 rounded-xl text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-3 transition-colors uppercase tracking-wider"
                            >
                                {isSaved ? <BookmarkSolidIcon className="w-4 h-4 text-indigo-400" /> : <BookmarkIcon className="w-4 h-4 text-slate-500" />}
                                {isSaved ? 'Remover Salvo' : 'Ver Depois'}
                            </button>
                            
                            <button 
                                onClick={handleToggleCritical}
                                className="w-full text-left px-3 py-2.5 rounded-xl text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-3 transition-colors uppercase tracking-wider"
                            >
                                <ExclamationTriangleIcon className={`w-4 h-4 ${question.isCritical ? 'text-amber-500' : 'text-slate-500'}`} />
                                {question.isCritical ? 'Desmarcar Crítica' : 'Marcar Crítica'}
                            </button>
                        </div>

                        <div className="h-px bg-white/10 my-1.5 mx-2"></div>

                        <div className="space-y-1">
                            {onEdit && (
                                <button 
                                    onClick={handleEdit}
                                    className="w-full text-left px-3 py-2.5 rounded-xl text-[11px] font-bold text-sky-400 hover:text-white hover:bg-sky-500/20 flex items-center gap-3 transition-colors uppercase tracking-wider"
                                >
                                    <PencilIcon className="w-4 h-4" /> Editar Questão
                                </button>
                            )}

                            {onDelete && (
                                <button 
                                    onClick={handleDelete}
                                    className="w-full text-left px-3 py-2.5 rounded-xl text-[11px] font-bold text-rose-500 hover:text-white hover:bg-rose-500/20 flex items-center gap-3 transition-colors uppercase tracking-wider"
                                >
                                    <TrashIcon className="w-4 h-4" /> Excluir Questão
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default QuestionActionsMenu;
    