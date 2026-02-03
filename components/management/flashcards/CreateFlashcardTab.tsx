
import React, { useState, useMemo, useEffect } from 'react';
import { useFlashcardState, useFlashcardDispatch } from '../../../contexts/FlashcardContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { Flashcard } from '../../../types';
import { ChevronDownIcon } from '../../icons';
import * as srs from '../../../services/srsService';
import DuplicateDetectorPanel from '../../DuplicateDetectorPanel';
import FlashcardStudySessionModal from '../../FlashcardStudySessionModal';
import { normalizeDiscipline } from '../../../services/taxonomyService';

const CreateFlashcardTab: React.FC = () => {
    const { addFlashcard, deleteFlashcards } = useFlashcardDispatch();
    const allFlashcards = useFlashcardState();
    const { settings } = useSettings();

    const [form, setForm] = useState({
        discipline: '',
        topic: '',
        front: '',
        back: '',
        tags: '',
        comments: '',
        frontImage: '',
        frontAudio: '',
        backImage: '',
        backAudio: '',
    });

    const [duplicates, setDuplicates] = useState<{ id: string; reason: 'EXACT' | 'NEAR'; item: Flashcard }[]>([]);
    const [isDetecting, setIsDetecting] = useState(false);
    const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
    const [cardToView, setCardToView] = useState<Flashcard | null>(null);

    const { uniqueDisciplines, uniqueTopics } = useMemo(() => {
        const disciplines = [...new Set(allFlashcards.map(fc => fc.discipline).filter(Boolean))].sort();
        const topics = [...new Set(allFlashcards.map(fc => fc.topic).filter(Boolean))].sort();
        return { uniqueDisciplines: disciplines, uniqueTopics: topics };
    }, [allFlashcards]);

    useEffect(() => {
        const detect = () => {
            setIsDetecting(true);
            const currentFront = srs.normalizeTextForDedup(form.front);
            const currentBack = srs.normalizeTextForDedup(form.back);

            if (!currentFront || currentFront.length < 5 || !currentBack) {
                setDuplicates([]);
                setIsDetecting(false);
                return;
            }

            const results: { id: string; reason: 'EXACT' | 'NEAR'; item: Flashcard }[] = [];

            allFlashcards.forEach(fc => {
                if (ignoredIds.has(fc.id)) return;
                
                const fcFront = srs.normalizeTextForDedup(fc.front);
                const fcBack = srs.normalizeTextForDedup(fc.back);
                
                if (fcFront === currentFront) {
                    if (fcBack === currentBack) {
                        results.push({ id: fc.id, reason: 'EXACT', item: fc });
                    } else {
                        results.push({ id: fc.id, reason: 'NEAR', item: fc });
                    }
                }
            });

            setDuplicates(results);
            setIsDetecting(false);
        };

        const timer = setTimeout(detect, 500);
        return () => clearTimeout(timer);
    }, [form.front, form.back, allFlashcards, ignoredIds]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.discipline || !form.front || !form.back) {
            alert("Preencha os campos obrigatórios: Disciplina, Frente e Verso.");
            return;
        }

        const newFlashcard: Omit<Flashcard, 'id'> = {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            discipline: normalizeDiscipline(form.discipline),
            topic: form.topic,
            front: form.front,
            back: form.back,
            comments: form.comments,
            frontImage: form.frontImage || undefined,
            frontAudio: form.frontAudio || undefined,
            backImage: form.backImage || undefined,
            backAudio: form.backAudio || undefined,
            type: 'basic', 
            tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
            stability: settings.srsV2?.S_default_days ?? 1,
            lastReviewedAt: undefined,
            nextReviewDate: new Date().toISOString(),
            masteryScore: 0,
            recentError: 0,
            hotTopic: false,
            isCritical: false,
            isFundamental: false,
            totalAttempts: 0,
            lastWasCorrect: false,
            correctStreak: 0,
            srsStage: 0,
            lastAttemptDate: '',
            attemptHistory: [],
            masteryHistory: [],
            timeSec: 0,
            selfEvalLevel: 0,
            pairMatchPlayed: false,
        };

        addFlashcard(newFlashcard);
        alert('Flashcard criado com sucesso!');
        setForm({ 
            discipline: '', topic: '', front: '', back: '', tags: '',
            comments: '',
            frontImage: '', frontAudio: '', backImage: '', backAudio: '' 
        });
        setDuplicates([]);
        setIgnoredIds(new Set());
    };

    const handleRemoveDuplicate = (id: string) => {
        if (window.confirm("Tem certeza que deseja remover este card duplicado?")) {
            deleteFlashcards([id]);
            alert("Flashcard removido.");
        }
    };

    const handleIgnoreDuplicate = (id: string) => {
        setIgnoredIds(prev => new Set(prev).add(id));
        setDuplicates(prev => prev.filter(d => d.id !== id));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg max-w-4xl mx-auto">
            <h3 className="font-bold text-lg">Criar Novo Flashcard</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="discipline_fc" className="block text-sm font-medium mb-1">Disciplina *</label>
                    <input id="discipline_fc" name="discipline" value={form.discipline} onChange={handleChange} list="disciplines-datalist-fc" required className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
                    <datalist id="disciplines-datalist-fc">
                        {uniqueDisciplines.map(d => <option key={d} value={d} />)}
                    </datalist>
                </div>
                <div>
                    <label htmlFor="topic_fc" className="block text-sm font-medium mb-1">Tópico</label>
                    <input id="topic_fc" name="topic" value={form.topic} onChange={handleChange} list="topics-datalist-fc" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
                    <datalist id="topics-datalist-fc">
                        {uniqueTopics.map(t => <option key={t} value={t} />)}
                    </datalist>
                </div>
            </div>
            
            <details className="group border border-bunker-200 dark:border-bunker-800 rounded-lg p-4 bg-bunker-50/50 dark:bg-bunker-800/50">
                <summary className="flex justify-between items-center cursor-pointer font-medium text-sm text-sky-600 dark:text-sky-400">
                    <span>Adicionar Mídia (Imagens/Áudio) - Opcional</span>
                    <div className="transition-transform group-open:rotate-180">
                        <ChevronDownIcon />
                    </div>
                </summary>
                <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-bunker-500 dark:text-bunker-400 uppercase">Mídia Frente</label>
                            <input name="frontImage" value={form.frontImage} onChange={handleChange} placeholder="URL da Imagem (Frente)" className="w-full mb-2 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2 text-sm" />
                            <input name="frontAudio" value={form.frontAudio} onChange={handleChange} placeholder="URL do Áudio (Frente)" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-bunker-500 dark:text-bunker-400 uppercase">Mídia Verso</label>
                            <input name="backImage" value={form.backImage} onChange={handleChange} placeholder="URL da Imagem (Verso)" className="w-full mb-2 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2 text-sm" />
                            <input name="backAudio" value={form.backAudio} onChange={handleChange} placeholder="URL do Áudio (Verso)" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2 text-sm" />
                        </div>
                    </div>
                </div>
            </details>

            <DuplicateDetectorPanel 
                entityType="flashcard"
                duplicates={duplicates}
                isDetecting={isDetecting}
                onOpen={(fc) => setCardToView(fc)}
                onRemove={handleRemoveDuplicate}
                onIgnore={handleIgnoreDuplicate}
            />

            <div>
                <label htmlFor="front" className="block text-sm font-medium mb-1">Frente *</label>
                <textarea id="front" name="front" value={form.front} onChange={handleChange} required rows={4} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
            </div>
            <div>
                <label htmlFor="back" className="block text-sm font-medium mb-1">Verso *</label>
                <textarea id="back" name="back" value={form.back} onChange={handleChange} required rows={4} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
            </div>
             <div>
                <label htmlFor="comments_fc" className="block text-sm font-medium mb-1">Anotações Pessoais</label>
                <textarea id="comments_fc" name="comments" value={form.comments} onChange={handleChange} rows={3} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
            </div>
            <div>
                <label htmlFor="tags" className="block text-sm font-medium mb-1">Tags (separadas por vírgula)</label>
                <input id="tags" name="tags" value={form.tags} onChange={handleChange} className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
            </div>
            <div className="flex justify-end">
                <button type="submit" className="bg-sky-500 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-colors">Salvar Flashcard</button>
            </div>

            {cardToView && (
                 <FlashcardStudySessionModal 
                    isOpen={!!cardToView}
                    onClose={() => setCardToView(null)}
                    title="Visualizar Card Duplicado"
                    cards={[cardToView]}
                 />
            )}
        </form>
    );
};

export default CreateFlashcardTab;
