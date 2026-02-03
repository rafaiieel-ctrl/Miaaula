
import React, { useMemo } from 'react';
import { Question } from '../types';
import { 
    BoltIcon, BookOpenIcon, ExclamationTriangleIcon, SearchIcon, 
    BrainIcon, ListBulletIcon, MapIcon, KeyIcon, AnchorIcon, 
    RadarIcon, CheckCircleIcon, FireIcon
} from './icons';
import { deriveTrapscanRequired, validateTrapscan } from '../services/trapscanService';
import SafeRender from './ui/SafeRender';
import { normalizeTrapscan, parseDiagnosisMap } from '../utils/feedbackFormatters';

interface QuestionExplanationBlocksProps {
    question: Question;
    userAnswer?: string | null;
    showTitle?: boolean;
}

// --- SUB-COMPONENTS ---

const SectionHeader: React.FC<{ icon: React.ReactNode, title: string, color: string }> = ({ icon, title, color }) => (
    <div className="flex items-center gap-2 mb-3">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `w-4 h-4 ${color}` })}
        <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${color}`}>{title}</h4>
    </div>
);

const StyledBlock: React.FC<{ 
    children: React.ReactNode; 
    className?: string;
    gradient?: string;
}> = ({ children, className = "", gradient }) => (
    <div className={`rounded-2xl border border-white/5 p-5 relative overflow-hidden ${className}`}>
        {gradient && <div className={`absolute top-0 left-0 w-1 h-full ${gradient}`}></div>}
        {children}
    </div>
);

const TrapscanVisual: React.FC<{ 
    steps: { key: string; label: string; text: string }[];
    itemLabel: string;
}> = ({ steps, itemLabel }) => (
    <div className="bg-[#0b0e14] rounded-2xl border border-white/5 overflow-hidden">
        {itemLabel && itemLabel !== '—' && (
            <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Eixo Dominante</span>
                <span className="text-[10px] font-bold text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded border border-sky-400/20">{itemLabel}</span>
            </div>
        )}
        <div className="divide-y divide-white/5">
            {steps.map((step, idx) => (
                <div key={idx} className="p-3 flex gap-3 hover:bg-white/[0.02] transition-colors">
                    <div className="shrink-0 w-8 pt-0.5">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">{step.key}</span>
                    </div>
                    <div className="flex-1">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase mb-0.5 block">{step.label}</span>
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">{step.text}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// --- MAIN COMPONENT ---

const QuestionExplanationBlocks: React.FC<QuestionExplanationBlocksProps> = ({ question, userAnswer, showTitle = true }) => {
    
    const isCorrect = userAnswer && question.correctAnswer && 
                      userAnswer.trim().toUpperCase().charAt(0) === question.correctAnswer.trim().toUpperCase().charAt(0);
    
    // Data Parsing
    const getField = (key: keyof Question, alias?: string) => {
        return question[key] || (alias ? (question as any)[alias] : undefined);
    };

    const tech = getField('explanationTech', 'explanation');
    const story = getField('explanationStory');
    const palavraQueSalva = getField('keyDistinction');
    const anchorText = getField('anchorText');
    const fraeseFinal = (question as any).FRASE_ANCORA_FINAL; // Legacy support
    
    const trapscanRaw = getField('guiaTrapscan') || (question as any).GUIA_TRAPSCAN;
    const trapscanData = useMemo(() => normalizeTrapscan(trapscanRaw), [trapscanRaw]);
    
    const feynmanRaw = getField('feynmanQuestions') || (question as any).feynman;
    
    const distractorRaw = getField('distractorProfile');
    const distractorParsed = useMemo(() => parseDiagnosisMap(distractorRaw), [distractorRaw]);

    const diagnosisMapRaw = getField('wrongDiagnosisMap');
    const diagnosisMapParsed = useMemo(() => parseDiagnosisMap(diagnosisMapRaw), [diagnosisMapRaw]);
    
    const generalDiagnosis = getField('wrongDiagnosis');

    // Logic
    const hasContent = (data: any) => {
        if (!data) return false;
        if (typeof data === 'string') return data.trim().length > 0 && data !== '—';
        if (typeof data === 'object') return Object.keys(data).length > 0;
        return true;
    };

    const specificErrorMsg = useMemo(() => {
        if (isCorrect || !userAnswer) return null;
        // Clean user answer to just the letter
        const cleanUserAns = userAnswer.charAt(0).toUpperCase();
        if (diagnosisMapParsed && diagnosisMapParsed[cleanUserAns]) {
            return diagnosisMapParsed[cleanUserAns];
        }
        return generalDiagnosis;
    }, [isCorrect, userAnswer, diagnosisMapParsed, generalDiagnosis]);

    return (
        <div className="w-full space-y-6 animate-fade-in text-left mt-6 pb-12 font-sans">
            
            {showTitle && (
                <div className="flex items-center gap-3 mb-4 px-1 border-l-4 border-slate-700 pl-3">
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">
                        ANÁLISE & CORREÇÃO
                    </h3>
                </div>
            )}
            
            {/* 1. RESULT STATUS (Your Answer vs Correct) */}
            {!isCorrect && userAnswer && (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 relative overflow-hidden shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                    <div className="flex items-start gap-3 relative z-10">
                        <div className="p-1.5 bg-rose-500/20 rounded text-rose-500 mt-0.5">
                            <ExclamationTriangleIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest block mb-1">Seu Erro ({userAnswer})</span>
                            {hasContent(specificErrorMsg) ? (
                                <div className="text-sm text-white font-bold leading-snug">
                                    {String(specificErrorMsg).includes('|') ? (
                                         <div className="flex flex-col gap-1">
                                             <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded w-fit font-black uppercase">
                                                 {String(specificErrorMsg).split('|')[0].trim()}
                                             </span>
                                             <span>{String(specificErrorMsg).split('|').slice(1).join('|').trim()}</span>
                                         </div>
                                    ) : (
                                         <SafeRender data={specificErrorMsg} mode="plain" />
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-rose-300">Resposta incorreta. Veja o gabarito abaixo.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* 2. OFFICIAL ANSWER */}
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                 <div className="p-1.5 bg-emerald-500/20 rounded text-emerald-500">
                    <CheckCircleIcon className="w-5 h-5" />
                 </div>
                 <div>
                     <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest block">Gabarito Oficial</span>
                     <p className="text-sm font-bold text-white">Alternativa <span className="text-emerald-400 text-lg ml-1">{question.correctAnswer}</span></p>
                 </div>
            </div>

            {/* 3. EXPLICAÇÃO TÉCNICA (Core) */}
            {hasContent(tech) && (
                <StyledBlock className="bg-sky-900/10 border-sky-500/20" gradient="bg-sky-500">
                    <SectionHeader icon={<BoltIcon />} title="Explicação Técnica" color="text-sky-400" />
                    
                    {/* Eixo Dominante Badge if available from Tech text or Trapscan */}
                    {(trapscanData.itemLabel && trapscanData.itemLabel !== '—') && (
                         <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded bg-sky-950 border border-sky-800/50">
                            <RadarIcon className="w-3 h-3 text-sky-500" />
                            <span className="text-[9px] font-bold text-sky-200 uppercase tracking-wider">
                                EIXO: {trapscanData.itemLabel}
                            </span>
                        </div>
                    )}
                    
                    <div className="text-sm text-slate-200 leading-relaxed font-medium">
                        <SafeRender data={tech} />
                    </div>
                </StyledBlock>
            )}

            {/* 4. GUIA TRAPSCAN (Structured Steps) */}
            {(trapscanData.hasAny || trapscanData.completenessScore > 0) && (
                <div>
                    <SectionHeader icon={<ListBulletIcon />} title="Guia Trapscan (Gabarito)" color="text-slate-400" />
                    <TrapscanVisual steps={trapscanData.steps} itemLabel={trapscanData.itemLabel} />
                </div>
            )}

            {/* 5. STORYTELLING & LÓGICA */}
            {hasContent(story) && (
                <StyledBlock className="bg-indigo-900/10 border-indigo-500/20" gradient="bg-indigo-500">
                    <SectionHeader icon={<BookOpenIcon />} title="Storytelling & Lógica" color="text-indigo-400" />
                    <div className="text-sm text-slate-200 italic leading-relaxed font-serif">
                        <SafeRender data={story} />
                    </div>
                </StyledBlock>
            )}

            {/* 6. KEYWORDS / ANCHORS */}
            {(hasContent(palavraQueSalva) || hasContent(anchorText) || hasContent(fraeseFinal)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hasContent(palavraQueSalva) && (
                        <div className="p-4 rounded-xl bg-emerald-900/10 border border-emerald-500/20">
                             <SectionHeader icon={<KeyIcon />} title="Palavra que Salva" color="text-emerald-500" />
                             <div className="text-sm font-bold text-white">
                                 <SafeRender data={palavraQueSalva} />
                             </div>
                        </div>
                    )}
                    {(hasContent(anchorText) || hasContent(fraeseFinal)) && (
                        <div className="p-4 rounded-xl bg-sky-900/10 border border-sky-500/20">
                             <SectionHeader icon={<AnchorIcon />} title="Frase Âncora" color="text-sky-500" />
                             <div className="text-sm font-bold text-white">
                                 <SafeRender data={anchorText || fraeseFinal} />
                             </div>
                        </div>
                    )}
                </div>
            )}

            {/* 7. FEYNMAN */}
            {hasContent(feynmanRaw) && (
                <StyledBlock className="bg-teal-900/10 border-teal-500/20">
                    <SectionHeader icon={<BrainIcon />} title="Técnica Feynman" color="text-teal-400" />
                    <div className="text-sm text-slate-300 leading-relaxed space-y-1">
                        <SafeRender data={feynmanRaw} />
                    </div>
                </StyledBlock>
            )}

            {/* 8. ANÁLISE DOS DISTRATORES */}
            {hasContent(distractorParsed) && (
                <StyledBlock className="bg-slate-900/50">
                    <SectionHeader icon={<SearchIcon />} title="Análise dos Distratores" color="text-slate-500" />
                    <SafeRender data={distractorParsed} className="text-sm text-slate-400" />
                </StyledBlock>
            )}

            {/* 9. MAPA DE DIAGNÓSTICO (Full Table) */}
            {hasContent(diagnosisMapParsed) && (
                <div className="rounded-2xl border border-rose-900/30 bg-rose-950/5 overflow-hidden">
                    <div className="px-5 py-3 border-b border-rose-900/20 bg-rose-900/10">
                        <SectionHeader icon={<MapIcon />} title="Mapa de Diagnóstico" color="text-rose-400" />
                    </div>
                    <div className="p-0">
                        {Object.entries(diagnosisMapParsed).map(([key, value]) => {
                            // Normalize key
                            const optKey = key.trim().toUpperCase().charAt(0);
                            const userKey = userAnswer ? userAnswer.trim().toUpperCase().charAt(0) : '';
                            const isSelected = userKey === optKey;
                            
                            return (
                                <div 
                                    key={key} 
                                    className={`flex items-start gap-4 p-3 border-b border-rose-900/10 last:border-0 transition-colors ${isSelected ? "bg-rose-500/10" : "hover:bg-white/[0.02]"}`}
                                >
                                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-black shrink-0 ${isSelected ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-500"}`}>
                                        {optKey}
                                    </div>
                                    <div className={`flex-1 text-xs leading-relaxed ${isSelected ? "text-white font-bold" : "text-slate-400"}`}>
                                        <SafeRender data={value} mode="plain" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

        </div>
    );
};

export default QuestionExplanationBlocks;
