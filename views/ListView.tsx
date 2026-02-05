
import React, { useState, useMemo } from 'react';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import { StudyRef, Question } from '../types';
import { SearchIcon, TrashIcon, ExclamationTriangleIcon, BoltIcon, ChevronRightIcon, BrainIcon, FilterIcon } from '../components/icons';
import EditQuestionModal from '../components/EditQuestionModal';
import ConfirmationModal from '../components/ConfirmationModal';
import QuestionActionsMenu from '../components/QuestionActionsMenu';

interface ListViewProps {
    onStudyRefNavigate?: (ref: StudyRef) => void;
}

const ListView: React.FC<ListViewProps> = ({ onStudyRefNavigate }) => {
    const questions = useQuestionState();
    const { deleteQuestions, updateQuestion } = useQuestionDispatch();
    const [searchTerm, setSearchTerm] = useState('');
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const filteredQuestions = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return questions.filter(q => 
            (q.questionText || '').toLowerCase().includes(term) || 
            (q.questionRef || '').toLowerCase().includes(term) ||
            (q.subject || '').toLowerCase().includes(term)
        );
    }, [questions, searchTerm]);

    const handleDelete = () => {
        if (deletingId) {
            deleteQuestions([deletingId]);
            setDeletingId(null);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-24 animate-fade-in px-4">
            
            {/* Header Moderno */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 pt-6">
                <div>
                    <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">Banco de Questões</h1>
                    <p className="text-slate-400 text-sm font-medium">Gerencie, edite ou exclua suas questões cadastradas.</p>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Total Registrado</span>
                    <span className="text-3xl font-black text-indigo-500">{questions.length}</span>
                </div>
            </div>

            {/* Barra de Busca Flutuante */}
            <div className="sticky top-4 z-30">
                <div className="relative group">
                    <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-50"></div>
                    <div className="relative bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center shadow-2xl">
                        <div className="p-3 text-slate-400">
                            <SearchIcon className="w-5 h-5" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Buscar por ID, texto, disciplina..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-white text-sm placeholder-slate-500 font-medium h-full py-2"
                        />
                        <div className="hidden md:flex items-center px-4 border-l border-white/10 text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {filteredQuestions.length} Resultados
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Cards */}
            <div className="grid grid-cols-1 gap-4">
                {filteredQuestions.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 rounded-[2rem] border-2 border-dashed border-white/10">
                        <FilterIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhuma questão encontrada.</p>
                    </div>
                ) : (
                    filteredQuestions.map(q => (
                        <div 
                            key={q.id} 
                            className="group relative bg-slate-900/40 hover:bg-slate-900/80 border border-white/5 hover:border-indigo-500/30 rounded-[1.5rem] p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                        >
                            {/* Actions Menu (Top Right) */}
                            <div className="absolute top-4 right-4 z-20 opacity-80 group-hover:opacity-100 transition-opacity">
                                <QuestionActionsMenu 
                                    question={q}
                                    context="questions"
                                    onEdit={(question) => setEditingQuestion(question)}
                                    onDelete={(id) => setDeletingId(id)}
                                />
                            </div>

                            <div className="flex flex-col gap-3 pr-10">
                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-black text-white bg-indigo-600 px-2 py-0.5 rounded uppercase tracking-widest shadow-lg shadow-indigo-600/20">
                                        {q.questionRef}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 border border-white/10 px-2 py-0.5 rounded uppercase tracking-wider">
                                        {q.subject}
                                    </span>
                                    {q.isCritical && (
                                        <span className="text-[9px] font-bold text-amber-500 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                            <ExclamationTriangleIcon className="w-3 h-3" /> Crítica
                                        </span>
                                    )}
                                </div>

                                {/* Text */}
                                <p className="text-sm md:text-base text-slate-300 font-medium leading-relaxed line-clamp-2 group-hover:text-white transition-colors">
                                    {q.questionText}
                                </p>

                                {/* Footer Stats */}
                                <div className="flex items-center gap-4 mt-2 pt-3 border-t border-white/5">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        <BrainIcon className="w-3.5 h-3.5" />
                                        <span>Tentativas: {q.totalAttempts}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        <span>Gabarito: {q.correctAnswer}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modais */}
            {editingQuestion && (
                <EditQuestionModal 
                    question={editingQuestion} 
                    onClose={() => setEditingQuestion(null)} 
                    onSave={(updated) => updateQuestion(updated)} 
                />
            )}

            <ConfirmationModal 
                isOpen={!!deletingId} 
                onClose={() => setDeletingId(null)} 
                onConfirm={handleDelete} 
                title="Excluir Questão?"
            >
                <div className="space-y-2">
                    <p className="text-sm text-slate-300">Tem certeza que deseja apagar esta questão permanentemente?</p>
                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Essa ação não pode ser desfeita.</p>
                </div>
            </ConfirmationModal>
        </div>
    );
};

export default ListView;
    