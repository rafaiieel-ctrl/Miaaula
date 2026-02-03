
import React from 'react';

export const GlassPanel: React.FC<{ children: React.ReactNode; className?: string; hover?: boolean }> = ({ children, className = '', hover = false }) => (
    <div className={`bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl relative overflow-hidden ${hover ? 'hover:border-white/20 transition-colors' : ''} ${className}`}>
        {children}
    </div>
);

export const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; className?: string }> = ({ icon, title, subtitle, className = '' }) => (
    <div className={`flex items-center gap-3 ${className}`}>
        <div className="p-2.5 bg-white/5 rounded-xl text-sky-400 border border-white/5 shadow-inner">
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
        </div>
        <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight italic leading-none">{title}</h2>
            {subtitle && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{subtitle}</p>}
        </div>
    </div>
);

export const MetricTile: React.FC<{ label: string; value: string | number; tooltip?: string; highlight?: boolean }> = ({ label, value, tooltip, highlight }) => (
    <div className={`relative p-4 rounded-2xl border transition-all group ${highlight ? 'bg-sky-500/10 border-sky-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-2xl font-black ${highlight ? 'text-sky-400' : 'text-white'}`}>{value}</p>
        {tooltip && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-slate-900 text-slate-300 text-xs rounded-lg border border-white/10 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-20 text-center">
                {tooltip}
            </div>
        )}
    </div>
);

export const PrimaryCTA: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }> = ({ icon, children, className = '', disabled, ...props }) => (
    <button 
        disabled={disabled}
        className={`
            relative w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 transition-all duration-300
            ${disabled 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                : 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white hover:shadow-sky-500/30 hover:scale-[1.02] active:scale-[0.98] border border-white/10'
            }
            ${className}
        `}
        {...props}
    >
        {/* Glow Effect */}
        {!disabled && <div className="absolute inset-0 bg-white/20 blur-lg opacity-0 hover:opacity-30 transition-opacity rounded-xl"></div>}
        <span className="relative flex items-center gap-2 z-10">
            {icon && React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
            {children}
        </span>
    </button>
);

export const ModeCard: React.FC<{
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
    description: string;
}> = ({ isActive, onClick, icon, title, description }) => (
    <button 
        onClick={onClick}
        className={`flex-1 p-5 rounded-2xl border-2 text-left transition-all duration-300 relative overflow-hidden group ${
            isActive 
                ? 'bg-indigo-900/20 border-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.15)]' 
                : 'bg-slate-900/40 border-white/5 hover:border-white/10 hover:bg-slate-900/60'
        }`}
    >
        <div className={`mb-3 p-3 rounded-xl w-fit transition-colors ${isActive ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
        </div>
        <h3 className={`font-black text-sm uppercase tracking-wide mb-1 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{title}</h3>
        <p className="text-[10px] leading-relaxed text-slate-500 font-medium group-hover:text-slate-400">{description}</p>
        
        {isActive && <div className="absolute top-0 right-0 w-16 h-16 bg-sky-500/20 blur-[40px] rounded-full pointer-events-none"></div>}
    </button>
);
