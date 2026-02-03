
import React from 'react';
import ReactDOM from 'react-dom';
import { AttemptReport, WrongItemReport } from '../../types';
import { downloadReportAsJson } from '../../services/reportService';
// FIX: Added ChartBarIcon and DownloadIcon to imports
import { XMarkIcon, CheckCircleIcon, XCircleIcon, ClockIcon, BoltIcon, BrainIcon, LightBulbIcon, ExclamationTriangleIcon, ChartBarIcon, DownloadIcon } from '../icons';
import { getText } from '../../utils/i18nText';

interface AttemptDetailModalProps {
    report: AttemptReport;
    onClose: () => void;
    onRetryErrors: (itemIds: string[]) => void;
}

const ErrorItemCard: React.FC<{ item: WrongItemReport }> = ({ item }) => {
    return (
        <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-4 animate-fade-in-up">
            <div className="flex justify-between items-start gap-4">
                <div className="min-w-0 flex-1">
                    <span className="text-[8px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 uppercase tracking-widest mb-2 inline-block">
                        {item.qRef}
                    </span>
                    <p className="text-sm md:text-base text-slate-300 font-medium leading-relaxed italic">
                        "{item.text}"
                    </p>
                </div>
                {item.timeSec && (
                    <div className="flex items-center gap-1 text-slate-500 font-mono text-[10px]">
                        <ClockIcon className="w-3 h-3" /> {item.timeSec}s
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/50"></div>
                    <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest block mb-1">Você marcou ({item.userAnswer})</span>
                    <p className="text-xs text-rose-100 font-bold">{item.userAnswerText}</p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Correta ({item.correctAnswer})</span>
                    <p className="text-xs text-emerald-100 font-bold">{item.correctAnswerText}</p>
                </div>
            </div>

            {(item.explanation || item.wrongDiagnosis) && (
                <div className="space-y-3 pt-2">
                    {item.explanation && (
                        <div className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/10">
                            <div className="flex items-center gap-2 mb-2 text-sky-400">
                                <LightBulbIcon className="w-4 h-4" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Explicação</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{item.explanation}</p>
                        </div>
                    )}
                    {item.wrongDiagnosis && (
                        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                            <div className="flex items-center gap-2 mb-2 text-amber-500">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Diagnóstico do Erro</span>
                            </div>
                            <p className="text-xs text-slate-400 font-bold italic">"{getText(item.wrongDiagnosis)}"</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const AttemptDetailModal: React.FC<AttemptDetailModalProps> = ({ report, onClose, onRetryErrors }) => {
    const errorIds = report.wrongItems.map(i => i.itemId);

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10002] bg-[#02040a]/95 backdrop-blur-xl flex flex-col animate-fade-in text-white" onClick={onClose}>
            <header className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/40 shrink-0">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${report.accuracyPct >= 70 ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' : 'bg-rose-500/20 text-rose-500 border-rose-500/30'} border`}>
                        <ChartBarIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black tracking-tight uppercase italic leading-none">Diagnóstico da Sessão</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                            {new Date(report.finishedAt).toLocaleString('pt-BR')} • {report.totalItems} ITENS
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={(e) => { e.stopPropagation(); downloadReportAsJson(report); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-sky-500/10 text-slate-400 hover:text-sky-400 font-black text-[10px] uppercase tracking-widest rounded-2xl border border-white/5 transition-all active:scale-95"
                    >
                        <DownloadIcon className="w-4 h-4" /> Baixar Relatório
                    </button>
                    <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl hover:text-rose-500 transition-colors border border-white/5">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12" onClick={e => e.stopPropagation()}>
                <div className="max-w-3xl mx-auto space-y-12">
                    {/* KPI Section */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 text-center">
                            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Acurácia</span>
                            <span className={`text-3xl font-black italic ${report.accuracyPct >= 70 ? 'text-emerald-500' : 'text-rose-500'}`}>{report.accuracyPct}%</span>
                        </div>
                        <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 text-center">
                            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Acertos</span>
                            <span className="text-3xl font-black text-emerald-400 italic">{report.totalCorrect}</span>
                        </div>
                        <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 text-center">
                            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Erros</span>
                            <span className="text-3xl font-black text-rose-400 italic">{report.totalWrong}</span>
                        </div>
                        <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 text-center">
                            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Duração</span>
                            <span className="text-3xl font-black text-sky-400 italic">{Math.round(report.durationSec / 60)}m</span>
                        </div>
                    </div>

                    {/* Errors Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-2">
                                <XCircleIcon className="w-4 h-4 text-rose-500" />
                                Lista de Erros
                            </h4>
                            {errorIds.length > 0 && (
                                <button 
                                    onClick={() => onRetryErrors(errorIds)}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest rounded-full shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
                                >
                                    <BoltIcon className="w-3.5 h-3.5" /> Refazer só os erros
                                </button>
                            )}
                        </div>

                        {report.wrongItems.length === 0 ? (
                            <div className="py-20 text-center space-y-4 bg-emerald-500/5 rounded-[3rem] border border-emerald-500/10">
                                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                    <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
                                </div>
                                <p className="text-emerald-500 font-black uppercase tracking-widest text-xs">Performance Perfeita!</p>
                            </div>
                        ) : (
                            <div className="space-y-4 pb-20">
                                {report.wrongItems.map((item, idx) => (
                                    <ErrorItemCard key={`${report.id}_${idx}`} item={item} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <footer className="p-8 border-t border-white/5 bg-slate-950/80 backdrop-blur-md flex justify-center shrink-0 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                <button 
                    onClick={onClose}
                    className="px-12 py-4 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-[0.3em] transition-all"
                >
                    Fechar Diagnóstico
                </button>
            </footer>
        </div>,
        document.getElementById('modal-root') || document.body
    );
};

export default AttemptDetailModal;
