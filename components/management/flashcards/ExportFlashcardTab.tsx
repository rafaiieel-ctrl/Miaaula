

import React from 'react';
import { useFlashcardState } from '../../../contexts/FlashcardContext';
import { Flashcard } from '../../../types';

const ExportFlashcardTab: React.FC = () => {
    const flashcards = useFlashcardState();

    const handleExport = () => {
        if (flashcards.length === 0) {
            alert("Nenhum flashcard para exportar.");
            return;
        }

        const sanitize = (str: any): string => String(str ?? '').replace(/;/g, ',').replace(/\r?\n/g, ' ');

        const rows = flashcards.map(fc => {
            const fields: Record<string, any> = {
                FC_REF: fc.id,
                DISCIPLINE: fc.discipline,
                TOPIC: fc.topic,
                BANK: fc.bank,
                SOURCE: fc.source,
                TYPE: fc.type,
                FRONT: fc.front,
                BACK: fc.back,
                COMMENTS: fc.comments,
                TAGS: fc.tags.join(','),
                HOT: fc.hotTopic ? 1 : 0,
                CRIT: fc.isCritical ? 1 : 0,
                FUND: fc.isFundamental ? 1 : 0,
                QUERO_CAIR: fc.queroCair || 0,
            };
            return Object.entries(fields)
                .map(([key, value]) => `${key}:${sanitize(value)}`)
                .join('; ');
        });
        
        const txtContent = rows.join('\n');
        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        const today = new Date().toISOString().slice(0, 10);
        link.setAttribute("download", `miaaula_flashcards_export_${today}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                <h3 className="font-bold text-lg">Exportar Todos os Flashcards</h3>
                <p className="text-sm text-bunker-500 dark:text-bunker-400 mt-2">
                    Faça o backup de todos os seus flashcards em um arquivo de texto (.txt) que pode ser importado de volta no futuro.
                </p>
                 <p className="text-sm text-bunker-500 dark:text-bunker-400 mt-2">
                    Total de flashcards a serem exportados: <strong>{flashcards.length}</strong>
                </p>
                <div className="mt-6">
                    <button 
                        onClick={handleExport}
                        disabled={flashcards.length === 0}
                        className="w-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold py-3 px-4 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Exportar {flashcards.length} Flashcards
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportFlashcardTab;