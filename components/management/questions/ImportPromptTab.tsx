
import React, { useState } from 'react';
import { useQuestionDispatch } from '../../../contexts/QuestionContext';
import { Question } from '../../../types';
import * as srs from '../../../services/srsService';
import { useSettings } from '../../../contexts/SettingsContext';
import { GoogleGenAI, Type } from "@google/genai";

interface ImportPromptTabProps {
  setActiveTab: (tab: 'list') => void;
}

const ImportPromptTab: React.FC<ImportPromptTabProps> = ({ setActiveTab }) => {
    const { addBatchQuestions } = useQuestionDispatch();
    const { settings } = useSettings();
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [importedQuestions, setImportedQuestions] = useState<Omit<Question, 'id'>[]>([]);

    const handleImport = async () => {
        if (!prompt.trim()) {
            setFeedback({ type: 'error', message: 'O campo de texto não pode estar vazio.' });
            return;
        }

        setIsLoading(true);
        setFeedback(null);
        setImportedQuestions([]);

        try {
            // FIX: Use Vite-compatible env var access. process.env crashes in browser.
            const apiKey = (import.meta as any).env.VITE_GOOGLE_API_KEY || '';
            
            if (!apiKey) {
                throw new Error("Chave de API (VITE_GOOGLE_API_KEY) não configurada no ambiente.");
            }

            const ai = new GoogleGenAI({ apiKey });
            
            const responseSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        questionRef: { type: Type.STRING, description: "Um identificador curto e único para a questão (ex: Q1-Pilares)" },
                        questionText: { type: Type.STRING, description: "O enunciado completo da questão." },
                        options: {
                            type: Type.OBJECT,
                            properties: {
                                A: { type: Type.STRING }, B: { type: Type.STRING }, C: { type: Type.STRING }, D: { type: Type.STRING }, E: { type: Type.STRING },
                            },
                            description: "As alternativas da questão. Para Certo/Errado, use C: Certo, E: Errado."
                        },
                        correctAnswer: { type: Type.STRING, description: "A letra da alternativa correta (A, B, C, D, ou E)." },
                        explanation: { type: Type.STRING, description: "Uma explicação concisa sobre o porquê da resposta correta." },
                        subject: { type: Type.STRING, description: "A disciplina principal (ex: Direito Administrativo)." },
                        topic: { type: Type.STRING, description: "O tópico específico dentro da disciplina (ex: Atos Administrativos)." },
                        bank: { type: Type.STRING, description: "A banca examinadora (ex: FGV, FCC), se mencionada." },
                        position: { type: Type.STRING, description: "O cargo ou prova, se mencionado." },
                        questionType: { type: Type.STRING, description: "Classificação do tipo de questão (ex: Literalidade, Caso Concreto)." },
                        hotTopic: { type: Type.BOOLEAN, description: "Se o tópico parece ser de alta incidência ou importância." },
                    },
                    required: ['questionRef', 'questionText', 'options', 'correctAnswer', 'subject']
                }
            };
            
            const response = await ai.models.generateContent({
                model: "gemini-1.5-flash", // Reverting to stable model if preview causes issues
                contents: `
                CRITICAL INSTRUCTION: Do NOT include metadata tags like "P1=...", "P7=...", "GUIA_TRAPSCAN", or "TRAPSCAN_EXIGIDO" inside the text of options (A, B, C, D, E). The options must contain ONLY the alternative text.
                
                Extraia as questões do seguinte texto. Se o texto contiver múltiplas questões, extraia todas. Garanta que o formato de saída seja estritamente o JSON solicitado:\n\n${prompt}`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });
            
            const jsonStr = response.text;
            if (!jsonStr) throw new Error("A IA não retornou nenhum texto.");

            const parsedQuestions = JSON.parse(jsonStr);

            if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
                throw new Error("A IA não conseguiu extrair nenhuma questão válida.");
            }
            
            const today = srs.todayISO();
            const newQuestions = parsedQuestions.map((q: any, index: number) => ({
                ...q,
                sequenceNumber: index,
                createdAt: today,
                lastAttemptDate: '',
                totalAttempts: 0,
                lastWasCorrect: false,
                timeSec: 0,
                selfEvalLevel: 0,
                masteryScore: 0,
                stability: settings.srsV2?.S_default_days ?? 1,
                lastReviewedAt: undefined,
                nextReviewDate: today,
                srsStage: 0,
                correctStreak: 0,
                attemptHistory: [],
                srsVersion: 2,
                // Ensure options object handles C/E logic if needed or defaults
                options: q.options || {},
                questionType: q.questionType || 'Não Definido',
                bank: q.bank || '',
                position: q.position || '',
                topic: q.topic || '',
                area: q.subject, // Default area to subject
                isCritical: false,
                isFundamental: false,
                willFallExam: false,
            }));

            setImportedQuestions(newQuestions);
            setFeedback({ type: 'success', message: `${newQuestions.length} questões foram extraídas com sucesso! Verifique os dados abaixo e confirme para salvar.` });

        } catch (error: any) {
            console.error("Erro na importação com IA:", error);
            setFeedback({ type: 'error', message: `Ocorreu um erro: ${error.message || 'Falha desconhecida'}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmImport = () => {
        if (importedQuestions.length > 0) {
            addBatchQuestions(importedQuestions);
            setFeedback({ type: 'success', message: 'Questões salvas na sua base de dados!' });
            setImportedQuestions([]);
            setPrompt('');
            setTimeout(() => {
                setActiveTab('list');
            }, 1500);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="p-6 bg-bunker-100 dark:bg-bunker-900 rounded-lg">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="text-sky-500">✨</span> Importar com Inteligência Artificial
                </h3>
                <p className="text-sm text-bunker-500 dark:text-bunker-400 mt-2">
                    Cole o texto de um PDF, página da web ou material de estudo. A IA irá analisar o conteúdo, identificar as questões, alternativas, gabarito e comentários, e formatá-las automaticamente para você.
                </p>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={12}
                    placeholder="Cole o texto contendo as questões aqui... Ex: '1. Qual a capital do Brasil? a) Rio b) Brasilia ... Gabarito: B'"
                    className="w-full font-mono text-sm mt-4 bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"
                    disabled={isLoading}
                />
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={handleImport} 
                        disabled={isLoading || !prompt.trim()} 
                        className="bg-sky-500 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-sky-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-wait disabled:transform-none"
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processando...
                            </span>
                        ) : 'Extrair Questões'}
                    </button>
                </div>
            </div>
            
            {feedback && (
                <div className={`${feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'} border p-4 rounded-lg flex flex-col md:flex-row gap-4 justify-between items-center animate-fade-in`}>
                    <p className="font-semibold text-center md:text-left">{feedback.message}</p>
                    {importedQuestions.length > 0 && (
                        <button onClick={handleConfirmImport} className="bg-emerald-500 text-white font-bold py-2 px-6 rounded-lg shadow hover:bg-emerald-600 transition-colors">
                            Confirmar e Salvar
                        </button>
                    )}
                </div>
            )}

            {importedQuestions.length > 0 && (
                <div className="space-y-3 animate-fade-in">
                    <h4 className="font-bold text-bunker-600 dark:text-bunker-300">Pré-visualização ({importedQuestions.length}):</h4>
                    {importedQuestions.map((q, idx) => (
                        <div key={idx} className="p-4 bg-bunker-100 dark:bg-bunker-900 border border-bunker-200 dark:border-bunker-700 rounded-lg text-sm">
                            <div className="flex justify-between mb-1">
                                <span className="font-bold text-sky-500">{q.questionRef}</span>
                                <span className="text-xs bg-bunker-200 dark:bg-bunker-800 px-2 py-0.5 rounded">{q.subject}</span>
                            </div>
                            <p className="mb-2">{q.questionText.substring(0, 150)}{q.questionText.length > 150 ? '...' : ''}</p>
                            <div className="text-xs text-emerald-500 font-semibold">Gabarito: {q.correctAnswer}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ImportPromptTab;
