import React, { useState, useMemo, useEffect } from 'react';
import { useTopicState, useTopicDispatch } from '../../contexts/TopicContext';
import { useQuestionState } from '../../contexts/QuestionContext';
import { useFlashcardState } from '../../contexts/FlashcardContext';
import { Topic } from '../../types';
import { PencilIcon } from '../icons';

// Edit Modal Component
const EditTopicModal: React.FC<{
  topic: Topic;
  onClose: () => void;
  onSave: (topicId: string, description: string) => void;
}> = ({ topic, onClose, onSave }) => {
    const [description, setDescription] = useState(topic.description || '');

    const handleSave = () => {
        onSave(topic.id, description);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-bunker-50 dark:bg-bunker-950 w-full max-w-lg rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h3 className="text-lg font-bold">Editar Tópico: {topic.name}</h3>
                    <p className="text-sm text-bunker-500 dark:text-bunker-400">Disciplina: {topic.subject}</p>
                    <div className="mt-4">
                        <label htmlFor="topic-description" className="block text-sm font-medium mb-1">Descrição</label>
                        <textarea
                            id="topic-description"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={4}
                            className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2"
                            placeholder="Adicione uma breve descrição sobre este tópico..."
                        />
                    </div>
                </div>
                <div className="bg-bunker-100 dark:bg-bunker-900 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md bg-bunker-200 dark:bg-bunker-700">Cancelar</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-bold rounded-md bg-sky-600 text-white">Salvar</button>
                </div>
            </div>
        </div>
    );
};


const TopicsView: React.FC = () => {
    const allTopics = useTopicState();
    const { addOrUpdateTopic, updateTopicDescription } = useTopicDispatch();
    const allQuestions = useQuestionState();
    const allFlashcards = useFlashcardState();
    const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

    // This effect will automatically discover and add topics from questions/flashcards
    // that don't exist in the TopicContext yet.
    useEffect(() => {
        const allItems = [...allQuestions, ...allFlashcards];
        allItems.forEach(item => {
            const subject = 'subject' in item ? item.subject : item.discipline;
            if (item.topic && subject) {
                addOrUpdateTopic({ name: item.topic, subject, description: '' });
            }
        });
    }, [allQuestions, allFlashcards, addOrUpdateTopic]);

    const topicsBySubject = useMemo(() => {
        const grouped: Record<string, Topic[]> = {};
        allTopics.forEach(topic => {
            if (!grouped[topic.subject]) {
                grouped[topic.subject] = [];
            }
            grouped[topic.subject].push(topic);
        });
        // Sort topics within each subject
        Object.keys(grouped).forEach(subject => {
            grouped[subject].sort((a, b) => a.name.localeCompare(b.name));
        });
        return grouped;
    }, [allTopics]);
    
    const sortedSubjects = useMemo(() => Object.keys(topicsBySubject).sort(), [topicsBySubject]);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                <h3 className="font-bold text-lg">Gerenciar Tópicos</h3>
                <p className="text-sm text-bunker-500 dark:text-bunker-400 mt-1">
                    Adicione descrições aos seus tópicos para melhor organização. Os tópicos são descobertos automaticamente a partir de suas questões e flashcards.
                </p>
            </div>

            <div className="space-y-6">
                {sortedSubjects.length === 0 && (
                    <div className="text-center p-8 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                        <p className="text-bunker-500 dark:text-bunker-400">Nenhum tópico encontrado. Crie questões ou flashcards para que os tópicos apareçam aqui.</p>
                    </div>
                )}
                {sortedSubjects.map(subject => (
                    <div key={subject}>
                        <h4 className="font-bold text-sky-600 dark:text-sky-400 border-b border-bunker-200 dark:border-bunker-800 pb-2 mb-3">{subject}</h4>
                        <div className="space-y-2">
                            {topicsBySubject[subject].map(topic => (
                                <div key={topic.id} className="flex justify-between items-center p-3 bg-bunker-100 dark:bg-bunker-900 rounded-lg border border-bunker-200 dark:border-bunker-800">
                                    <div>
                                        <p className="font-semibold">{topic.name}</p>
                                        <p className="text-xs text-bunker-500 dark:text-bunker-400 italic">
                                            {topic.description || 'Sem descrição'}
                                        </p>
                                    </div>
                                    <button onClick={() => setEditingTopic(topic)} className="p-2 rounded-lg hover:bg-bunker-200 dark:hover:bg-bunker-800 text-bunker-500">
                                        <PencilIcon />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {editingTopic && (
                <EditTopicModal
                    topic={editingTopic}
                    onClose={() => setEditingTopic(null)}
                    onSave={updateTopicDescription}
                />
            )}
        </div>
    );
};

export default TopicsView;
