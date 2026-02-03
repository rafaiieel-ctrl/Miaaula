
import React, { useMemo } from 'react';
import { Question, AppSettings } from '../types';
import * as srs from '../services/srsService';
import { LightBulbIcon, ExclamationTriangleIcon, CheckCircleIcon, ClockIcon, ChartBarIcon, SparklesIcon } from './icons';

interface Props {
    questions: Question[];
    settings: AppSettings;
}

const LearningDiagnostics: React.FC<Props> = ({ questions, settings }) => {
    const insights = useMemo(() => {
        // Lógica de análise real aqui (simplificada para o exemplo)
        const allAttempts = questions.flatMap(q => q.attemptHistory);
        if (allAttempts.length < 30) return null;
        return []; // Retornaria insights se houvesse dados suficientes
    }, [questions]);

    if (!insights) {
        return (
            <div className="animate-fade-in mt-12 mb-20 px-2">
                <div className="flex items-center gap-3 mb-6">
                    <SparklesIcon className="text-sky-500 w-4 h-4" />
                    <h3 className="font-black text-xs text-white uppercase tracking-[0.3em]">Diagnóstico de Aprendizado</h3>
                </div>
                
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-8 rounded-[2.5rem] flex items-center gap-6 shadow-2xl">
                    <div className="p-4 rounded-3xl bg-white/5 text-slate-500 shrink-0">
                        <ChartBarIcon className="w-8 h-8" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">COLETANDO DADOS</h4>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-sm">
                            Continue respondendo questões para gerar diagnósticos precisos sobre seu padrão de aprendizado.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return null; // Aqui iria a renderização dos cards reais de diagnóstico
};

export default LearningDiagnostics;
