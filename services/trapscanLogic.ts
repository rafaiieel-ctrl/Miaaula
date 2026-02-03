
import { TrapscanSessionConfig, TrapscanEntry } from '../types';

export const isTrapscanActive = (config?: TrapscanSessionConfig | null): boolean => {
    return !!(config?.enabled && config?.assistMode);
};

export const checkAlternativesLocked = (
    config: TrapscanSessionConfig | null | undefined, 
    progress: TrapscanEntry | undefined
): boolean => {
    if (!isTrapscanActive(config)) return false;
    // Only lock in TREINO mode
    if (config?.defaultMode !== 'TREINO') return false;
    
    // Unlock alternatives for P4 Elimination when P1+P2 are done.
    // However, P4 ITSELF is the interaction with alternatives.
    // So "Locked" means user can't select Final Answer yet, but can click to eliminate.
    // We handle this "Selection Mode" vs "Elimination Mode" in the QuestionRunner/Viewer level.
    
    // This function specifically controls if the options are completely blurred/unusable.
    // We only blur if P1/P2 are not done in HARD lock.
    const p1 = !!progress?.command;
    const p2 = !!progress?.trapType;
    
    if (config.lockLevel === 'HARD') {
        return !(p1 && p2);
    }
    
    // SOFT lock doesn't blur options, but prevents submit.
    return false;
};

export const getSubmitBlockReason = (
    config: TrapscanSessionConfig | null | undefined, 
    progress: TrapscanEntry | undefined, 
    hasAnswer: boolean
): string | null => {
    if (!hasAnswer) return null; // Button disabled by default if no answer
    if (!isTrapscanActive(config)) return null;
    if (config?.defaultMode !== 'TREINO') return null;

    const p1 = !!progress?.command;
    const p2 = !!progress?.trapType;
    const p7 = !!progress?.p7_check;
    const p5 = !!progress?.ruleText; // New P5
    
    // P4 Enforcement: Trapscan 3.0 allows unlimited eliminations (even 0), 
    // but we might want to warn or track. For now, strict blocking on elimination count is removed.
    // const eliminatedCount = progress?.eliminatedOptions?.length || 0;
    // if (eliminatedCount < 2) return "Elimine pelo menos 2 alternativas (P4)"; 

    if (!p1) return "Identifique o Comando (P1)";
    if (!p2) return "Identifique a Armadilha (P2)";
    
    // P5 Enforcement - Still critical for methodology
    if (!p5) return "Defina a Regra (P5)";

    if (!p7) return "Faça o Check Reverso (P7)";

    return null; // Allowed
};

export const checkSubmitAllowed = (
    config: TrapscanSessionConfig | null | undefined, 
    progress: TrapscanEntry | undefined, 
    hasAnswer: boolean
): boolean => {
    return getSubmitBlockReason(config, progress, hasAnswer) === null;
};
