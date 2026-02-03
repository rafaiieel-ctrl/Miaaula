
import React from 'react';
import ReactDOM from 'react-dom';
import { XMarkIcon, DownloadIcon } from './icons';
import { BatchReport } from '../services/leiSecaDoctor';

interface BatchReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: BatchReport | null;
}

const BatchReportModal: React.FC<BatchReportModalProps> = ({ isOpen, onClose, report }) => {
    if (!isOpen || !report) return null;

    const handleDownloadJson = () => {
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch_report_${report.meta.batchId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] border border-white/10" onClick={e => e.stopPropagation()}>
                <header className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-800/50 rounded-t-3xl">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Relatório Técnico de Lote</h2>
                        <p className="text-xs text-slate-400 font-mono mt-1">Batch ID: {report.meta.batchId}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-full"><XMarkIcon className="w-6 h-6"/></button>
                </header>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* Meta Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Cards</span>
                            <span className="text-3xl font-black text-white">{report.meta.stats.cards}</span>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Questões</span>
                            <span className="text-3xl font-black text-sky-400">{report.meta.stats.questions}</span>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Flashcards</span>
                            <span className="text-3xl font-black text-teal-400">{report.meta.stats.flashcards}</span>
                        </div>
                    </div>

                    {/* Collisions */}
                    {report.collisions.length > 0 ? (
                        <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl">
                            <h3 className="text-rose-400 font-black uppercase text-sm mb-3 flex items-center gap-2">⚠️ Colisões Detectadas</h3>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {report.collisions.map((c, i) => (
                                    <div key={i} className="text-xs font-mono text-rose-300">
                                        [{c.type}] {c.key}: {c.count} ocorrências
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                         <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
                            <p className="text-emerald-400 text-sm font-bold">Nenhuma colisão de ID detectada.</p>
                        </div>
                    )}

                    {/* Integrity Table */}
                    <div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-widest mb-3">Integridade por Card</h3>
                        <div className="overflow-x-auto rounded-xl border border-white/5">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-white/5 font-bold uppercase text-slate-500">
                                    <tr>
                                        <th className="p-3">Card Ref</th>
                                        <th className="p-3 text-center">Array Count</th>
                                        <th className="p-3 text-center">LawRef Count</th>
                                        <th className="p-3">Amostra (Q1)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 bg-black/20">
                                    {report.integrity.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                            <td className="p-3 font-mono text-sky-300">{item.originalRef}</td>
                                            <td className={`p-3 text-center font-bold ${item.questionsInArray !== item.questionsFoundByLawRef ? 'text-amber-500' : ''}`}>
                                                {item.questionsInArray}
                                            </td>
                                            <td className="p-3 text-center font-bold text-emerald-400">
                                                {item.questionsFoundByLawRef}
                                            </td>
                                            <td className="p-3 text-slate-500 truncate max-w-[150px]">
                                                {item.samples[0]?.id || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Broken Refs */}
                    {report.brokenRefs.length > 0 && (
                        <div>
                            <h3 className="text-amber-500 font-bold uppercase text-xs tracking-widest mb-3">Referências Quebradas</h3>
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 max-h-40 overflow-y-auto space-y-1">
                                {report.brokenRefs.map((b, i) => (
                                    <div key={i} className="text-xs font-mono text-amber-200">
                                        {b.ref} ({b.id}): {b.issue}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <footer className="p-6 border-t border-white/5 bg-slate-800/50 rounded-b-3xl flex justify-end gap-3">
                    <button onClick={handleDownloadJson} className="flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 text-xs uppercase tracking-widest">
                        <DownloadIcon className="w-4 h-4"/> Exportar JSON
                    </button>
                    <button onClick={onClose} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-widest">
                        Fechar
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default BatchReportModal;
