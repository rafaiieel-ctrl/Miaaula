
import React from 'react';
import { BoltIcon, PuzzlePieceIcon, TrendingUpIcon, CrosshairIcon, MapIcon, RadarIcon, FireIcon } from '../icons';
import { Question } from '../../types';
import { filterExecutableItems } from '../../services/contentGate';

export type RetroGameType = 'space_quiz' | 'brick_break' | 'snake_sprint' | 'law_hunter' | 'gap_hunter' | 'trapscan_reactor' | 'trapscan_pro';
export type QuestionMode = 'literalidade' | 'excecoes' | 'pegadinhas' | 'law_hunter' | 'gap_hunter' | 'trapscan_reactor' | 'trapscan_pro';

export interface GameConfig {
    id: RetroGameType;
    title: string;
    desc: string;
    mode: QuestionMode;
    label: string;
    color: string;
    bg: string;
    border: string;
    button: string; // Add button hover color class
    icon: React.ReactNode;
}

export const GAME_CONFIGS: GameConfig[] = [
    {
        id: 'trapscan_pro',
        title: 'REACTOR PRO+',
        desc: 'Treino adaptativo de elite. Detecta sua fraqueza e foca nela.',
        mode: 'trapscan_pro',
        label: 'ADAPTATIVO',
        color: 'text-rose-500',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        button: 'hover:bg-rose-500/20',
        icon: React.createElement(FireIcon, { className: "w-8 h-8" })
    },
    {
        id: 'trapscan_reactor',
        title: 'TRAPSCAN CLASSIC',
        desc: 'Treine seu reflexo contra armadilhas. Identifique comandos e pegadinhas.',
        mode: 'trapscan_reactor',
        label: 'REFLEXO',
        color: 'text-indigo-400',
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/30',
        button: 'hover:bg-indigo-500/20',
        icon: React.createElement(RadarIcon, { className: "w-8 h-8" })
    },
    {
        id: 'gap_hunter',
        title: 'GAP HUNTER',
        desc: 'Complete a lacuna da lei. Identifique o termo faltante no caos.',
        mode: 'gap_hunter',
        label: 'LACUNAS',
        color: 'text-sky-400',
        bg: 'bg-sky-500/10',
        border: 'border-sky-500/30',
        button: 'hover:bg-sky-500/20',
        icon: React.createElement(MapIcon, { className: "w-8 h-8" })
    },
    {
        id: 'space_quiz',
        title: 'SPACE QUIZ',
        desc: 'Invasores descendo! Use literalidade da lei para defender a base.',
        mode: 'literalidade',
        label: 'LITERALIDADE',
        color: 'text-green-400',
        bg: 'bg-green-500/10',
        border: 'border-green-500/30',
        button: 'hover:bg-green-500/20',
        icon: React.createElement(BoltIcon, { className: "w-8 h-8" })
    },
    {
        id: 'law_hunter',
        title: 'LAW HUNTER',
        desc: 'Encontre a palavra-chave jurídica escondida antes que o tempo acabe.',
        mode: 'law_hunter',
        label: 'PALAVRAS-CHAVE',
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        button: 'hover:bg-yellow-500/20',
        icon: React.createElement(CrosshairIcon, { className: "w-8 h-8" })
    },
    {
        id: 'brick_break',
        title: 'BRICK BREAK',
        desc: 'Quebre a parede de exceções. Acerte casos especiais e regras de exclusão.',
        mode: 'excecoes',
        label: 'EXCEÇÕES',
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/30',
        button: 'hover:bg-cyan-500/20',
        icon: React.createElement(PuzzlePieceIcon, { className: "w-8 h-8" })
    },
    {
        id: 'snake_sprint',
        title: 'SNAKE SPRINT',
        desc: 'Cuidado com as armadilhas! Identifique pegadinhas da banca para crescer.',
        mode: 'pegadinhas',
        label: 'PEGADINHAS',
        color: 'text-pink-400',
        bg: 'bg-pink-500/10',
        border: 'border-pink-500/30',
        button: 'hover:bg-pink-500/20',
        icon: React.createElement(TrendingUpIcon, { className: "w-8 h-8" })
    }
];

export const filterQuestionsByMode = (allQuestions: Question[], mode: QuestionMode): Question[] => {
    // 1. GATE Check
    const activeQuestions = filterExecutableItems(allQuestions);
    
    // Basic eligibility
    let candidates = activeQuestions.filter(q => q.totalAttempts === 0 || q.nextReviewDate <= new Date().toISOString() || q.isCritical);
    if (candidates.length < 20) {
        // Fallback to all valid questions if not enough due/new
        candidates = activeQuestions; 
    }

    const normalize = (s?: string) => (s || '').toLowerCase();
    
    // STRICT FILTERING
    let filtered = candidates.filter(q => {
        const type = normalize(q.questionType);
        const skill = normalize(q.skill);
        const text = normalize(q.questionText);
        const tags = (q.tags || []).map(normalize);

        switch (mode) {
            case 'trapscan_pro':
            case 'trapscan_reactor':
                // Any non-gap question is valid for reactor
                return !q.isGapType && q.questionText && q.questionText.length > 20;

            case 'gap_hunter':
                return !!q.isGapType || type.includes('lacuna') || q.questionText.includes('{{') || q.questionText.includes('___');

            case 'literalidade':
                return type.includes('literal') || skill.includes('literal') || tags.includes('literalidade');
            
            case 'excecoes':
                return type.includes('excecao') || skill.includes('excecao') || text.includes('exceto') || text.includes('salvo') || text.includes('ressalvado');
            
            case 'pegadinhas':
                return type.includes('pegadinha') || skill.includes('armadilha') || q.bank?.toUpperCase().includes('FCC') || q.bank?.toUpperCase().includes('FGV');
            
            case 'law_hunter':
                // Para Law Hunter, precisamos de questões que tenham campos ricos de onde extrair palavras
                return !!(q.keyDistinction || q.anchorText || q.guiaTrapscan || (q.distractorProfile && Object.keys(q.distractorProfile).length > 0) || text.includes('exceto') || text.includes('salvo') || text.includes('sempre'));

            default:
                return true;
        }
    });

    // FALLBACK LOGIC (Essential to avoid empty games)
    if (filtered.length < 10) {
        if (mode === 'gap_hunter') {
             // Tenta pegar qualquer questão que tenha cara de lacuna mesmo sem flag
             filtered = activeQuestions.filter(q => q.questionText.includes('___') || q.questionText.includes('...'));
        } else if (mode === 'literalidade') {
            // Fallback: Concept questions
            filtered = candidates.filter(q => q.questionType?.includes('Conceito') || !q.questionType); 
        } else if (mode === 'excecoes') {
            // Fallback: Questions with "Somente" or "Apenas" (often exceptions/restrictive)
            filtered = candidates.filter(q => {
                const t = normalize(q.questionText);
                return t.includes('somente') || t.includes('apenas') || t.includes('vedado');
            });
        } else if (mode === 'pegadinhas') {
            // Fallback: Hard questions (Level 3) or Critical ones
            filtered = candidates.filter(q => q.isCritical || (q.difficultyLevel === 'difficult'));
        } else if (mode === 'law_hunter') {
            // Fallback: Qualquer questão com texto longo o suficiente para extrair palavras
            filtered = candidates.filter(q => (q.questionText || '').length > 50);
        } else if (mode === 'trapscan_reactor' || mode === 'trapscan_pro') {
            filtered = candidates.filter(q => !q.isGapType);
        }
    }

    // Ultimate Fallback: Just return random shuffle of candidates if still empty
    if (filtered.length === 0) {
        filtered = candidates;
    }

    return filtered.slice(0, 50); // Limit pool size
};
