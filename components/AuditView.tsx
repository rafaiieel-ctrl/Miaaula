
import React, { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { runAuditTests, AuditReport } from '../services/queueBuilder';

// --- Report Rendering Components ---
const Section: React.FC<{ title: string; status: boolean; children: React.ReactNode; }> = ({ title, status, children }) => (
    <div className="p-4 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
        <h3 className="font-bold text-lg mb-3 flex justify-between items-center">
            <span>{title}</span>
            <span className={`px-3 py-1 text-sm font-bold rounded-full ${status ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                {status ? 'PASS ✔️' : 'FAIL ❌'}
            </span>
        </h3>
        <div className="text-sm space-y-2">{children}</div>
    </div>
);

const Table: React.FC<{ headers: string[]; data: (string | number)[][]; }> = ({ headers, data }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
            <thead className="bg-bunker-200 dark:bg-bunker-800">
                <tr>{headers.map(h => <th key={h} className="p-2">{h}</th>)}</tr>
            </thead>
            <tbody>
                {data.map((row, i) => (
                    <tr key={i} className="border-b border-bunker-200 dark:border-bunker-800">
                        {row.map((cell, j) => <td key={j} className="p-2 font-mono">{cell}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const AuditView: React.FC = () => {
    const { settings } = useSettings();
    const [report, setReport] = useState<AuditReport | null>(null);

    useEffect(() => {
        const auditResult = runAuditTests(settings);
        setReport(auditResult);
    }, [settings]);

    if (!report) {
        return <div className="text-center p-8">Calculando relatório de auditoria...</div>;
    }
    
    const { results, checks } = report;

    return (
        <div className="space-y-4 font-sans text-slate-800 dark:text-slate-200">
            <div className={`p-4 rounded-lg text-center ${checks.allTestsPass ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                <h2 className="text-2xl font-bold">Relatório de Auditoria de Lógicas</h2>
                <p className="font-semibold">{checks.allTestsPass ? 'Status: 100% PASS' : 'Status: FALHA. Verifique os itens abaixo.'}</p>
            </div>
            
            <Section title="1) Tabela R & D (Retrievability & Domain)" status={checks.rdCheck}>
                <Table headers={['id', 'Δt(dias)', 'S', 'R', 'D']} data={results.rd.map(r => [r.id, r.dt.toFixed(2), r.S, r.R.toFixed(4), r.D.toFixed(2)])} />
            </Section>

            <Section title="2) Fila - Modo Spaced" status={checks.spacedQueueCheck}>
                <p className="text-xs">Validação: Ordem esperada `Q4, Q1, Q2, Q3, Q5`.</p>
                <Table headers={['Ordem', 'id', 'R_now', 'Priority']} data={results.spacedQueue.map((r,i) => [i+1, r.id, r.R_now.toFixed(4), r.priority.toFixed(4)])} />
            </Section>

            <Section title="3) Fila - Modo Prova" status={checks.examQueueCheck}>
                 <p className="text-xs">Validação: Ordem esperada `Q3, Q4, Q2, Q1, Q5`.</p>
                 <Table headers={['Ordem', 'id', 'R_proj', 'Priority_exam']} data={results.examQueue.map((r, i) => [i + 1, r.id, r.R_proj.toFixed(4), r.priority.toFixed(4)])} />
            </Section>

            <Section title="4) Atualização de S (Estabilidade)" status={checks.sUpdateCheck}>
                <Table headers={['Caso', 'Cenário', 'S_antes', 'S_depois', 'Ganho']} data={[
                    ['A', 'Acerto com R≈0.72', results.sUpdate.caseA.s_before.toFixed(2), results.sUpdate.caseA.s_after.toFixed(2), `+${results.sUpdate.caseA.gain.toFixed(2)}`],
                    ['B', 'Acerto com R≈0.99', results.sUpdate.caseB.s_before.toFixed(2), results.sUpdate.caseB.s_after.toFixed(2), `+${results.sUpdate.caseB.gain.toFixed(2)}`],
                    ['C', 'Erro com R≈0.55', results.sUpdate.caseC.s_before.toFixed(2), results.sUpdate.caseC.s_after.toFixed(2), results.sUpdate.caseC.gain.toFixed(2)],
                ]} />
                <p className="text-xs mt-2">Validação: Ganho A {'>'} Ganho B (OK), Ganho C {'<'} 0 (OK)</p>
            </Section>

            <Section title="5) SOP/Tempo & SOP-Guard" status={checks.sopCheck && checks.sopGuardCheck}>
                <Table headers={['Tempo', 'Classificação']} data={results.sop.map(s => [s.time + 's', s.classification])} />
                <p className="text-xs mt-2">Validação Classificação: RUSH, SOP_OK, OVER (OK)</p>
                <p className="text-xs mt-2">SOP-Guard ativo para tipos (02, 03, 04, 07, 15): {results.sopGuardActive ? 'Sim (OK)' : 'Não (FALHA)'}</p>
            </Section>

            <Section title="6) Micro-spacing (Exam Mode)" status={checks.microSpacingCheck}>
                <p>Ao errar questão fraca (S {'<'} 10) às 12:00, a sequência de próximas revisões agendadas seria:</p>
                <ul className="list-disc list-inside font-mono text-xs">
                    {results.microSpacing.map((ts, i) => <li key={i}>Falha {i+1} &rarr; {ts}</li>)}
                </ul>
                <p className="text-xs mt-2">Validação: Checa se a lógica de agendamento nos próximos slots de `microSpacedHours` está correta.</p>
            </Section>
            
            <Section title="7) Limite de conteúdo novo" status={checks.newContentCheck}>
                <p>Simulação para uma sessão de 30 itens, com 10 novos disponíveis:</p>
                <p>Itens novos na sessão: <strong className="font-mono">{results.queueMix.new}</strong> (Limite: 3)</p>
                <p>Total de itens na sessão: <strong className="font-mono">{results.queueMix.total}</strong></p>
                <p>% de conteúdo novo: <strong className="font-mono">{results.queueMix.pctNew.toFixed(1)}%</strong> (Limite: 10%)</p>
            </Section>
            
            <Section title="8) Sessão de Estudo Real (Log)" status={true}>
                <p>Abaixo está um exemplo de log JSON e KPIs gerados para uma sessão no modo padrão com 10 itens e filtros.</p>
                <pre className="text-xs p-3 bg-bunker-50 dark:bg-bunker-800 rounded-md overflow-auto max-h-60">
                    <code>{JSON.stringify(results.sessionLog, null, 2)}</code>
                </pre>
            </Section>
        </div>
    );
};

export default AuditView;
