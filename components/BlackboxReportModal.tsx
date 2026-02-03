
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { XMarkIcon, DownloadIcon, RefreshIcon, BoltIcon, ExclamationTriangleIcon, CheckCircleIcon } from './icons';
import { traceService, TraceEvent } from '../services/traceService';
import { runImportSelfTest } from '../services/import/litRefParser';

interface BlackboxReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ReportSection: React.FC<{ title: string; children: React.ReactNode; isOpen?: boolean }> = ({ title, children, isOpen = true }) => {
    const [expanded, setExpanded] = useState(isOpen);
    return (
        <div className="border border-white/10 rounded-xl bg-white/5 overflow-hidden">
            <button 
                className="w-full flex justify-between items-center p-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
                onClick={() => setExpanded(!expanded)}
            >
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">{title}</h4>
                <span className="text-xs text-slate-500">{expanded ? '▼' : '▶'}</span>
            </button>
            {expanded && <div className="p-3 text-xs font-mono">{children}</div>}
        </div>
    );
};

const BlackboxReportModal: React.FC<BlackboxReportModalProps> = ({ isOpen, onClose }) => {
    const [events, setEvents] = useState<TraceEvent[]>([]);
    const [filterScope, setFilterScope] = useState<string>('ALL');
    const [selfTestResult, setSelfTestResult] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'log' | 'diagnostics'>('log');

    const loadLogs = async () => {
        const logs = await traceService.exportLogs();
        setEvents(logs);
    };

    useEffect(() => {
        if (isOpen) loadLogs();
    }, [isOpen]);

    const handleDownload = () => {
        const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `blackbox_trace_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleRunSelfTest = async () => {
        setSelfTestResult(null);
        const result = await runImportSelfTest();
        setSelfTestResult(result);
        loadLogs(); // Refresh logs to show trace
    };

    if (!isOpen) return null;

    const filteredEvents = filterScope === 'ALL' ? events : events.filter(e => e.scope === filterScope);
    
    // Find reports
    const lastImportReport = events.find(e => e.type === 'IMPORT_PARSE_RESULT')?.payload;
    // We prefer AFTER commit audit
    const lastLinkAuditEvents = events.filter(e => e.type === 'IMPORT_LINK_AUDIT_AFTER_COMMIT').slice(0, 20); 
    const lastLinkAuditBeforeEvents = events.filter(e => e.type === 'IMPORT_LINK_AUDIT_BEFORE_COMMIT').slice(0, 5); // Sample

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[11000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-950 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-800" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 rounded-t-3xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 font-mono text-xl">
                            BB
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Blackbox Trace 2.0</h2>
                            <p className="text-xs text-slate-500 font-mono mt-1">Events: {events.length}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setActiveTab('diagnostics')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest ${activeTab === 'diagnostics' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'}`}>Diagnostics</button>
                        <button onClick={() => setActiveTab('log')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest ${activeTab === 'log' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'}`}>Event Log</button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/5"><XMarkIcon className="w-5 h-5"/></button>
                    </div>
                </header>

                {activeTab === 'log' && (
                    <>
                        <div className="p-4 border-b border-slate-800 flex gap-2 overflow-x-auto no-scrollbar justify-between">
                            <div className="flex gap-2">
                                {['ALL', 'IMPORT', 'STORAGE', 'QUESTIONS', 'LITERALNESS', 'UI'].map(scope => (
                                    <button
                                        key={scope}
                                        onClick={() => setFilterScope(scope)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${filterScope === scope ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'}`}
                                    >
                                        {scope}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={loadLogs} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/5"><RefreshIcon className="w-4 h-4"/></button>
                                <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg font-bold text-[10px] uppercase tracking-widest border border-white/5"><DownloadIcon className="w-4 h-4"/> Export</button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-0 custom-scrollbar font-mono text-xs">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-900 text-slate-500 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 border-b border-slate-800">Time</th>
                                        <th className="p-3 border-b border-slate-800">Scope</th>
                                        <th className="p-3 border-b border-slate-800">Type</th>
                                        <th className="p-3 border-b border-slate-800">Ref</th>
                                        <th className="p-3 border-b border-slate-800">Payload</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                                    {filteredEvents.map((evt) => (
                                        <tr key={evt.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-3 whitespace-nowrap text-slate-500">{new Date(evt.ts).toLocaleTimeString()}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                                    evt.scope === 'IMPORT' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    evt.scope === 'STORAGE' ? 'bg-amber-500/20 text-amber-400' :
                                                    evt.scope === 'QUESTIONS' ? 'bg-sky-500/20 text-sky-400' :
                                                    'bg-slate-700 text-slate-300'
                                                }`}>
                                                    {evt.scope}
                                                </span>
                                            </td>
                                            <td className="p-3 font-bold text-white">{evt.type}</td>
                                            <td className="p-3 text-slate-400 max-w-[150px] truncate" title={evt.ref}>{evt.ref || '-'}</td>
                                            <td className="p-3 max-w-md break-all text-slate-500 group-hover:text-slate-300">
                                                {evt.payload ? JSON.stringify(evt.payload).substring(0, 120) + (JSON.stringify(evt.payload).length > 120 ? '...' : '') : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeTab === 'diagnostics' && (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-slate-300">
                        
                        <div className="flex items-center justify-between mb-4">
                             <h3 className="text-lg font-bold text-white">Última Importação</h3>
                             <button onClick={handleRunSelfTest} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs uppercase tracking-widest flex items-center gap-2">
                                <BoltIcon className="w-4 h-4" /> Run Import Self-Test Extended
                             </button>
                        </div>
                        
                        {selfTestResult && (
                             <ReportSection title="Self-Test Result">
                                 <div className="space-y-2">
                                     <div className="flex items-center gap-2">
                                         <span className="font-bold text-sky-400">STATUS:</span>
                                         <span className="text-white">{selfTestResult.auditReport[0]?.status || 'UNKNOWN'}</span>
                                     </div>
                                     <div className="grid grid-cols-2 gap-2 mt-2">
                                         <div className="bg-black/30 p-2 rounded">
                                             <span className="block text-slate-500 mb-1">Parse Stats</span>
                                             <pre>{JSON.stringify(selfTestResult.parseResult.stats, null, 2)}</pre>
                                         </div>
                                         <div className="bg-black/30 p-2 rounded">
                                             <span className="block text-slate-500 mb-1">Audit Link Report</span>
                                             <pre>{JSON.stringify(selfTestResult.auditReport[0], null, 2)}</pre>
                                         </div>
                                     </div>
                                 </div>
                             </ReportSection>
                        )}

                        {lastImportReport ? (
                            <>
                            <ReportSection title="Import Snapshot (Parse Phase)">
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                     <div className="p-3 rounded-lg border border-white/10 bg-white/5 text-center">
                                         <span className="block text-[10px] font-bold uppercase tracking-widest opacity-70">Raw Gaps</span>
                                         <span className="text-xl font-bold text-white">{lastImportReport.gapsParsed || 0}</span>
                                     </div>
                                     <div className="p-3 rounded-lg border border-white/10 bg-white/5 text-center">
                                         <span className="block text-[10px] font-bold uppercase tracking-widest opacity-70">Questions</span>
                                         <span className="text-xl font-bold text-sky-400">{lastImportReport.questionsParsed || 0}</span>
                                     </div>
                                      <div className="p-3 rounded-lg border border-white/10 bg-white/5 text-center">
                                         <span className="block text-[10px] font-bold uppercase tracking-widest opacity-70">Cards</span>
                                         <span className="text-xl font-bold text-emerald-400">{lastImportReport.cardsParsed || 0}</span>
                                     </div>
                                </div>
                            </ReportSection>
                            </>
                        ) : (
                            <div className="p-4 border border-white/10 rounded-xl text-center text-slate-500 italic">Nenhum relatório de importação recente encontrado.</div>
                        )}

                        {lastLinkAuditEvents.length > 0 && (
                            <ReportSection title="Link Audit: After Commit (Regression Check)">
                                <table className="w-full text-left text-[10px]">
                                    <thead className="bg-white/5 text-slate-400">
                                        <tr>
                                            <th className="p-2">Card ID (Canon)</th>
                                            <th className="p-2">Status</th>
                                            <th className="p-2 text-center">Q (Lk/Prev)</th>
                                            <th className="p-2 text-center">FC</th>
                                            <th className="p-2 text-center">Pairs</th>
                                            <th className="p-2">Reason / Delta</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {lastLinkAuditEvents.map(e => e.payload).map((audit, i) => (
                                            <tr key={i} className="hover:bg-white/5">
                                                <td className="p-2 font-mono text-sky-300" title={audit.cardIdRaw}>{audit.cardIdCanon}</td>
                                                <td className="p-2">
                                                    <span className={`px-1.5 py-0.5 rounded font-bold ${audit.status === 'UNCHANGED' ? 'bg-emerald-500/20 text-emerald-400' : audit.status === 'DEGRADED' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {audit.status}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-center font-mono">
                                                    <span className={audit.DIFF && audit.linkedCounts.questions < audit.DIFF.beforeQuestions ? 'text-rose-400' : 'text-white'}>
                                                        {audit.linkedCounts?.questions} / {audit.DIFF?.beforeQuestions || '-'}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-center font-mono">{audit.linkedCounts?.flashcards}</td>
                                                <td className="p-2 text-center font-mono">{audit.linkedCounts?.pairs}</td>
                                                <td className="p-2 text-rose-300">
                                                    {audit.missingReasons?.join(', ')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ReportSection>
                        )}
                        
                        {lastLinkAuditBeforeEvents.length > 0 && (
                             <ReportSection title="Link Audit: Before Commit Sample" isOpen={false}>
                                 <div className="text-[10px] text-slate-500 mb-2">Check to verify if items were linking correctly in memory before saving.</div>
                                 <pre className="bg-black/30 p-2 rounded max-h-40 overflow-y-auto">{JSON.stringify(lastLinkAuditBeforeEvents.map(e=>e.payload), null, 2)}</pre>
                             </ReportSection>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default BlackboxReportModal;
