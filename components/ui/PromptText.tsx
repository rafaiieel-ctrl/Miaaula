
import React, { useMemo } from 'react';
import { EvidenceItem } from '../../types';

interface PromptTextProps {
    text: string | object | any;
    mode?: 'plain' | 'gap' | 'trapscan';
    revealExpected?: boolean;
    className?: string;
    highlights?: EvidenceItem[]; // New prop for evidence overlay
}

const GapBlank: React.FC<{ filled?: string; isRevealed?: boolean }> = ({ filled, isRevealed }) => {
    if (isRevealed && filled) {
        return (
            <span className="inline-flex items-baseline px-2 py-0.5 mx-1 rounded-md bg-emerald-500/20 border-b-2 border-emerald-500 text-emerald-500 font-bold animate-fade-in align-bottom leading-tight">
                {filled}
            </span>
        );
    }
    
    return (
        <span 
            className="inline-flex items-end align-baseline mx-1 select-none" 
            role="presentation" 
            aria-label="lacuna"
            style={{ verticalAlign: 'baseline' }}
        >
            <span 
                className="border-b-2 border-current min-w-[72px] px-2 leading-none opacity-30"
                style={{ height: '1em', display: 'inline-block' }}
            >
                &nbsp;
            </span>
        </span>
    );
};

const HighlightedSpan: React.FC<{ text: string, item: EvidenceItem }> = ({ text, item }) => (
    <span 
        className={`relative inline-block border-b-2 font-bold cursor-help group transition-all duration-300 ${item.color} mx-0.5`}
        title={`${item.axis}: ${item.reason}`}
    >
        {text}
        {/* Tooltip */}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 border border-white/10 text-white text-[10px] font-normal rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
            <span className="block font-bold text-xs mb-1 uppercase tracking-wider">{item.axis} ({item.confidence}%)</span>
            {item.reason}
        </span>
    </span>
);

const normalizeTrapscanGuide = (raw: string): string => {
    if (!raw) return '';
    const text = String(raw);
    let normalized = text.replace(/[\r\n]+/g, '; ');
    normalized = normalized.replace(/\s{2,}/g, ' ');
    normalized = normalized.replace(/;\s*;/g, ';');
    return normalized.trim();
};

export const PromptText: React.FC<PromptTextProps> = ({ text, mode = 'plain', revealExpected = false, className = '', highlights = [] }) => {
    
    const content = useMemo(() => {
        if (text === null || text === undefined) return null;
        
        if (typeof text === 'object') {
            return <span className="font-mono text-xs opacity-70 text-amber-300">{JSON.stringify(text, null, 2)}</span>;
        }

        const safeText = String(text);

        if (mode === 'trapscan') {
            const normalized = normalizeTrapscanGuide(safeText);
            return <span className="whitespace-normal break-words leading-relaxed text-slate-300">{normalized}</span>;
        }

        // --- GAP MODE ---
        if (mode === 'gap') {
            const regex = /(\{\{[^}]+\}\}|_{2,}|(?:_ ?){3,}|[\uFF3F]{2,}|\[(?:gap|lacuna)\])/gi;
            const parts = safeText.split(regex);
            
            return parts.map((part, index) => {
                const isGapPattern = regex.test(part) || (part.startsWith('{{') && part.endsWith('}}'));
                if (isGapPattern) {
                    let answer = '';
                    if (part.startsWith('{{')) answer = part.slice(2, -2).trim();
                    return <GapBlank key={index} filled={answer} isRevealed={revealExpected} />;
                }
                return <span key={index}>{part}</span>;
            });
        }

        // --- PLAIN MODE WITH HIGHLIGHTS ---
        if (highlights.length > 0) {
            // Complex splitting logic to handle multiple highlights
            // We use a simple strategy: sort highlights by position (not available here, regex matching instead)
            // Limitations: Overlapping highlights are tricky. We take the first match priority.
            
            // Strategy: Split string by regex of all terms combined
            // Escape special regex chars
            const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = `(${highlights.map(h => escapeRegExp(h.term)).join('|')})`;
            
            if (!pattern || pattern === '()') return <span className="whitespace-pre-wrap break-words leading-relaxed">{safeText}</span>;
            
            const regex = new RegExp(pattern, 'gi');
            const parts = safeText.split(regex);
            
            return parts.map((part, i) => {
                const matchedHighlight = highlights.find(h => h.term.toLowerCase() === part.toLowerCase());
                if (matchedHighlight) {
                    return <HighlightedSpan key={i} text={part} item={matchedHighlight} />;
                }
                return <span key={i}>{part}</span>;
            });
        }

        return <span className="whitespace-pre-wrap break-words leading-relaxed">{safeText}</span>;

    }, [text, mode, revealExpected, highlights]);

    return (
        <div className={`font-medium text-slate-100 no-underline decoration-transparent whitespace-pre-wrap break-words ${className}`}>
            {content}
        </div>
    );
};

export default PromptText;
