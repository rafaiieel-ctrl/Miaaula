
import React from 'react';
import { useQuestionState } from '../../../contexts/QuestionContext';

const ExportTab: React.FC = () => {
    const questions = useQuestionState();

    const handleExport = () => {
        if (questions.length === 0) {
            alert("Nenhuma questão para exportar.");
            return;
        }
        const header = "DATE;BANK;POSITION;SUBJECT;TOPIC;QUESTION_REF;QUESTION_TEXT;ALT_A;ALT_B;ALT_C;ALT_D;ALT_E;EXPLANATION;YOUR_ANSWER;CORRECT_ANSWER;ISCORRECT;TIME_SEC;LEVEL;HOT_TOPIC;QUESTION_TYPE";
        const sanitize = (str: any): string => String(str ?? '').replace(/;/g, ',').replace(/\r?\n/g, ' ');
        const rows = questions.map(q => [
            sanitize(q.lastAttemptDate), sanitize(q.bank), sanitize(q.position), sanitize(q.subject), sanitize(q.topic), sanitize(q.questionRef), sanitize(q.questionText),
            sanitize(q.options.A), sanitize(q.options.B), sanitize(q.options.C), sanitize(q.options.D), sanitize(q.options.E), sanitize(q.explanation),
            sanitize(q.yourAnswer), sanitize(q.correctAnswer), q.lastWasCorrect ? "0" : "1", q.timeSec, q.selfEvalLevel, q.hotTopic ? "1" : "0", sanitize(q.questionType)
        ].join(';'));
        
        const csvContent = [header, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        const today = new Date().toISOString().slice(0, 10);
        link.setAttribute("download", `miaaula_questoes_export_${today}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                <h3 className="font-bold text-lg">Exportar Todas as Questões</h3>
                <p className="text-sm text-bunker-500 dark:text-bunker-400 mt-2">
                    Faça o backup de todas as suas questões em um arquivo de texto (.txt) que pode ser importado de volta no futuro.
                </p>
                 <p className="text-sm text-bunker-500 dark:text-bunker-400 mt-2">
                    Total de questões a serem exportadas: <strong>{questions.length}</strong>
                </p>
                <div className="mt-6">
                    <button 
                        onClick={handleExport}
                        disabled={questions.length === 0}
                        className="w-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold py-3 px-4 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Exportar {questions.length} Questões
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportTab;
