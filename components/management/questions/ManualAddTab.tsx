
import React, { useState, useEffect } from 'react';
import { useQuestionDispatch, useQuestionState } from '../../../contexts/QuestionContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { Question } from '../../../types';
import * as srs from '../../../services/srsService';
import { normalizeDiscipline } from '../../../services/taxonomyService';
import { ChevronDownIcon, PlusIcon, TrashIcon } from '../../../components/icons';

interface ManualAddTabProps {
    setActiveTab: (tab: 'list') => void;
}

const ManualAddTab: React.FC<ManualAddTabProps> = ({ setActiveTab }) => {
    const { addQuestion } = useQuestionDispatch();
    const { settings } = useSettings();
    const allQuestions = useQuestionState();

    const [form, setForm] = useState({
        questionRef: '',
        discipline: '',
        topic: '',
        subtopic: '',
        questionText: '',
        options: { A: '', B: '', C: '', D: '', E: '' },
        correctAnswer: 'A',
        explanation: '',
        explanationTech: '',
        explanationStory: '',
        feynmanQuestions: '',
        keyDistinction: '',
        anchorText: '',
        wrongDiagnosis: '',
        guiaTrapscan: '',
        bank: '',
        position: '',
        questionType: 'Literalidade',
        lawRef: '',
        isCebraspe: false
    });

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    
    // Auto-generate Ref based on discipline/topic if empty
    useEffect(() => {
        if (!form.questionRef && form.discipline) {
            const prefix = form.discipline.substring(0, 3).toUpperCase();
            const count = allQuestions.filter(q => q.subject === form.discipline).length + 1;
            setForm(prev => ({ ...prev, questionRef: `${prefix}-Q${String(count).padStart(3, '0')}` }));
        }
    }, [form.discipline, allQuestions.length]);

    const handleChange = (field: string, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleOptionChange = (key: string, value: string) => {
        setForm(prev => ({
            ...prev,
            options: { ...prev.options, [key]: value }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!form.questionText || !form.discipline || !form.correctAnswer) {
            alert('Preencha os campos obrigatórios (*)');
            return;
        }

        const today = srs.todayISO();
        
        // Use pt-BR as default language key
        const toI18n = (s: string): Record<string, string> => ({ "pt-BR": s ?? "" });

        const newQuestion: Omit<Question, 'id'> = {
            questionRef: form.questionRef,
            questionText: form.questionText,
            options: form.isCebraspe ? { A: 'Certo', B: 'Errado' } : form.options,
            correctAnswer: form.correctAnswer,
            subject: normalizeDiscipline(form.discipline),
            topic: form.topic || 'Geral',
            subtopic: form.subtopic,
            
            explanation: form.explanation || form.explanationTech, // Fallback
            explanationTech: form.explanationTech,
            explanationStory: form.explanationStory,
            feynmanQuestions: form.feynmanQuestions,
            
            keyDistinction: form.keyDistinction,
            anchorText: toI18n(form.anchorText),
            wrongDiagnosis: toI18n(form.wrongDiagnosis),
            guiaTrapscan: form.guiaTrapscan,
            
            bank: form.bank,
            position: form.position,
            questionType: form.questionType,
            lawRef: form.lawRef,
            
            createdAt: today,
            nextReviewDate: today,
            stability: settings.srsV2.S_default_days,
            masteryScore: 0,
            totalAttempts: 0,
            attemptHistory: [],
            
            // Defaults
            lastAttemptDate: '',
            lastWasCorrect: false,
            recentError: 0,
            hotTopic: false,
            isCritical: false,
            isFundamental: false,
            willFallExam: false,
            correctStreak: 0,
            errorCount: 0,
            timeSec: 0,
            selfEvalLevel: 0,
            srsStage: 0,
            srsVersion: 2,
            comments: ''
        };

        addQuestion(newQuestion);
        alert('Questão adicionada com sucesso!');
        
        // Reset form but keep some fields for speed
        setForm(prev => ({
            ...prev,
            questionRef: '',
            questionText: '',
            options: { A: '', B: '', C: '', D: '', E: '' },
            explanation: '',
            explanationTech: '',
            explanationStory: '',
            feynmanQuestions: '',
            keyDistinction: '',
            anchorText: '',
            wrongDiagnosis: '',
            guiaTrapscan: ''
        }));
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Adicionar Manualmente</h3>
                <button onClick={() => setActiveTab('list')} className="text-sm text-sky-500 hover:underline">Ver Lista</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1">Disciplina *</label>
                        <input 
                            value={form.discipline} 
                            onChange={e => handleChange('discipline', e.target.value)} 
                            className="w-full p-2 rounded bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700" 
                            placeholder="Ex: Direito Constitucional"
                        />
                    </div>
                    <div>
                         <label className="block text-xs font-bold uppercase mb-1">Tópico</label>
                        <input 
                            value={form.topic} 
                            onChange={e => handleChange('topic', e.target.value)} 
                            className="w-full p-2 rounded bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700" 
                            placeholder="Ex: Direitos Fundamentais"
                        />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1">Referência (ID)</label>
                        <input 
                            value={form.questionRef} 
                            onChange={e => handleChange('questionRef', e.target.value)} 
                            className="w-full p-2 rounded bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1">Banca</label>
                        <input 
                            value={form.bank} 
                            onChange={e => handleChange('bank', e.target.value)} 
                            className="w-full p-2 rounded bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700" 
                        />
                    </div>
                     <div>
                        <label className="block text-xs font-bold uppercase mb-1">Ref Lei (LawRef)</label>
                        <input 
                            value={form.lawRef} 
                            onChange={e => handleChange('lawRef', e.target.value)} 
                            className="w-full p-2 rounded bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700" 
                            placeholder="Link para Lei Seca"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase mb-1">Enunciado *</label>
                    <textarea 
                        value={form.questionText} 
                        onChange={e => handleChange('questionText', e.target.value)} 
                        rows={5}
                        className="w-full p-2 rounded bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 font-medium" 
                    />
                </div>

                <div className="bg-bunker-50 dark:bg-bunker-800/50 p-4 rounded-lg border border-bunker-200 dark:border-bunker-700">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-sm">Alternativas</h4>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={form.isCebraspe} onChange={e => handleChange('isCebraspe', e.target.checked)} />
                            <span className="text-xs">Estilo Certo/Errado</span>
                        </label>
                    </div>

                    {!form.isCebraspe ? (
                        <div className="space-y-2">
                            {['A','B','C','D','E'].map(opt => (
                                <div key={opt} className="flex gap-2">
                                    <span className={`mt-2 font-bold w-4 ${form.correctAnswer === opt ? 'text-emerald-500' : 'text-slate-400'}`}>{opt}</span>
                                    <textarea 
                                        value={(form.options as any)[opt]} 
                                        onChange={e => handleOptionChange(opt, e.target.value)}
                                        rows={1}
                                        className="flex-1 p-2 rounded bg-bunker-100 dark:bg-bunker-900 border-none text-sm"
                                        placeholder={`Opção ${opt}`}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-slate-500 italic">
                            Alternativas serão geradas automaticamente: (A) Certo, (B) Errado.
                        </div>
                    )}
                    
                    <div className="mt-4 pt-4 border-t border-bunker-200 dark:border-bunker-700 flex items-center gap-4">
                        <span className="text-xs font-bold uppercase">Gabarito:</span>
                        <div className="flex gap-2">
                            {(form.isCebraspe ? ['A','B'] : ['A','B','C','D','E']).map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleChange('correctAnswer', opt)}
                                    className={`w-8 h-8 rounded font-bold transition-all ${form.correctAnswer === opt ? 'bg-emerald-500 text-white' : 'bg-bunker-200 dark:bg-bunker-700 text-slate-500'}`}
                                >
                                    {form.isCebraspe ? (opt === 'A' ? 'C' : 'E') : opt}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="border border-bunker-200 dark:border-bunker-700 rounded-lg overflow-hidden">
                    <button 
                        type="button"
                        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                        className="w-full p-3 bg-bunker-50 dark:bg-bunker-800 flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300"
                    >
                        <span>Campos Avançados & Feedback</span>
                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isAdvancedOpen && (
                        <div className="p-4 space-y-4 bg-bunker-50/50 dark:bg-bunker-900/50">
                            <div>
                                <label className="block text-[10px] font-bold uppercase mb-1">Explicação Técnica</label>
                                <textarea value={form.explanationTech} onChange={e => handleChange('explanationTech', e.target.value)} rows={3} className="w-full p-2 rounded bg-white dark:bg-bunker-800 border-none text-sm" />
                            </div>
                             <div>
                                <label className="block text-[10px] font-bold uppercase mb-1">Diagnóstico de Erro (Geral)</label>
                                <input value={form.wrongDiagnosis} onChange={e => handleChange('wrongDiagnosis', e.target.value)} className="w-full p-2 rounded bg-white dark:bg-bunker-800 border-none text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase mb-1">Palavra que Salva</label>
                                    <input value={form.keyDistinction} onChange={e => handleChange('keyDistinction', e.target.value)} className="w-full p-2 rounded bg-white dark:bg-bunker-800 border-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase mb-1">Frase Âncora</label>
                                    <input value={form.anchorText} onChange={e => handleChange('anchorText', e.target.value)} className="w-full p-2 rounded bg-white dark:bg-bunker-800 border-none text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase mb-1">Guia Trapscan</label>
                                <input value={form.guiaTrapscan} onChange={e => handleChange('guiaTrapscan', e.target.value)} className="w-full p-2 rounded bg-white dark:bg-bunker-800 border-none text-sm" placeholder="P1=...; P2=..." />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all flex items-center gap-2">
                        <PlusIcon className="w-4 h-4" /> Adicionar Questão
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ManualAddTab;
