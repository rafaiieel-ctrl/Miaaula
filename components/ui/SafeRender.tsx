
import React from 'react';
import PromptText from './PromptText';

interface SafeRenderProps {
    data: any;
    className?: string;
    mode?: 'plain' | 'gap' | 'trapscan';
}

/**
 * Renderiza qualquer tipo de dado (String, Number, Object, Array) de forma legível.
 * Resolve o bug de [object Object] na UI.
 */
export const SafeRender: React.FC<SafeRenderProps> = ({ data, className = '', mode = 'plain' }) => {
    // 1. Null/Undefined -> Não renderiza nada ou traço
    if (data === null || data === undefined) return null;

    // 2. Primitivos -> Renderiza via PromptText (mantém formatação de texto)
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
        // Evita renderizar string vazia ou "undefined" texto
        if (String(data).trim() === '' || String(data) === 'undefined') return null;
        return <PromptText text={String(data)} className={className} mode={mode} />;
    }

    // 3. Arrays -> Lista
    if (Array.isArray(data)) {
        if (data.length === 0) return null;
        return (
            <div className={`flex flex-col gap-2 ${className}`}>
                {data.map((item, idx) => (
                    <div key={idx} className="border-l-2 border-white/10 pl-3 py-1">
                        <SafeRender data={item} mode={mode} />
                    </div>
                ))}
            </div>
        );
    }

    // 4. Objetos -> Lista Key-Value
    if (typeof data === 'object') {
        const entries = Object.entries(data);
        if (entries.length === 0) return null;

        return (
            <div className={`flex flex-col gap-2 w-full ${className}`}>
                {entries.map(([key, value]) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:gap-3 items-start text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                        <span className="font-black text-sky-500 uppercase text-[10px] tracking-widest pt-1 min-w-[24px]">
                            {key}
                        </span>
                        <div className="flex-1 text-slate-300">
                            <SafeRender data={value} mode={mode} />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // 5. Fallback final (JSON)
    return (
        <pre className="text-[10px] bg-black/30 p-2 rounded text-rose-300 overflow-x-auto">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
};

export default SafeRender;
