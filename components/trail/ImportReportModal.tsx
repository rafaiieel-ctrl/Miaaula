
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { ImportReport, ImportCountDetail } from '../../types';
import { CheckCircleIcon, XMarkIcon, ExclamationTriangleIcon, ClipboardDocumentCheckIcon, BoltIcon, DownloadIcon } from '../icons';

interface ImportReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    report: ImportReport | null;
}

const ImportReportModal: React.FC<ImportReportModalProps> = ({ isOpen, onClose, onConfirm, report }) => {
    const [acknowledged, setAcknowledged] = useState(false);
    
    if (!isOpen || !report) return null;
    
    const isSuccess = report.summary.status === 'SUCCESS';
    const isFailure = report.summary.status === 'FAILED';
    
    const downloadLog = () => {
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `import_log_${report.importId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyLog = () => {
        navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        alert("Log copiado!");
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[12000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className={`p-6 border-b border-white/5 flex justify-between items-center ${isSuccess ? 'bg-emerald-900/20' : isFailure ? 'bg-rose-900/20' : 'bg-amber-900/20'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isSuccess ? 'bg-emerald-500 text-white' : isFailure ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>
                            {isSuccess ? <CheckCircleIcon className="w-6 h-6"/> : <ExclamationTriangleIcon className="w-6 h-6"/>}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                                {isSuccess ? 'Importação Validada' : isFailure ? 'Importação Falhou' : 'Atenção Necessária'}
                            </h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                                ID: {report.importId}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-full"><XMarkIcon className="w-5 h-5"/></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Recebidos</span>
                            <span className="text-2xl font-black text-white">{report.summary.totalEntities}</span>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Importados</span>
                            <span className="text-2xl font-black text-emerald-400">{report.summary.importedEntities}</span>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Ignorados</span>
                            <span className={`text-2xl font-black ${report.summary.skippedEntities > 0 ? 'text-rose-400' : 'text-slate-600'}`}>{report.summary.skippedEntities}</span>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Erros</span>
                            <span className={`text-2xl font-black ${report.summary.errorsCount > 0 ? 'text-rose-500' : 'text-slate-600'}`}>{report.summary.errorsCount}</span>
                        </div>
                    </div>

                    {/* Detailed Counts Breakdown */}
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Detalhamento por Tipo</h4>
                        <div className="space-y-2 text-xs font-mono text-slate-300">
                            {Object.entries(report.counts).map(([key, val]) => {
                                const details = val as ImportCountDetail;
                                return (
                                    <div key={key} className="flex justify-between border-b border-white/5 pb-1 last:border-0">
                                        <span className="uppercase">{key}</span>
                                        <span>{details.imported} <span className="text-slate-600">/ {details.received}</span></span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Error Log */}
                    {report.details.length > 0 && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-black text-rose-400 uppercase tracking-widest">Log de Ocorrências</h4>
                                <div className="flex gap-2">
                                     <button onClick={copyLog} className="text-[10px] font-bold text-sky-500 hover:text-white flex items-center gap-1"><ClipboardDocumentCheckIcon className="w-3 h-3"/> Copiar JSON</button>
                                     <button onClick={downloadLog} className="text-[10px] font-bold text-emerald-500 hover:text-white flex items-center gap-1"><DownloadIcon className="w-3 h-3"/> Baixar</button>
                                </div>
                            </div>
                            <div className="bg-black/40 rounded-xl border border-rose-500/20 max-h-60 overflow-y-auto custom-scrollbar">
                                {report.details.map((det, i) => (
                                    <div key={i} className="p-3 border-b border-white/5 last:border-0 text-xs flex gap-3 hover:bg-white/5">
                                        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${det.action === 'ERROR' ? 'bg-rose-500' : det.action === 'SKIPPED' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <span className="font-bold text-white">{det.reasonCode}</span>
                                                <span className="text-[10px] text-slate-500 font-mono">{det.entityType.toUpperCase()}</span>
                                            </div>
                                            <p className="text-slate-300 mt-0.5">{det.message} <span className="text-slate-500 italic">({det.ref})</span></p>
                                            {det.path && (
                                                <p className="text-[9px] text-sky-500 mt-1 font-mono">{det.path} {det.moduleId ? `(Module: ${det.moduleId})` : ''}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {!isSuccess && !isFailure && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                            <input 
                                type="checkbox" 
                                id="ack" 
                                checked={acknowledged} 
                                onChange={e => setAcknowledged(e.target.checked)} 
                                className="mt-1 w-4 h-4 rounded border-amber-500 bg-transparent focus:ring-amber-500 text-amber-500"
                            />
                            <label htmlFor="ack" className="text-xs text-amber-200 cursor-pointer select-none">
                                Estou ciente das inconsistências acima. Desejo importar apenas os itens válidos ({report.summary.importedEntities}).
                            </label>
                        </div>
                    )}
                    
                    {isFailure && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
                            <p className="text-xs text-rose-200 font-bold">Importação bloqueada devido a erros críticos.</p>
                            <p className="text-[10px] text-rose-300 mt-1">Corrija o JSON e tente novamente.</p>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-slate-900/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl border border-white/10 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-white hover:bg-white/5 transition-all">
                        Cancelar
                    </button>
                    {!isFailure && (
                        <button 
                            onClick={onConfirm}
                            disabled={!isSuccess && !acknowledged}
                            className={`px-8 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all 
                                ${!isSuccess && !acknowledged ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'}
                            `}
                        >
                            <BoltIcon className="w-4 h-4" /> 
                            {isSuccess ? 'Confirmar Importação' : 'Importar Parcialmente'}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ImportReportModal;
