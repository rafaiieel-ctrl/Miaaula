
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
    const { updateSettings } = useSettings(); // Trigger re-renders if needed
    const [isOpen, setIsOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(studyLater.isStudyLater(question.id));

    // REGRA DE NEGÓCIO: Se for contexto Literalness (Lei Seca), não renderiza nada.
    if (context === 'literalness') {
        return null;
    }

    const handleToggleSaveLater = () => {
        const newState = studyLater.toggleStudyLater(question.id);
        setIsSaved(newState);
        setIsOpen(false);
        // Force update to ensure UI reflects change globally if needed
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
        if (onDelete) {
            if (window.confirm("Tem certeza que deseja excluir esta questão?")) {
                onDelete(question.id);
            }
        }
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} onClick={e => e.stopPropagation()}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Ações da Questão"
            >
                <EllipsisHorizontalIcon className="w-6 h-6" />
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-[50]" 
                        onClick={() => setIsOpen(false)} 
                    />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden animate-fade-in py-1">
                        <button 
                            onClick={handleToggleSaveLater}
                            className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2"
                        >
                            {isSaved ? <BookmarkSolidIcon className="w-4 h-4 text-indigo-400" /> : <BookmarkIcon className="w-4 h-4" />}
                            {isSaved ? 'Remover dos Salvos' : 'Ver Depois'}
                        </button>
                        
                        <button 
                            onClick={handleToggleCritical}
                            className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2"
                        >
                            <ExclamationTriangleIcon className={`w-4 h-4 ${question.isCritical ? 'text-amber-500' : ''}`} />
                            {question.isCritical ? 'Desmarcar Crítica' : 'Marcar Crítica'}
                        </button>

                        {(onEdit || onDelete) && <div className="h-px bg-white/10 my-1"></div>}

                        {onEdit && (
                            <button 
                                onClick={handleEdit}
                                className="w-full text-left px-4 py-3 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2"
                            >
                                <PencilIcon className="w-4 h-4" /> Editar
                            </button>
                        )}

                        {onDelete && (
                            <button 
                                onClick={handleDelete}
                                className="w-full text-left px-4 py-3 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2"
                            >
                                <TrashIcon className="w-4 h-4" /> Excluir
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default QuestionActionsMenu;
