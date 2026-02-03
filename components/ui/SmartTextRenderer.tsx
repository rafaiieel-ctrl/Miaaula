
import React, { useMemo } from 'react';

interface SmartTextRendererProps {
    text: string;
    mode?: 'question' | 'gap';
    showAnswer?: boolean; // Se true, preenche a lacuna (para feedback)
    className?: string;
}

const GapBlank: React.FC<{ filled?: string; isRevealed?: boolean }> = ({ filled, isRevealed }) => {
    // Estado Revelado (Feedback)
    if (isRevealed && filled) {
        return (
            <span className="inline-flex items-baseline px-2 py-0.5 mx-1 rounded-md bg-emerald-500/20 border-b-2 border-emerald-500 text-emerald-500 font-bold animate-fade-in align-bottom leading-tight">
                {filled}
            </span>
        );
    }
    
    // Estado "Blank" (Lacuna Vazia)
    // Usamos inline-block com min-width fixo em 'em' para escalar com a fonte
    return (
        <span 
            className="inline-block mx-1 align-bottom relative transition-all duration-200"
            style={{ 
                minWidth: '3.5em', 
                height: '1.2em', 
                borderBottom: '2px solid currentColor',
                opacity: 0.3,
                marginBottom: '0.15em' // Ajuste fino para alinhar com baseline do texto
            }}
            role="presentation"
            aria-label="lacuna"
        >
            &nbsp;
        </span>
    );
};

/**
 * SmartTextRenderer
 * 
 * Processa textos de questões e lacunas para exibição segura.
 * - Converte quebras de linha em <br/> ou blocos.
 * - Detecta padrões de lacuna {{...}} e ____.
 * - Garante que palavras longas quebrem corretamente (break-words).
 */
export const SmartTextRenderer: React.FC<SmartTextRendererProps> = ({ text, mode = 'question', showAnswer = false, className = '' }) => {
    
    const parts = useMemo(() => {
        if (!text) return [];

        // 1. Normalização básica
        const normalized = text.replace(/\r\n/g, '\n').trim();

        if (mode === 'gap') {
            // Regex para capturar {{conteudo}} OU sequências de underscores (____)
            const regex = /(\{\{.*?\}\}|_{3,})/g;
            return normalized.split(regex);
        }

        // Modo questão: retornamos array simples, o CSS cuidará das quebras
        return [normalized];
    }, [text, mode]);

    return (
        <div className={`font-medium text-slate-100 leading-relaxed whitespace-pre-wrap break-words ${className}`} style={{ wordBreak: 'break-word' }}>
            {parts.map((part, index) => {
                // Lacuna Formato Novo {{resposta}}
                if (part.startsWith('{{') && part.endsWith('}}')) {
                    const content = part.slice(2, -2).trim();
                    // Se o conteúdo for um placeholder genérico tipo "lacuna" ou "gap", ignoramos no modo não revelado
                    const isGeneric = /^(lacuna|gap|resposta)$/i.test(content);
                    const textToShow = isGeneric ? '' : content;
                    
                    return <GapBlank key={index} filled={textToShow} isRevealed={showAnswer} />;
                }
                
                // Lacuna Legado (_____)
                if (/^_{3,}$/.test(part)) {
                    return <GapBlank key={index} isRevealed={false} />;
                }

                // Texto Normal
                return <span key={index}>{part}</span>;
            })}
        </div>
    );
};

export default SmartTextRenderer;
