
import React from 'react';
import { Question } from '../../types';
import { BoltIcon } from '../icons';

interface ErrorDiagnosticsReportProps {
    questions: Question[];
    className?: string; // Standardize
    title?: string; // Fix for TS2322
}

const ErrorDiagnosticsReport: React.FC<ErrorDiagnosticsReportProps> = ({ questions, title, className }) => {
    return (
        <div className={`p-4 ${className || ''}`} title={title}>
            <h3 className="font-bold mb-4">Diagnóstico de Erros</h3>
            <div className="space-y-2">
                {questions.map(q => (
                    <div key={q.id} className="p-3 bg-white dark:bg-bunker-900 rounded border border-bunker-200 dark:border-bunker-800">
                        <div className="flex justify-between">
                            <span className="font-bold text-xs">{q.questionRef}</span>
                            {/* Wrapper div for title instead of on span wrapping component */}
                            {q.timeSec < 10 && (
                                <div title="Rápida demais (Impulsivo)" className="inline-block">
                                    <BoltIcon className="w-3 h-3 animate-pulse text-amber-500" />
                                </div>
                            )}
                        </div>
                        <p className="text-sm truncate">{q.questionText}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ErrorDiagnosticsReport;
