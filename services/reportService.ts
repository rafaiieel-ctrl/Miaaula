
import { AttemptReport, WrongItemReport, Question, Flashcard, PracticeType, SessionResult, AppSettings } from '../types';
import { saveData, loadData } from './storage';
import * as srs from './srsService';

const LS_REPORTS_KEY = 'revApp_attempt_reports_v1';

/**
 * Salva um novo relatório de tentativa.
 */
export async function saveAttemptReport(report: AttemptReport): Promise<void> {
    try {
        const existing = await loadData<AttemptReport[]>(LS_REPORTS_KEY) || [];
        // Mantém apenas os últimos 200 relatórios para performance
        const updated = [report, ...existing].slice(0, 200);
        await saveData(LS_REPORTS_KEY, updated);
        console.log('[ReportService] Relatório salvo:', report.id);
    } catch (e) {
        console.error('[ReportService] Erro ao salvar relatório:', e);
    }
}

/**
 * Lista relatórios filtrados por aula ou trilha.
 */
export async function listReportsByLesson(lessonId: string): Promise<AttemptReport[]> {
    const all = await loadData<AttemptReport[]>(LS_REPORTS_KEY) || [];
    return all.filter(r => r.lessonId === lessonId);
}

/**
 * Faz o download de um relatório específico em formato JSON.
 */
export function downloadReportAsJson(report: AttemptReport): void {
    try {
        const dataStr = JSON.stringify(report, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const date = new Date(report.finishedAt);
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.getHours().toString().padStart(2, '0') + '-' + date.getMinutes().toString().padStart(2, '0');
        
        const exportFileDefaultName = `miaaula_report_${report.lessonId}_${report.practiceType}_${dateStr}_${timeStr}.json`
            .replace(/[^a-z0-9.]/gi, '_')
            .toLowerCase();

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    } catch (e) {
        console.error('[ReportService] Erro ao exportar JSON:', e);
        alert('Erro ao gerar arquivo para download.');
    }
}

/**
 * Converte um conjunto de questões respondidas em um relatório de erros.
 */
export function buildReportFromQuestions(
    lessonId: string,
    practiceType: PracticeType,
    startedAt: Date,
    answeredQuestions: Question[]
): AttemptReport {
    const finishedAt = new Date();
    const wrongQuestions = answeredQuestions.filter(q => !q.lastWasCorrect);
    
    const wrongItems: WrongItemReport[] = wrongQuestions.map(q => {
        const userAns = q.yourAnswer || '-';
        const correctAns = q.correctAnswer;
        
        return {
            itemId: q.id,
            qRef: q.questionRef,
            text: q.questionText,
            userAnswer: userAns,
            correctAnswer: correctAns,
            userAnswerText: q.options[userAns as keyof typeof q.options] || '—',
            correctAnswerText: q.options[correctAns as keyof typeof q.options] || '—',
            explanation: q.explanation,
            wrongDiagnosis: q.wrongDiagnosis,
            subject: q.subject,
            topic: q.topic
        };
    });

    const total = answeredQuestions.length;
    const correct = total - wrongItems.length;

    return {
        id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        lessonId,
        practiceType,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        totalItems: total,
        totalCorrect: correct,
        totalWrong: wrongItems.length,
        accuracyPct: total > 0 ? Math.round((correct / total) * 100) : 0,
        durationSec: Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
        wrongItems
    };
}

/**
 * Calcula o consolidado da sessão para o Relatório Visual de Progresso com deltas.
 */
export function calculateSessionResult(
    title: string,
    startedAt: Date,
    answeredQuestions: Question[],
    initialStates: Map<string, { mastery: number, domain: number }>,
    settings: AppSettings,
    isCompleted: boolean
): SessionResult {
    const endedAt = new Date();
    const answeredCount = answeredQuestions.length;
    const correctCount = answeredQuestions.filter(q => q.lastWasCorrect).length;
    const wrongCount = answeredCount - correctCount;
    
    let totalMasteryGain = 0;
    let totalDomainGain = 0;
    
    answeredQuestions.forEach(q => {
        const initial = initialStates.get(q.id);
        if (initial) {
            const currentDomain = srs.calculateCurrentDomain(q, settings);
            totalMasteryGain += (q.masteryScore - initial.mastery);
            totalDomainGain += (currentDomain - initial.domain);
        }
    });

    const avgMasteryGain = answeredCount > 0 ? totalMasteryGain / answeredCount : 0;
    const avgDomainGain = answeredCount > 0 ? totalDomainGain / answeredCount : 0;
    const accuracy = answeredCount > 0 ? (correctCount / answeredCount) * 100 : 0;

    return {
        id: `session_${Date.now()}`,
        title,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        totalQuestions: answeredCount,
        answeredCount,
        correctCount,
        wrongCount,
        accuracy,
        totalTimeSec: Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
        masteryGain: avgMasteryGain,
        domainGain: avgDomainGain,
        performanceScore: accuracy,
        isCompleted
    };
}
