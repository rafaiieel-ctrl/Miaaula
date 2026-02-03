
import React from 'react';
import { Question } from '../../types';
import { BoltIcon } from '../icons';

interface ErrorsListPanelProps {
    allQuestions: Question[];
    filters: any;
    onReviewQuestion: (q: Question) => void;
    onRetryQuestion: (q: Question) => void;
    className?: string; // Standardize
    title?: string; // Fix for TS2322
}

const ErrorsListPanel: React.FC<ErrorsListPanelProps> = ({ allQuestions, filters, onReviewQuestion, title, className }) => {
    // Basic filter implementation for preview
    const filtered = allQuestions.filter(q => 
        (filters.searchTerm ? q.questionText.includes(filters.searchTerm) : true) &&
        (filters.showOnlyCritical ? q.isCritical : true)
    );

    return (
        <div className={`space-y-2 ${className || ''}`} title={title}>
            {filtered.map(item => (
                <div key={item.id} className="p-3 bg-white dark:bg-bunker-900 rounded border border-bunker-200 dark:border-bunker-800 flex justify-between items-center" onClick={() => onReviewQuestion(item)}>
                    <div className="truncate flex-1">
                        <span className="font-bold text-xs mr-2">{item.questionRef}</span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">{item.questionText}</span>
                    </div>
                    {item.timeSec < 10 && (
                        <div title="Rápida demais" className="shrink-0 ml-2">
                            <BoltIcon className="w-3 h-3 text-amber-500" />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ErrorsListPanel;
