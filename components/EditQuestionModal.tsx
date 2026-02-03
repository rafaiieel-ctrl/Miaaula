
import React, { useState, useEffect } from 'react';
import { Question } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { 
    XMarkIcon, CheckCircleIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon, 
    EyeIcon, PencilIcon, BoltIcon, BookOpenIcon, MapIcon, RadarIcon, 
    ExclamationTriangleIcon, LightBulbIcon, KeyIcon
} from './icons';
import { isFrozen } from '../services/disciplineFlags';
import PromptText from './ui/PromptText';
import QuestionExplanationBlocks from './QuestionExplanationBlocks';
import { getText, toI18n } from '../utils/i18nText';

interface EditQuestionModalProps {
    question: Question;
    onClose: () => void;
    onSave?: (updatedQuestion: Question) => void;
}

// Helper to convert Map Objects to Text (A: Value\nB: Value)
const mapToString = (obj: any): string => {
    if (!obj) return '';
    return Object.entries(obj)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
};

// Helper to convert Text back to Map Objects
const stringToMap = (str: string): Record<string, string> => {
    const res: Record<string, string> = {};
    str.split('\n').forEach(line => {
        const match = line.match(/^([A-Ea-e0-9]+)\s*[:=]\s*(.*)$/);
        if (match) {
            res[match[1].toUpperCase().trim()] = match[2].trim();
        }
    });
    return res;
};

const AccordionSection: React.FC<{ 
    title: string; 
    icon?: React.ReactNode; 
    children: React.ReactNode; 
    defaultOpen?: boolean 
}> = ({ title, icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-white/[0.02]">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    {icon && <span className="text-sky-500">{icon}</span>}
                    {title}
                </div>
                <div className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDownIcon className="w-4 h-4" />
                </div>
            </button>
            {isOpen && (
                <div className="p-4 border-t border-slate-200 dark:border-white/5 space-y-4 animate-fade-in">
                    {children}
                </div>
            )}
        </div>
    );
};

const EditQuestionModal: React.FC<EditQuestionModalProps> = ({ question, onClose, onSave }) => {
    const { settings } = useSettings();
    const [activeTab, setActiveTab] = useState<'EDIT' | 'PREVIEW'>('EDIT');
    
    // Flattened State for easier editing
    const [form, setForm] = useState({
        // Core
        questionText: question.questionText || '',
        correctAnswer: question.correctAnswer || '',
        questionRef: question.questionRef || '',
        
        // Options (Flattened for UI)
        altA: question.options?.A || '',
        altB: question.options?.B || '',
        altC: question.options?.C || '',
        altD: question.options?.D || '',
        altE: question.options?.E || '',

        // Meta
        subject: question.subject || '',
        topic: question.topic || '',
        subtopic: question.subtopic || '',
        bank: question.bank || '',
        position: question.position || '', // Cargo/Ano
        difficulty: question.difficultyLevel || 'normal',
        questionType: question.questionType || 'Literalidade',
        
        // Flags
        hotTopic: !!question.hotTopic,
        isCritical: !!question.isCritical,
        isFundamental: !!question.isFundamental,
        
        // Explanations (Simple)
        explanation: question.explanation || '',
        comments: question.comments || '',

        // Advanced - References
        lawRef: question.lawRef || '',
        litRef: question.litRef || '',

        // Advanced - Trapscan
        guiaTrapscan: question.guiaTrapscan || '',
        keyDistinction: question.keyDistinction || '',
        anchorText: getText(question.anchorText),

        // Advanced - Deep Explanations
        explanationTech: question.explanationTech || '',
        explanationStory: question.explanationStory || '',
        feynmanQuestions: question.feynmanQuestions || '',

        // Advanced - Diagnostics (Text Area based editing)
        wrongDiagnosis: getText(question.wrongDiagnosis),
        distractorProfileStr: mapToString(question.distractorProfile),
        wrongDiagnosisMapStr: mapToString(question.wrongDiagnosisMap),
    });

    // Determine frozen state
    const isFrozenSubject = isFrozen(form.subject);

    const handleChange = (field: keyof typeof form, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        // Reconstruct complex objects
        const updatedOptions = {
            A: form.altA || undefined,
            B: form.altB || undefined,
            C: form.altC || undefined,
            D: form.altD || undefined,
            E: form.altE || undefined,
        };

        const updatedDistractors = stringToMap(form.distractorProfileStr);
        const updatedDiagMap = stringToMap(form.wrongDiagnosisMapStr);

        // Validation
        if (!form.questionText.trim()) return alert("O enunciado é obrigatório.");
        if (!form.correctAnswer) return alert("O gabarito é obrigatório.");

        const updatedQuestion: Question = {
            ...question,
            // Core
            questionText: form.questionText,
            questionRef: form.questionRef,
            correctAnswer: form.correctAnswer.toUpperCase(),
            options: updatedOptions,
            
            // Meta
            subject: form.subject,
            topic: form.topic,
            subtopic: form.subtopic,
            bank: form.bank,
            position: form.position,
            difficultyLevel: form.difficulty as any,
            questionType: form.questionType,

            // Flags
            hotTopic: form.hotTopic,
            isCritical: form.isCritical,
            isFundamental: form.isFundamental,

            // Explanations
            explanation: form.explanation,
            comments: form.comments,

            // Advanced
            lawRef: form.lawRef,
            litRef: form.litRef,
            guiaTrapscan: form.guiaTrapscan,
            keyDistinction: form.keyDistinction,
            anchorText: toI18n(form.anchorText),
            explanationTech: form.explanationTech,
            explanationStory: form.explanationStory,
            feynmanQuestions: form.feynmanQuestions,
            wrongDiagnosis: toI18n(form.wrongDiagnosis),
            distractorProfile: updatedDistractors,
            wrongDiagnosisMap: updatedDiagMap,
        };

        if (onSave) onSave(updatedQuestion);
        onClose();
    };

    const inputClasses = "w-full bg-white dark:bg-[#020617] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all placeholder:text-slate-400";
    const labelClasses = "block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1";

    return (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col border border-slate-200 dark:border-white/10 overflow-hidden">
                
                {/* Header */}
                <header className="px-6 py-5 border-b border-slate-200 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.02] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-500/10 rounded-lg text-sky-500">
                            <PencilIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-slate-900 dark:text-white tracking-tight leading-none">Editor de Questão</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-slate-500 font-bold">{form.questionRef}</p>
                                {isFrozenSubject && (
                                    <span className="text-[9px] font-black bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                                        ❄️ CONGELADA
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setActiveTab(activeTab === 'EDIT' ? 'PREVIEW' : 'EDIT')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 border ${activeTab === 'PREVIEW' ? 'bg-sky-500 text-white border-sky-500' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <EyeIcon className="w-4 h-4" /> {activeTab === 'EDIT' ? 'Preview' : 'Editar'}
                        </button>
                        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-slate-400">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-slate-50/30 dark:bg-[#0b101e]">
                    
                    {activeTab === 'PREVIEW' ? (
                        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                            <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl">
                                <PromptText text={form.questionText} className="text-lg leading-relaxed text-white" />
                                <div className="mt-4 space-y-2">
                                    {['A','B','C','D','E'].map(opt => {
                                        // @ts-ignore
                                        const text = form[`alt${opt}`];
                                        if (!text) return null;
                                        return (
                                            <div key={opt} className={`p-3 rounded-lg border ${opt === form.correctAnswer ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/5'} text-sm`}>
                                                <strong className={opt === form.correctAnswer ? 'text-emerald-400' : 'text-slate-400'}>{opt})</strong> <span className="text-slate-200">{text}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="border-t border-white/10 pt-4">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Feedback & Explicações</h4>
                                <QuestionExplanationBlocks 
                                    question={{ ...question, ...form, options: {A: form.altA, B: form.altB, C: form.altC, D: form.altD, E: form.altE} } as any}
                                    userAnswer={form.correctAnswer === 'A' ? 'B' : 'A'} // Simulate wrong answer to show blocks
                                />
                            </div>
                        </div>
                    ) : (
                        // EDIT MODE FORM
                        <>
                            {/* BLOCK 1: STATEMENT */}
                            <section>
                                <label className={labelClasses}>Enunciado</label>
                                <textarea 
                                    value={form.questionText} 
                                    onChange={e => handleChange('questionText', e.target.value)} 
                                    rows={6} 
                                    className={`${inputClasses} font-medium leading-relaxed resize-y min-h-[120px]`} 
                                    placeholder="Digite o texto da questão..."
                                />
                            </section>

                            {/* BLOCK 2: OPTIONS */}
                            <section className="bg-white dark:bg-white/[0.02] p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <CheckCircleIcon className="w-4 h-4"/> Alternativas & Gabarito
                                </h4>
                                <div className="space-y-3">
                                    {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                        <div key={opt} className="flex gap-2 items-start">
                                            <span className={`mt-2.5 text-xs font-bold w-4 text-center ${form.correctAnswer === opt ? 'text-emerald-500' : 'text-slate-400'}`}>{opt}</span>
                                            <textarea 
                                                // @ts-ignore
                                                value={form[`alt${opt}`]} 
                                                // @ts-ignore
                                                onChange={e => handleChange(`alt${opt}`, e.target.value)}
                                                rows={1}
                                                className={`${inputClasses} py-2`}
                                                placeholder={`Alternativa ${opt}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
                                    <label className={labelClasses}>Gabarito Oficial</label>
                                    <div className="flex gap-2">
                                        {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => handleChange('correctAnswer', opt)}
                                                className={`w-10 h-10 rounded-lg font-black text-sm transition-all border-2 ${form.correctAnswer === opt ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-emerald-500/50'}`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* BLOCK 3: TAXONOMY */}
                            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Disciplina</label>
                                    <input value={form.subject} onChange={e => handleChange('subject', e.target.value)} className={inputClasses} />
                                </div>
                                <div>
                                    <label className={labelClasses}>Tópico</label>
                                    <input value={form.topic} onChange={e => handleChange('topic', e.target.value)} className={inputClasses} />
                                </div>
                                <div>
                                    <label className={labelClasses}>Banca</label>
                                    <input value={form.bank} onChange={e => handleChange('bank', e.target.value)} className={inputClasses} />
                                </div>
                                <div>
                                    <label className={labelClasses}>Dificuldade</label>
                                    <select value={form.difficulty} onChange={e => handleChange('difficulty', e.target.value)} className={inputClasses}>
                                        <option value="easy">Fácil</option>
                                        <option value="normal">Normal</option>
                                        <option value="difficult">Difícil</option>
                                    </select>
                                </div>
                            </section>

                            {/* BLOCK 4: BASIC EXPLANATION */}
                            <section>
                                <label className={labelClasses}>Comentário Geral</label>
                                <textarea 
                                    value={form.explanation} 
                                    onChange={e => handleChange('explanation', e.target.value)} 
                                    rows={3} 
                                    className={inputClasses} 
                                    placeholder="Explicação básica do gabarito..."
                                />
                            </section>

                            {/* BLOCK 5: FLAGS */}
                            <section className="flex flex-wrap gap-3">
                                {[
                                    { k: 'hotTopic', label: 'Hot Topic', color: 'text-orange-500', border: 'hover:border-orange-500' },
                                    { k: 'isCritical', label: 'Crítica', color: 'text-rose-500', border: 'hover:border-rose-500' },
                                    { k: 'isFundamental', label: 'Fundamental', color: 'text-sky-500', border: 'hover:border-sky-500' },
                                ].map(flag => (
                                    <button 
                                        key={flag.k}
                                        onClick={() => handleChange(flag.k as any, !(form as any)[flag.k])}
                                        className={`px-4 py-2 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all ${
                                            (form as any)[flag.k] 
                                                ? `bg-white dark:bg-white/10 ${flag.color} border-current` 
                                                : `bg-transparent border-slate-200 dark:border-white/10 text-slate-400 ${flag.border}`
                                        }`}
                                    >
                                        {(form as any)[flag.k] ? '★' : '☆'} {flag.label}
                                    </button>
                                ))}
                            </section>

                            {/* BLOCK 6: ADVANCED ACCORDIONS */}
                            <div className="pt-4 space-y-3">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <BoltIcon className="w-4 h-4"/> Configurações Avançadas
                                </h4>

                                <AccordionSection title="Referências & Links" icon={<MapIcon className="w-4 h-4"/>}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className={labelClasses}>Ref Questão (Q_REF)</label><input value={form.questionRef} onChange={e => handleChange('questionRef', e.target.value)} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Ref Lei (LAW_REF)</label><input value={form.lawRef} onChange={e => handleChange('lawRef', e.target.value)} className={inputClasses} placeholder="ID do Card de Lei Seca" /></div>
                                        <div><label className={labelClasses}>Ref Literariedade (LIT_REF)</label><input value={form.litRef} onChange={e => handleChange('litRef', e.target.value)} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Cargo / Prova</label><input value={form.position} onChange={e => handleChange('position', e.target.value)} className={inputClasses} /></div>
                                    </div>
                                </AccordionSection>

                                <AccordionSection title="Trapscan Engine" icon={<RadarIcon className="w-4 h-4"/>}>
                                    <div className="space-y-4">
                                        <div><label className={labelClasses}>Guia Trapscan (Lógica da Pegadinha)</label><textarea value={form.guiaTrapscan} onChange={e => handleChange('guiaTrapscan', e.target.value)} rows={2} className={inputClasses} /></div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div><label className={labelClasses}>Palavra que Salva (Key Distinction)</label><input value={form.keyDistinction} onChange={e => handleChange('keyDistinction', e.target.value)} className={inputClasses} /></div>
                                            <div><label className={labelClasses}>Frase Âncora</label><input value={form.anchorText} onChange={e => handleChange('anchorText', e.target.value)} className={inputClasses} /></div>
                                        </div>
                                    </div>
                                </AccordionSection>

                                <AccordionSection title="Explicações Profundas" icon={<LightBulbIcon className="w-4 h-4"/>}>
                                    <div className="space-y-4">
                                        <div><label className={labelClasses}>Explicação Técnica</label><textarea value={form.explanationTech} onChange={e => handleChange('explanationTech', e.target.value)} rows={4} className={inputClasses} placeholder="Detalhamento jurídico/técnico..." /></div>
                                        <div><label className={labelClasses}>Storytelling / Analogia</label><textarea value={form.explanationStory} onChange={e => handleChange('explanationStory', e.target.value)} rows={3} className={inputClasses} placeholder="História para memorização..." /></div>
                                        <div><label className={labelClasses}>Perguntas Feynman</label><textarea value={form.feynmanQuestions} onChange={e => handleChange('feynmanQuestions', e.target.value)} rows={3} className={inputClasses} placeholder="Lista de perguntas para auto-explicação..." /></div>
                                    </div>
                                </AccordionSection>

                                <AccordionSection title="Diagnóstico de Erro" icon={<ExclamationTriangleIcon className="w-4 h-4"/>}>
                                    <div className="space-y-4">
                                        <div><label className={labelClasses}>Diagnóstico Geral</label><input value={form.wrongDiagnosis} onChange={e => handleChange('wrongDiagnosis', e.target.value)} className={inputClasses} placeholder="Por que geralmente erram essa?" /></div>
                                        <div>
                                            <label className={labelClasses}>Mapa de Diagnóstico (A: Motivo)</label>
                                            <textarea value={form.wrongDiagnosisMapStr} onChange={e => handleChange('wrongDiagnosisMapStr', e.target.value)} rows={4} className={`${inputClasses} font-mono text-xs`} placeholder="A: Confundiu prazo...&#10;B: Erro de conceito..." />
                                        </div>
                                        <div>
                                            <label className={labelClasses}>Perfil dos Distratores (A: Tipo)</label>
                                            <textarea value={form.distractorProfileStr} onChange={e => handleChange('distractorProfileStr', e.target.value)} rows={4} className={`${inputClasses} font-mono text-xs`} placeholder="A: Extrapolação&#10;B: Redução..." />
                                        </div>
                                    </div>
                                </AccordionSection>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                    <button 
                         onClick={() => {
                             // Reset advanced fields if needed, or implement full reset
                             alert("Recurso de resetar campos não implementado neste modo.");
                         }}
                         className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-4 py-2 transition-colors"
                    >
                        Restaurar Padrão
                    </button>
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose} 
                            className="px-6 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors uppercase tracking-widest"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="px-8 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-sky-500/20 transition-all transform active:scale-95 flex items-center gap-2"
                        >
                            <CheckCircleIcon className="w-4 h-4"/> Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditQuestionModal;
