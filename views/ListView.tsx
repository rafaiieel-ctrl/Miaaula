
import React, { useState, useMemo } from 'react';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import { StudyRef, Question } from '../types';
import { SearchIcon, TrashIcon, ExclamationTriangleIcon, BoltIcon, ChevronRightIcon } from '../components/icons';
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
        return questions.filter(q => 
            q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) || 
            q.questionRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.subject.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [questions, searchTerm]);

    const handleDelete = () => {
        if (deletingId) {
            deleteQuestions([deletingId]);
            setDeletingId(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex justify-between items-center bg-white dark:bg-bunker-900 p-4 rounded-xl shadow-sm border border-bunker-200 dark:border-bunker-800 sticky top-0 z-10">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bunker-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar questões..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-bunker-50 dark:bg-bunker-950 pl-10 pr-4 py-2 rounded-lg text-sm border border-transparent focus:border-sky-500 outline-none"
                    />
                </div>
                <div className="ml-4 text-xs font-bold text-bunker-500 dark:text-bunker-400">
                    {filteredQuestions.length} questões
                </div>
            </div>

            <div className="space-y-3">
                {filteredQuestions.map(q => (
                    <div key={q.id} className="bg-white dark:bg-bunker-900 p-4 rounded-xl border border-bunker-200 dark:border-bunker-800 hover:border-sky-500/30 transition-all group relative">
                        <div className="absolute top-3 right-3 z-10">
                            <QuestionActionsMenu 
                                question={q}
                                context="questions"
                                onEdit={(question) => setEditingQuestion(question)}
                                onDelete={(id) => setDeletingId(id)}
                            />
                        </div>
                        <div className="flex justify-between items-start mb-2 pr-10">
                            <div>
                                <span className="text-xs font-black text-sky-500 uppercase tracking-wide mr-2">{q.questionRef}</span>
                                <span className="text-[10px] font-bold text-bunker-400 uppercase tracking-widest">{q.subject} • {q.topic}</span>
                            </div>
                        </div>
                        <p className="text-sm text-bunker-600 dark:text-bunker-300 line-clamp-2">{q.questionText}</p>
                    </div>
                ))}
            </div>

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
                <p>Tem certeza que deseja excluir esta questão? Esta ação não pode ser desfeita.</p>
            </ConfirmationModal>
        </div>
    );
};

export default ListView;
