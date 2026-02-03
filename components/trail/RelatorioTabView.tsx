
import React, { useState, useEffect, useMemo } from 'react';
import { AttemptReport } from '../../types';
import { listReportsByLesson, downloadReportAsJson } from '../../services/reportService';
import { ClockIcon, CheckCircleIcon, XMarkIcon, ChevronRightIcon, BrainIcon, CalendarIcon, DownloadIcon } from '../icons';
import AttemptDetailModal from './AttemptDetailModal';
import LoadingState from '../LoadingState';

interface RelatorioTabViewProps {
    lessonId: string;
    onRetryErrors: (itemIds: string[]) => void;
}

const RelatorioTabView: React.FC<RelatorioTabViewProps> = ({ lessonId, onRetryErrors }) => {
    const [reports, setReports] = useState<AttemptReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<AttemptReport | null>(null);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const data = await listReportsByLesson(lessonId);
            setReports(data);
            setIsLoading(false);
        };
        load();
    }, [lessonId]);

    const stats = useMemo(() => {
        if (reports.length === 0) return null;
        const totalAccuracy = reports.reduce((acc, r) => acc + r.accuracyPct, 0);
        const totalItems = reports.reduce((acc, r) => acc + r.totalItems, 0);
        return {
            avgAccuracy: Math.round(totalAccuracy / reports.length),
            totalItems
        };
    }, [reports]);

    const handleDownload = (e: React.MouseEvent, report: AttemptReport) => {
        e.stopPropagation();
        downloadReportAsJson(report);
    };

    if (isLoading) return <LoadingState message="Carregando histórico..." />;

    if (reports.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in space-y-4">
                <div className="p-6 bg-white/5 rounded-full text-slate-600">
                    <CalendarIcon className="w-12 h-12 opacity-20" />
                </div>
                <div>
                    <h4 className="text-xl font-black text-white tracking-tighter">Nenhum relatório ainda</h4>
                    <p className="text-sm text-slate-500 font-medium">Complete uma bateria para ver o diagnóstico de erros.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header Stats */}
            {stats && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                        <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Acurácia Média</span>
                        <span className={`text-2xl font-black italic ${stats.avgAccuracy >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {stats.avgAccuracy}%
                        </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                        <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Respondido</span>
                        <span className="text-2xl font-black text-sky-400 italic">
                            {stats.totalItems}
                        </span>
                    </div>
                </div>
            )}

            {/* List of Attempts */}
            <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-1">Histórico de Sessões</h3>
                {reports.map((report) => (
                    <button
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="w-full p-5 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.05] transition-all flex items-center justify-between group active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${report.accuracyPct >= 70 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                <BrainIcon className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                    {new Date(report.finishedAt).toLocaleDateString('pt-BR')} • {new Date(report.finishedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <h4 className="font-black text-white text-base tracking-tight uppercase">
                                    {report.practiceType} • {report.totalItems} Itens
                                </h4>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className={`text-[10px] font-black uppercase ${report.accuracyPct >= 70 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {report.accuracyPct}% ACERTO
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-bold">•</span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                        {Math.round(report.durationSec / 60)} MIN
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div 
                                onClick={(e) => handleDownload(e, report)}
                                className="p-3 rounded-2xl bg-white/5 text-slate-400 hover:text-sky-400 hover:bg-sky-400/10 border border-white/5 transition-all"
                                title="Baixar JSON"
                            >
                                <DownloadIcon className="w-4 h-4" />
                            </div>
                            <div className="p-2 rounded-full border border-white/5 text-slate-600 group-hover:text-sky-500 group-hover:border-sky-500/30 transition-all">
                                <ChevronRightIcon className="w-5 h-5" />
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {selectedReport && (
                <AttemptDetailModal 
                    report={selectedReport} 
                    onClose={() => setSelectedReport(null)} 
                    onRetryErrors={(ids) => {
                        setSelectedReport(null);
                        onRetryErrors(ids);
                    }}
                />
            )}
        </div>
    );
};

export default RelatorioTabView;
