
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RadarIcon, CheckCircleIcon, LightBulbIcon, LockClosedIcon, XCircleIcon, TrashIcon, ExclamationTriangleIcon, BoltIcon, PlayIcon, ShieldCheckIcon, ClockIcon, PencilIcon, SearchIcon, ArrowRightIcon, ChevronDownIcon, QuestionMarkCircleIcon, EyeIcon } from './icons';
import { TrapscanEntry, Question, TrapscanMode, TrapscanLockLevel, TrapscanSessionConfig, TriggerStat, TrapscanAutoAnalysis, AxisCandidate, TrapType, TrapscanEvidenceMap, EvidenceItem } from '../types';
import { TRAP_REQ_DEFS, inferCommand, inferTrap, scanForTriggers, FoundTrigger, P4_SCRIPT, TRIGGER_WORDS, P1_CHECKLIST, P2_CHECKLIST, calculateDetectionScore, runTrapscanAnalysis, QUICK_RULES, analyzeEvidence } from '../services/trapscanService';
import { useSettings } from '../contexts/SettingsContext';
import PromptText from './ui/PromptText';

interface TrapscanGateProps {
    question: Question;
    onUnlock: () => void;
    onAllowSubmit: (allow: boolean) => void;
    onUpdate: (data: TrapscanEntry) => void;
    isLocked: boolean;
    userAnswer?: string | null;
    configOverride?: TrapscanSessionConfig;
    
    eliminatedOptions: string[];
    onSetEliminationMode: (active: boolean) => void;
    onSetHighlightAnchor: (highlight: boolean) => void;
}

type CommandType = 'CORRECT' | 'INCORRECT' | 'EXCEPT' | 'JUDGMENT';
// UPDATED PHASE TYPE: Added ELIMINATING separate from DONE
type P4Phase = 'SCAN' | 'CHECKLIST' | 'ELIMINATING' | 'DONE';

const COMMAND_OPTS: { id: CommandType; label: string }[] = [
    { id: 'CORRECT', label: '✅ CORRETA' },
    { id: 'INCORRECT', label: '❌ INCORRETA' },
    { id: 'EXCEPT', label: '🚫 EXCETO / NÃO' },
    { id: 'JUDGMENT', label: '⚠️ CERTO / ERRADO' },
];

const TRAPSCAN_ORDER: TrapType[] = ['T', 'R', 'A', 'P', 'S', 'C', 'A2', 'N'];

// Helper for Mini Evidence Map
const EvidenceMapList: React.FC<{ evidence: TrapscanEvidenceMap }> = ({ evidence }) => {
    const stem = evidence.stem || [];
    // Explicitly type the values from the record to ensure flat() works correctly
    const optionValues = Object.values(evidence.options || {}) as EvidenceItem[][];
    const optionsFlat = optionValues.flat();
    const allItems: EvidenceItem[] = [...stem, ...optionsFlat];
    
    // Unique by term+axis
    const unique = allItems.reduce((acc, curr) => {
        const key = `${curr.term}-${curr.axis}`;
        if (!acc.has(key)) acc.set(key, curr);
        return acc;
    }, new Map<string, EvidenceItem>());
    
    const items: EvidenceItem[] = Array.from(unique.values()).slice(0, 5); // Show top 5
    
    if (items.length === 0) return null;

    return (
        <div className="mt-2 p-3 bg-white/5 rounded-xl border border-white/5 animate-fade-in">
             <div className="flex justify-between items-center mb-2">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Evidências Detectadas</span>
                 <span className="text-[9px] text-slate-500">{items.length} Sinais</span>
             </div>
             <div className="flex flex-wrap gap-2">
                 {items.map((item, i) => (
                     <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[9px] font-bold uppercase ${item.color.replace('text-', 'bg-').replace('500', '500/10')} border-current text-slate-300`}>
                         <span className={item.color.split(' ')[0]}>[{item.axis}]</span>
                         <span>{item.term}</span>
                     </div>
                 ))}
             </div>
        </div>
    );
};

const QuickRulesBlock: React.FC<{ suggestedTrap?: string, mode?: 'EXAM' | 'TRAINING' }> = ({ suggestedTrap, mode = 'TRAINING' }) => {
    const [expanded, setExpanded] = useState(mode === 'TRAINING');
    const [showExamples, setShowExamples] = useState(false);

    const sortedRules = useMemo(() => {
        return Object.values(QUICK_RULES).sort((a, b) => {
            return TRAPSCAN_ORDER.indexOf(a.type) - TRAPSCAN_ORDER.indexOf(b.type);
        });
    }, []);

    const rulesToShow = expanded 
        ? sortedRules
        : sortedRules.slice(0, 3);

    return (
        <div className="bg-slate-900 border border-white/10 rounded-xl p-3 mb-4 animate-fade-in relative group">
            <div className="flex justify-between items-center mb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <BoltIcon className="w-3 h-3 text-indigo-400" />
                    TRAPSCAN ORDER
                </h4>
                <div className="flex gap-2">
                     <button onClick={(e) => {e.stopPropagation(); setShowExamples(!showExamples);}} className="text-[9px] font-bold text-sky-500 hover:underline">
                         {showExamples ? 'Ocultar Ex.' : 'Ver Exemplos'}
                     </button>
                     <ChevronDownIcon className={`w-3 h-3 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </div>
            
            <div className="space-y-1">
                {rulesToShow.map(rule => {
                    const isSuggested = suggestedTrap === rule.type;
                    return (
                        <div key={rule.id} className={`text-[9px] font-medium leading-tight p-1.5 rounded transition-colors ${isSuggested ? 'bg-indigo-500/20 text-white border-l-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                            <span className={`font-bold mr-1 ${isSuggested ? 'text-indigo-300' : 'text-slate-500'}`}>{rule.type} =</span>
                            {rule.text}
                            {showExamples && <div className="text-[8px] text-sky-400 mt-0.5 ml-4 italic">Ex: "{rule.example}"</div>}
                        </div>
                    );
                })}
            </div>
            {!expanded && <div className="text-[8px] text-center text-slate-600 mt-1 italic">...mais 5 regras</div>}
        </div>
    );
};

const AxisGearBlock: React.FC<{ analysis: TrapscanAutoAnalysis }> = ({ analysis }) => {
    const [expandedWhy, setExpandedWhy] = useState(false);

    return (
        <div className="bg-black/30 border border-white/5 rounded-xl p-3 mb-4 animate-fade-in">
             <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                 <BoltIcon className="w-3 h-3"/> Engrenagem de Decisão
             </h4>

             <div className="space-y-3">
                 {/* Checklist */}
                 <div className="space-y-1">
                     <div className={`flex items-center justify-between text-xs px-2 py-1 rounded ${analysis.keyQuestions?.asksWho ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500'}`}>
                         <span>A questão pergunta QUEM/PAPEL?</span>
                         {analysis.keyQuestions?.asksWho ? <CheckCircleIcon className="w-3 h-3"/> : <XCircleIcon className="w-3 h-3 opacity-30"/>}
                     </div>
                     <div className={`flex items-center justify-between text-xs px-2 py-1 rounded ${analysis.keyQuestions?.asksWhat ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500'}`}>
                         <span>A questão pergunta O QUE É/DEFINIÇÃO?</span>
                         {analysis.keyQuestions?.asksWhat ? <CheckCircleIcon className="w-3 h-3"/> : <XCircleIcon className="w-3 h-3 opacity-30"/>}
                     </div>
                     <div className={`flex items-center justify-between text-xs px-2 py-1 rounded ${analysis.keyQuestions?.asksException ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500'}`}>
                         <span>Tem EXCETO/SALVO/EM REGRA?</span>
                         {analysis.keyQuestions?.asksException ? <CheckCircleIcon className="w-3 h-3"/> : <XCircleIcon className="w-3 h-3 opacity-30"/>}
                     </div>
                 </div>

                 <div className="h-px bg-white/10"></div>

                 {/* Evidence Scoreboard */}
                 <div className="grid grid-cols-2 gap-2">
                     {analysis.axisCandidates?.slice(0, 2).map((cand, i) => (
                         <div key={cand.axis} className={`p-2 rounded bg-white/5 border ${i === 0 ? 'border-sky-500/30' : 'border-white/5'}`}>
                             <div className="flex justify-between items-center mb-1">
                                 <span className={`font-black text-lg ${i === 0 ? 'text-sky-400' : 'text-slate-400'}`}>{cand.axis}</span>
                                 <span className="text-[10px] font-bold text-slate-500">{cand.score}/100</span>
                             </div>
                             <p className="text-[9px] text-slate-300 leading-tight">{cand.primaryReason}</p>
                         </div>
                     ))}
                 </div>

                 {/* Why Not Section */}
                 <div className="pt-1">
                     <button 
                        onClick={() => setExpandedWhy(!expandedWhy)} 
                        className="text-[9px] font-bold text-slate-500 hover:text-white flex items-center gap-1 w-full"
                    >
                         {expandedWhy ? 'Ocultar Detalhes' : 'Por que não os outros?'} <ChevronDownIcon className={`w-3 h-3 transition-transform ${expandedWhy ? 'rotate-180' : ''}`} />
                     </button>
                     
                     {expandedWhy && (
                         <div className="mt-2 space-y-1 pl-2 border-l border-white/10">
                             {analysis.axisCandidates?.slice(0, 3).map(cand => (
                                 cand.whyNotReasons?.map((reason, i) => (
                                     <p key={`${cand.axis}-${i}`} className="text-[9px] text-slate-400">
                                         <span className="font-bold text-slate-500">{cand.axis}:</span> {reason}
                                     </p>
                                 ))
                             ))}
                         </div>
                     )}
                 </div>
             </div>
        </div>
    );
};

const TrapscanGate: React.FC<TrapscanGateProps> = ({ 
    question, onUnlock, onAllowSubmit, onUpdate, isLocked, userAnswer, configOverride,
    eliminatedOptions, onSetEliminationMode, onSetHighlightAnchor
}) => {
    const { settings } = useSettings();
    
    // Config
    const config = configOverride || settings.trapscan || { enabled: true, assistMode: true, defaultMode: 'TREINO', lockLevel: 'SOFT' };
    const mode = config.defaultMode;
    
    // Steps State
    const [p0, setP0] = useState(false); // Pause
    const [p1, setP1] = useState<string>(''); // Command
    const [p2, setP2] = useState<string>(''); // Trap
    const [p3, setP3] = useState(false); // Cut/Anchor
    
    // P4 State (Replaces simple boolean)
    const [p4Phase, setP4Phase] = useState<P4Phase>('SCAN');
    const [foundTriggers, setFoundTriggers] = useState<FoundTrigger[]>([]);
    const [p4Checks, setP4Checks] = useState<Set<string>>(new Set());
    
    const [p5, setP5] = useState<string>(''); // Rule Text
    const [p6, setP6] = useState<string>(''); // Prediction
    const [p7, setP7] = useState(false); // Reverse Check

    // Checklist Detection State (NEW)
    const [isChecklistOpen, setIsChecklistOpen] = useState(false);
    const [checklistChecks, setChecklistChecks] = useState<Set<string>>(new Set());
    const [checklistSuggestion, setChecklistSuggestion] = useState<{ cmd: string, trap: string, confidence: number } | null>(null);

    // AI Analysis State
    const [autoAnalysis, setAutoAnalysis] = useState<TrapscanAutoAnalysis | null>(null);
    const [showAxisGear, setShowAxisGear] = useState(true); // Default to showing gear

    // Evidence Overlay State (NEW)
    const [showEvidence, setShowEvidence] = useState(false);
    const [autoHighlight, setAutoHighlight] = useState(false);
    const [evidenceMap, setEvidenceMap] = useState<TrapscanEvidenceMap | null>(null);

    // P0 Timer
    const [p0Timer, setP0Timer] = useState(2);
    const [p0Active, setP0Active] = useState(false);

    // Analysis State (Legacy)
    const [detectedCommand, setDetectedCommand] = useState<string>('');
    const [detectedTrap, setDetectedTrap] = useState<string>('');
    
    // Feedback State
    const [feedbackP1, setFeedbackP1] = useState<'OK' | 'WARN' | null>(null);
    const [feedbackP2, setFeedbackP2] = useState<'OK' | 'WARN' | null>(null);
    const [activeAdvice, setActiveAdvice] = useState<string | null>(null);
    const [divergenceWarning, setDivergenceWarning] = useState<string | null>(null);
    const [overrideUsed, setOverrideUsed] = useState(false);
    const [showLowCompatModal, setShowLowCompatModal] = useState<string | null>(null); // Stores candidate Axis ID
    
    const startTimeRef = useRef<number>(Date.now());

    // --- INITIAL ANALYSIS ---
    useEffect(() => {
        const cmd = inferCommand(question);
        const trap = inferTrap(question);
        setDetectedCommand(cmd);
        setDetectedTrap(trap);
        
        const triggers = scanForTriggers((question.questionText || '') + ' ' + Object.values(question.options || {}).join(' '));
        setFoundTriggers(triggers);
        
        const aiResult = runTrapscanAnalysis(question);
        setAutoAnalysis(aiResult);

        // Pre-calculate evidence for speed when toggled
        const evidence = analyzeEvidence(question);
        setEvidenceMap(evidence);

        if (aiResult.confidence > 60) {
             setChecklistSuggestion({ 
                 cmd: aiResult.suggestedCommand, 
                 trap: aiResult.suggestedTrap, 
                 confidence: aiResult.confidence 
             });
        }
        
        resetState();
    }, [question]);

    const resetState = () => {
        setP0(false); setP1(''); setP2(''); setP3(false); 
        setP4Phase('SCAN'); // Reset P4
        setP4Checks(new Set());
        setP5(''); setP6(''); setP7(false);
        setP0Timer(2); setP0Active(false);
        setFeedbackP1(null); setFeedbackP2(null);
        setActiveAdvice(null);
        setChecklistChecks(new Set());
        setIsChecklistOpen(false);
        setDivergenceWarning(null);
        setOverrideUsed(false);
        setShowLowCompatModal(null);
        setShowEvidence(false);
        
        onSetEliminationMode(false);
        onSetHighlightAnchor(false);
    };

    // --- P0 TIMER EFFECT ---
    useEffect(() => {
        let interval: number;
        if (p0Active && p0Timer > 0) {
            interval = window.setInterval(() => {
                setP0Timer(prev => prev - 1);
            }, 1000);
        } else if (p0Active && p0Timer === 0) {
            setP0(true);
            setP0Active(false);
        }
        return () => clearInterval(interval);
    }, [p0Active, p0Timer]);

    // --- P3 EFFECT ---
    useEffect(() => {
        if (p3) onSetHighlightAnchor(true);
    }, [p3, onSetHighlightAnchor]);

    // --- P4 STATE MANAGER ---
    useEffect(() => {
        if (p4Phase === 'SCAN' && p3) {
            setP4Phase('CHECKLIST');
        }
        if (p4Phase === 'ELIMINATING') {
            onSetEliminationMode(true);
        } else {
            onSetEliminationMode(false);
        }
    }, [p3, p4Phase, onSetEliminationMode]);

    // --- GATING LOGIC ---
    useEffect(() => {
        const p4Done = p4Phase === 'DONE';
        const stepsCompleted = [p0, !!p1, !!p2, p3, p4Done, !!p5, !!p6, p7].filter(Boolean).length;
        
        const triggerStats: TriggerStat[] = foundTriggers.map(t => ({
            term: t.word,
            category: t.category,
            detected: true 
        }));
        
        // Final Divergence Check Logic
        let userMissReason = undefined;
        if (userAnswer && p2 && autoAnalysis) {
             // If user picked P2 distinct from suggested, save reason
             if (p2 !== autoAnalysis.suggestedTrap) {
                  userMissReason = `diverged_${p2}_vs_suggested_${autoAnalysis.suggestedTrap}`;
             }
        }
        
        // Pass evidence map only if feature is used
        const evidenceData = showEvidence && evidenceMap ? evidenceMap : undefined;

        const data: TrapscanEntry = {
            mode,
            enabled: true,
            p0_pause: p0,
            command: p1,
            trapType: p2,
            p3_cut: p3,
            eliminatedOptions: eliminatedOptions,
            ruleText: p5,
            prediction: p6, 
            p7_check: p7,
            triggerStats, 
            scriptChecks: Array.from(p4Checks), 
            checklistState: Array.from(checklistChecks),
            detectedSuggestions: checklistSuggestion ? {
                command: checklistSuggestion.cmd,
                trap: checklistSuggestion.trap,
                confidence: checklistSuggestion.confidence
            } : undefined,
            autoAnalysis: autoAnalysis || undefined,
            evidenceMap: evidenceData, // NEW: Log evidence usage
            overrideUsed,
            userMissReason,
            decisiveRule: autoAnalysis?.decisiveRule,
            unlockAtMs: (p1 && p2) ? Date.now() - startTimeRef.current : undefined,
            detectedCommand,
            detectedTrap,
            completedSteps: stepsCompleted
        };
        
        onUpdate(data);

        if (config.assistMode && mode === 'TREINO') {
             if (p1 && p2) onUnlock();
             const canSubmit = p0 && p1 && p2 && p3 && p4Done && p5 && p6 && userAnswer && p7;
             onAllowSubmit(!!canSubmit);
        } else {
            onUnlock();
            onAllowSubmit(!!userAnswer);
        }
        
    }, [p0, p1, p2, p3, p4Phase, p4Checks, p5, p6, p7, checklistChecks, checklistSuggestion, eliminatedOptions, userAnswer, mode, config.assistMode, foundTriggers, autoAnalysis, overrideUsed, detectedCommand, detectedTrap, showEvidence, evidenceMap]);

    // --- HANDLERS ---
    const handleStartP0 = () => setP0Active(true);

    const handleP1Select = (cmd: string) => {
        setP1(cmd);
        if (autoAnalysis && cmd !== autoAnalysis.suggestedCommand) {
             setFeedbackP1('WARN');
             setOverrideUsed(true);
        } else {
             setFeedbackP1('OK');
        }
    };

    const confirmP2Select = (trap: string) => {
        setP2(trap);
        setShowLowCompatModal(null);
        
        // Auto Highlight Trigger
        if (autoHighlight) {
            setShowEvidence(true);
        }
        
        if (autoAnalysis && autoAnalysis.suggestedTrap !== trap && autoAnalysis.confidence > 50) {
             setDivergenceWarning(`⚠️ Atenção: A IA sugere ${autoAnalysis.suggestedTrap} (Rule: ${autoAnalysis.decisiveRule}).`);
             setOverrideUsed(true);
        } else {
             setDivergenceWarning(null);
        }

        if (autoAnalysis && trap === autoAnalysis.suggestedTrap) setFeedbackP2('OK');
        else setFeedbackP2('WARN');
    };

    const handleP2Select = (trap: string) => {
        // Intercept low compatibility choice
        const candidate = autoAnalysis?.axisCandidates?.find(c => c.axis === trap);
        const score = candidate?.score || 0;
        
        if (score < 40 && autoAnalysis && autoAnalysis.confidence > 60) {
             setShowLowCompatModal(trap);
        } else {
             confirmP2Select(trap);
        }
    };

    const handleCheckItem = (itemId: string, blockCategory: any) => {
        setP4Checks(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
                setActiveAdvice(null);
            } else {
                next.add(itemId);
                const def = TRIGGER_WORDS[blockCategory as keyof typeof TRIGGER_WORDS];
                if (def) setActiveAdvice(def.advice);
            }
            return next;
        });
    };

    const handleStartElimination = () => {
        setP4Phase('ELIMINATING');
        setActiveAdvice(null);
    };

    const handleFinishElimination = () => {
        setP4Phase('DONE');
    };

    const handleToggleChecklist = (id: string) => {
        const newSet = new Set<string>(checklistChecks);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setChecklistChecks(newSet);
        const result = calculateDetectionScore(Array.from(newSet));
        if (result.hasP1Check || result.hasP2Check) {
            setChecklistSuggestion({
                cmd: result.suggestedCommand,
                trap: result.suggestedTrap,
                confidence: result.confidence
            });
        } else {
            setChecklistSuggestion(null);
        }
    };
    
    const handleApplySuggestion = () => {
        if (!checklistSuggestion && !autoAnalysis) return;
        const cmd = checklistSuggestion?.cmd || autoAnalysis?.suggestedCommand || '';
        const trap = checklistSuggestion?.trap || autoAnalysis?.suggestedTrap || '';
        if (cmd) setP1(cmd);
        if (trap) setP2(trap);
        setIsChecklistOpen(false);
    };

    if (!config.assistMode) return null;

    const renderStep = (
        isDone: boolean, 
        isCurrent: boolean, 
        label: string, 
        content: React.ReactNode, 
        warning?: React.ReactNode, 
        isBlocked: boolean = false
    ) => {
        if (isBlocked && !isDone) return null; 

        return (
            <div className={`border-l-2 pl-4 pb-6 transition-all duration-300 relative ${isDone ? 'border-emerald-500/50' : isCurrent ? 'border-sky-500' : 'border-slate-800'}`}>
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${isDone ? 'bg-emerald-500 border-emerald-500' : isCurrent ? 'bg-sky-500 border-sky-500 animate-pulse' : 'bg-slate-900 border-slate-700'}`}>
                    {isDone && <CheckCircleIcon className="w-3 h-3 text-white m-auto" />}
                </div>
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-sky-400' : isDone ? 'text-emerald-500' : 'text-slate-600'}`}>
                        {label}
                    </span>
                </div>
                {(isCurrent || isDone) && (
                    <div className="animate-fade-in space-y-2">
                        {content}
                        {warning}
                    </div>
                )}
            </div>
        );
    };

    const p4Done = p4Phase === 'DONE';
    let currentStep = 'P0';
    if (p0) currentStep = 'P1';
    if (p0 && p1) currentStep = 'P2';
    if (p0 && p1 && p2) currentStep = 'P3';
    if (p0 && p1 && p2 && p3) currentStep = 'P4';
    if (p0 && p1 && p2 && p3 && p4Done) currentStep = 'P5';
    if (p0 && p1 && p2 && p3 && p4Done && p5) currentStep = 'P6';
    if (p0 && p1 && p2 && p3 && p4Done && p5 && p6) currentStep = 'P7';
    if (p0 && p1 && p2 && p3 && p4Done && p5 && p6 && userAnswer) currentStep = 'P7_CONFIRM';
    if (p7) currentStep = 'DONE';
    
    return (
        <div className={`rounded-2xl border-2 transition-all duration-500 overflow-hidden relative mb-6 ${mode === 'TREINO' ? 'bg-slate-900 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.15)]' : 'bg-slate-900/50 border-white/5'}`}>
            
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <RadarIcon className={`w-4 h-4 ${mode === 'TREINO' ? 'text-indigo-400' : 'text-emerald-500'}`} />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-300">Trapscan Executável</span>
                </div>
                <div className="flex gap-2">
                     <button 
                        onClick={() => setShowEvidence(!showEvidence)}
                        className={`p-1.5 rounded-lg border transition-all ${showEvidence ? 'bg-sky-500/20 text-sky-400 border-sky-500/50' : 'bg-transparent text-slate-500 border-transparent hover:text-white'}`}
                        title="Mostrar Evidências"
                     >
                         <EyeIcon className="w-3.5 h-3.5" />
                     </button>
                    <button onClick={resetState} className="text-slate-500 hover:text-white" title="Resetar"><TrashIcon className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            <div className="p-4 relative">
                
                {/* Evidence Controls */}
                <div className="mb-4 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={autoHighlight} onChange={e => setAutoHighlight(e.target.checked)} className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-offset-0 focus:ring-sky-500" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide hover:text-slate-300 transition-colors">Auto-destacar no P2</span>
                    </label>
                </div>
                
                {/* Mini Evidence Map */}
                {showEvidence && evidenceMap && (
                     <EvidenceMapList evidence={evidenceMap} />
                )}

                {/* P0: Micro Pausa */}
                {renderStep(p0, currentStep === 'P0', 'P0 • Micro-Pausa', (
                     <button 
                        onClick={handleStartP0}
                        disabled={p0 || p0Active}
                        className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${p0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : p0Active ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-600 text-white hover:bg-sky-500 shadow-lg'}`}
                     >
                         {p0 ? <><CheckCircleIcon className="w-4 h-4"/> Pausa Realizada</> : p0Active ? <><ClockIcon className="w-4 h-4 animate-spin"/> {p0Timer}s...</> : <><BoltIcon className="w-4 h-4"/> 🛑 PARE E RESPIRE (2s)</>}
                     </button>
                ))}
                
                {/* P1: Comando */}
                {renderStep(!!p1, currentStep === 'P1', 'P1 • Identifique o Comando', (
                    <div className="grid grid-cols-2 gap-2">
                        {COMMAND_OPTS.map(cmd => {
                            const isSuggested = (checklistSuggestion?.cmd === cmd.id) || (autoAnalysis?.suggestedCommand === cmd.id);
                            return (
                                <button
                                   key={cmd.id}
                                   onClick={() => handleP1Select(cmd.id)}
                                   disabled={!!p1 && p1 !== cmd.id}
                                   className={`px-2 py-2 rounded-lg text-[9px] font-black uppercase border transition-all relative ${p1 === cmd.id 
                                       ? (feedbackP1 === 'OK' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white') 
                                       : isSuggested ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/50' : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/30 hover:bg-white/10'}`}
                                >
                                    {cmd.label}
                                    {isSuggested && !p1 && <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span></span>}
                                </button>
                            );
                        })}
                    </div>
                ), feedbackP1 === 'WARN' && (
                    <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded flex items-start gap-2 mt-2">
                        <ExclamationTriangleIcon className="w-4 h-4 text-rose-500 shrink-0" />
                        <div>
                             <p className="text-[10px] text-rose-300 font-bold leading-tight">Provável Erro ❌</p>
                             <p className="text-[9px] text-slate-400 mt-1">Detectado: <strong className="text-white">{detectedCommand}</strong>. Releia!</p>
                             <button onClick={() => setP1('')} className="mt-2 text-[9px] underline text-rose-400">Tentar Novamente</button>
                        </div>
                    </div>
                ), currentStep !== 'P1' && !p1)}

                {/* P2: Trap (Enhanced) */}
                {renderStep(!!p2, currentStep === 'P2', 'P2 • Eixo da Armadilha', (
                    <>
                        {/* Quick Rules Fixed Block */}
                        <QuickRulesBlock suggestedTrap={autoAnalysis?.suggestedTrap} mode="TRAINING" />
                        
                        {/* Axis Gear (Explanation) */}
                        {autoAnalysis && showAxisGear && <AxisGearBlock analysis={autoAnalysis} />}

                        <div className="flex flex-wrap gap-2">
                             {Object.keys(TRAP_REQ_DEFS).filter(k => k !== 'SEM_DADO').map(key => {
                                 const isSuggested = (checklistSuggestion?.trap === key) || (autoAnalysis?.suggestedTrap === key);
                                 return (
                                     <button
                                        key={key}
                                        onClick={() => handleP2Select(key)}
                                        disabled={!!p2 && p2 !== key}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all relative ${p2 === key 
                                            ? (feedbackP2 === 'OK' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-amber-600 border-amber-500 text-white') 
                                            : isSuggested ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/50' : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10'}`}
                                        title={TRAP_REQ_DEFS[key].label}
                                     >
                                         {key}
                                         {isSuggested && !p2 && <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span></span>}
                                     </button>
                                 );
                             })}
                        </div>
                    </>
                ), (feedbackP2 === 'WARN' || divergenceWarning) ? (
                     <div className="flex flex-col gap-2 mt-2">
                        {divergenceWarning && (
                            <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded text-[9px] text-amber-200">
                                {divergenceWarning}
                            </div>
                        )}
                     </div>
                ) : null, currentStep !== 'P2' && !p2)}

                {/* P3: Recorte */}
                {renderStep(p3, currentStep === 'P3', 'P3 • Recorte Mental', (
                     <button onClick={() => setP3(true)} disabled={p3} className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-2 ${p3 ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-sky-500/50'}`}>
                        <BoltIcon className="w-4 h-4"/> {p3 ? 'Recorte Visualizado' : 'DESTACAR FRASE ÂNCORA'}
                     </button>
                ), undefined, currentStep !== 'P3' && !p3)}

                {/* P4: INVESTIGAÇÃO GUIADA */}
                {renderStep(p4Done, currentStep === 'P4', 'P4 • Gatilhos & Eliminação', (
                    <div className="space-y-4">
                        {/* Phase A: Checklist & Scan */}
                        {p4Phase === 'CHECKLIST' && (
                            <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-white/10">
                                {foundTriggers.length === 0 ? (
                                    <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-center">
                                        <p className="text-[10px] text-slate-400 font-bold mb-2">Nenhum gatilho clássico evidente.</p>
                                        <p className="text-[9px] text-slate-500 mb-3">Verifique manualmente ou avance para literalidade.</p>
                                    </div>
                                ) : (
                                    <div className="mb-2">
                                        <div className="flex items-center gap-2 text-amber-500 mb-2">
                                            <ExclamationTriangleIcon className="w-4 h-4 animate-pulse" />
                                            <span className="text-xs font-black uppercase tracking-widest">Gatilhos Detectados</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {foundTriggers.map((t, i) => (
                                                <span key={i} className={`text-[9px] font-black uppercase px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20`}>
                                                    {t.word}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {activeAdvice && (
                                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg animate-fade-in">
                                        <div className="flex items-center gap-2 mb-1 text-indigo-400">
                                            <LightBulbIcon className="w-3 h-3" />
                                            <span className="text-[9px] font-black uppercase">Assistente</span>
                                        </div>
                                        <p className="text-[10px] text-indigo-200 leading-relaxed font-medium">
                                            "{activeAdvice}"
                                        </p>
                                    </div>
                                )}

                                <button 
                                    onClick={handleStartElimination}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-colors"
                                >
                                    Ir para Eliminação
                                </button>
                            </div>
                        )}

                        {/* Phase B: Elimination (Active Mode) */}
                        {p4Phase === 'ELIMINATING' && (
                             <div className="space-y-3 bg-rose-900/10 p-4 rounded-xl border border-rose-500/20 animate-fade-in">
                                <div className="flex items-center gap-2 text-rose-400 mb-2">
                                     <TrashIcon className="w-4 h-4 animate-bounce-subtle" />
                                     <span className="text-xs font-black uppercase tracking-widest">Modo Eliminação Ativo</span>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                    Clique nas alternativas para riscá-las. Não marque a correta ainda.
                                </p>
                                <div className="flex justify-center py-2">
                                     <span className="text-xl font-black text-rose-500">{eliminatedOptions.length}</span>
                                     <span className="text-xs font-bold text-slate-500 ml-2 uppercase self-center">Eliminadas</span>
                                </div>
                                <button 
                                    onClick={handleFinishElimination}
                                    className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                                >
                                    <CheckCircleIcon className="w-4 h-4" /> Concluir & Avançar (P5)
                                </button>
                            </div>
                        )}

                        {/* Phase C: Done (Summary) */}
                        {p4Done && (
                             <div className="flex gap-2 items-center justify-between animate-fade-in">
                                 <div className="flex-1 bg-black/30 rounded-lg p-2 flex items-center justify-center border border-white/5">
                                     <span className={`text-xl font-black ${eliminatedOptions.length > 0 ? 'text-rose-500' : 'text-slate-600'}`}>
                                         {eliminatedOptions.length}
                                     </span>
                                     <span className="text-[9px] text-slate-500 ml-2 uppercase font-bold">Eliminadas</span>
                                 </div>
                                 <button 
                                    onClick={() => setP4Phase('ELIMINATING')} 
                                    className="p-2 text-slate-500 hover:text-white bg-white/5 rounded-lg transition-colors" 
                                    title="Reabrir Eliminação"
                                 >
                                     <PencilIcon className="w-3 h-3" />
                                 </button>
                                 <div className="text-[9px] text-emerald-500 font-bold uppercase flex items-center gap-1">
                                     <CheckCircleIcon className="w-3 h-3" /> Investigação Concluída
                                 </div>
                             </div>
                        )}
                    </div>
                ), undefined, currentStep !== 'P4' && !p4Done)}

                {/* P5: Rule Definition */}
                {renderStep(!!p5, currentStep === 'P5', 'P5 • Regra de 1 Linha', (
                    <div className="space-y-2">
                        <p className="text-[9px] text-slate-400 italic">Com base nas eliminações, qual a regra que sobra?</p>
                        <div className="flex gap-2">
                            <input 
                                value={p5} 
                                onChange={e => setP5(e.target.value)} 
                                placeholder="Ex: Prazo é 5 dias..." 
                                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-xs text-white outline-none focus:border-sky-500 placeholder-slate-600"
                            />
                            <button onClick={() => p5 && setP5(p5)} disabled={!p5} className="px-4 bg-sky-600 disabled:bg-slate-700 text-white rounded-xl text-[10px] font-black hover:bg-sky-500 transition-colors">OK</button>
                        </div>
                    </div>
                ), undefined, currentStep !== 'P5' && !p5)}

                {/* P6: Prediction */}
                {renderStep(!!p6, currentStep === 'P6', 'P6 • Predição (Survivor)', (
                    <div className="space-y-2">
                        <p className="text-[10px] text-slate-400">Qual sobrou como provável correta?</p>
                        <div className="flex flex-wrap gap-2">
                            {['A','B','C','D','E'].filter(opt => !eliminatedOptions.includes(opt) && question.options[opt]).map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setP6(opt)}
                                    className={`w-8 h-8 rounded-lg font-black text-xs border ${p6 === opt ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                ), undefined, currentStep !== 'P6' && !p6)}
                
                {/* P7: Final Check */}
                {(currentStep === 'P7' || currentStep === 'P7_CONFIRM' || currentStep === 'DONE') && renderStep(p7, currentStep.startsWith('P7'), 'P7 • Check Reverso', (
                    <div className="space-y-3">
                         <div className="bg-slate-900/50 p-2 rounded text-center border border-white/5">
                             <p className="text-[9px] text-slate-500 uppercase font-bold">Você Previu: <strong className="text-purple-400 text-sm">{p6}</strong></p>
                         </div>
                        <button 
                            onClick={() => setP7(true)} 
                            disabled={p7 || !userAnswer}
                            className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${p7 ? 'bg-emerald-600 text-white' : userAnswer ? 'bg-orange-500 text-black hover:bg-orange-400 animate-bounce-subtle' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                        >
                            {p7 ? <><CheckCircleIcon className="w-4 h-4"/> Check Confirmado</> : !userAnswer ? 'Marque a resposta acima primeiro' : <><ShieldCheckIcon className="w-4 h-4"/> GARANTIR (Li a letra certa?)</>}
                        </button>
                    </div>
                ))}
            </div>

            {/* Low Compatibility Warning Modal */}
            {showLowCompatModal && (
                <div className="fixed inset-0 z-[12000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center gap-3 mb-4 text-amber-500">
                             <ExclamationTriangleIcon className="w-8 h-8" />
                             <h3 className="font-black text-lg uppercase tracking-tight text-white">Eixo Pouco Compatível</h3>
                        </div>
                        <p className="text-sm text-slate-300 mb-6">
                            A IA detectou poucos sinais para o eixo <strong>{showLowCompatModal}</strong>. 
                            <br/><br/>
                            O eixo sugerido com mais força é <strong>{autoAnalysis?.suggestedTrap}</strong> ({autoAnalysis?.confidence}% de confiança).
                        </p>
                        
                        <div className="flex flex-col gap-3">
                             <button 
                                onClick={() => confirmP2Select(showLowCompatModal)}
                                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest"
                             >
                                 Manter minha escolha ({showLowCompatModal})
                             </button>
                             <button 
                                onClick={() => {
                                    setShowLowCompatModal(null);
                                    // Optionally open gear or just close
                                    setShowAxisGear(true);
                                }}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase tracking-widest"
                             >
                                 Voltar e Analisar (Ver Engrenagem)
                             </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrapscanGate;
