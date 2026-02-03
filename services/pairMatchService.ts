
import { Flashcard, ItemGameStats, AppSettings, Attempt } from '../types';
import * as srs from './srsService';

/**
 * Classifica a performance do jogador para um par específico para o SRS.
 * Retorna o nível de auto-avaliação (0-3) conforme especificado:
 * 0: Errei / Muito errado
 * 1: Em aprendizagem (Hesitante)
 * 2: Bom
 * 3: Dominado (Confiante)
 */
export function classifyPerformanceSrs(stats: ItemGameStats): 0 | 1 | 2 | 3 {
    // Level 0 - "Erro": Mais de 2 erros ou se desistiu
    if (stats.errors > 2) return 0;
    
    // Level 1 - "Hesitante": 1 ou 2 erros
    if (stats.errors >= 1) return 1;
    
    // Level 2 - "Bom": 0 erros, mas lento (> 5s)
    if (stats.timeToMatchSec > 5) return 2;
    
    // Level 3 - "Confiante": 0 erros e rápido (<= 5s)
    return 3;
}

/**
 * Atualiza o Flashcard usando a lógica ESPECÍFICA para Jogo de Pares.
 * Regras:
 * - Erro: Intervalo = 1, Domínio -10%
 * - Hesitante: Intervalo * 1.5, Domínio +5%
 * - Confiante: Intervalo * 2.0, Domínio +8%
 */
export function updateDominioAfterGame(
  item: Flashcard,
  stats: ItemGameStats,
  settings: AppSettings
): Flashcard {
  const evalLevel = classifyPerformanceSrs(stats);
  const isCorrect = evalLevel > 0;
  
  const now = new Date();
  
  // Current Stability (Interval in days)
  let currentS = item.stability || settings.srsV2.S_default_days;
  let currentMastery = item.masteryScore || 0;
  
  let newS = currentS;
  let newMastery = currentMastery;
  let nextReviewDays = 1;

  if (!isCorrect || evalLevel === 0) {
      // Regra: Erro -> Intervalo 1 dia, Domínio -10%
      newS = 1;
      newMastery = Math.max(0, currentMastery - 10);
      nextReviewDays = 1;
  } else if (evalLevel === 1 || evalLevel === 2) {
      // Regra: Hesitante -> Intervalo * 1.5, Domínio +5%
      // (Mapping Level 1 & 2 to "Hesitant/Good" logic)
      newS = Math.max(1, currentS * 1.5);
      newMastery = Math.min(100, currentMastery + 5);
      nextReviewDays = newS;
  } else {
      // Regra: Confiante -> Intervalo * 2, Domínio +8%
      newS = Math.max(1, currentS * 2.0);
      newMastery = Math.min(100, currentMastery + 8);
      nextReviewDays = newS;
  }

  const nextReviewDateObj = srs.addDaysToDate(now, nextReviewDays);
  
  // Map internal game level to Visual Dominio Level (1-4) for border colors
  // 0 -> 1 (Crítico)
  // 1 -> 2 (Baixo)
  // 2 -> 3 (Bom)
  // 3 -> 4 (Excelente)
  const newVisualDominioLevel = (evalLevel + 1) as 1 | 2 | 3 | 4;

  const updatedCard: Flashcard = {
    ...item,
    stability: newS,
    masteryScore: newMastery,
    nextReviewDate: nextReviewDateObj.toISOString(),
    lastReviewedAt: now.toISOString(),
    dominioLevel: newVisualDominioLevel,
    recentError: isCorrect ? 0 : 1,
    pairMatchPlayed: true,
    lastTimeSec: Math.round(stats.timeToMatchSec),
    lastWasCorrect: isCorrect,
    totalAttempts: (item.totalAttempts || 0) + 1,
    correctStreak: isCorrect ? (item.correctStreak || 0) + 1 : 0,
    attemptHistory: [
        ...(item.attemptHistory || []),
        {
            date: now.toISOString(),
            wasCorrect: isCorrect,
            masteryAfter: newMastery,
            stabilityAfter: newS,
            timeSec: Math.round(stats.timeToMatchSec),
            selfEvalLevel: evalLevel
        }
    ]
  };

  return updatedCard;
}
