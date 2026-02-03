
import React from 'react';

export type ClusterTheme = 'blackhole' | 'fullmoon' | 'sun' | 'planet' | 'moon';

interface BlackHoleEffectProps {
    theme?: ClusterTheme;
}

const BlackHoleEffect: React.FC<BlackHoleEffectProps> = ({ theme = 'blackhole' }) => {
    // Specific Render Logic for each theme to ensure realism
    
    if (theme === 'blackhole') {
        return (
            <div className="absolute inset-0 z-0 pointer-events-none">
                {/* 1. The Glow */}
                <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-[60px] animate-pulse-slow"></div>
                
                {/* 2. Accretion Disk (Outer Ring) */}
                <div className="absolute inset-[-15%] rounded-full animate-spin-slow opacity-80"
                    style={{
                        background: 'conic-gradient(from 0deg, transparent 0%, #fb923c 20%, #ef4444 40%, transparent 60%, #a855f7 80%, transparent 100%)',
                        filter: 'blur(20px)',
                    }}
                ></div>
                
                {/* 3. Lensing Ring (Sharp) */}
                <div className="absolute inset-0 rounded-full border-[1px] border-white/20 shadow-[0_0_30px_rgba(255,160,0,0.4)]"></div>

                {/* 4. Event Horizon (The Void) */}
                <div className="absolute inset-2 rounded-full bg-black shadow-[inset_0_0_40px_rgba(0,0,0,1)] z-10 flex items-center justify-center">
                     {/* Photon Ring */}
                     <div className="absolute inset-0 rounded-full border border-orange-500/30 blur-[2px]"></div>
                </div>
            </div>
        );
    }

    if (theme === 'sun') {
        return (
            <div className="absolute inset-0 z-0 pointer-events-none">
                {/* Corona / Atmosphere */}
                <div className="absolute inset-[-20%] rounded-full bg-orange-500/20 blur-[50px] animate-pulse"></div>
                
                {/* Plasma Surface */}
                <div className="absolute inset-0 rounded-full overflow-hidden bg-[#f59e0b]">
                    {/* Simulated Granulation via CSS Gradients */}
                    <div className="absolute inset-[-50%] w-[200%] h-[200%] opacity-60 mix-blend-overlay animate-spin-slow"
                         style={{
                             backgroundImage: 'radial-gradient(circle at 50% 50%, transparent 20%, rgba(0,0,0,0.4) 100%), repeating-conic-gradient(#fbbf24 0deg, #d97706 10deg, #fbbf24 20deg)'
                         }}
                    ></div>
                    {/* Inner Glow */}
                    <div className="absolute inset-0 rounded-full shadow-[inset_0_0_50px_rgba(180,83,9,0.9)]"></div>
                </div>
            </div>
        );
    }

    if (theme === 'fullmoon' || theme === 'moon') {
        return (
            <div className="absolute inset-0 z-0 pointer-events-none">
                {/* Glow */}
                <div className="absolute inset-[-10%] rounded-full bg-slate-200/10 blur-[40px]"></div>

                {/* Surface */}
                <div className="absolute inset-0 rounded-full bg-[#cbd5e1] overflow-hidden shadow-[inset_-20px_-10px_60px_rgba(0,0,0,0.9)]">
                    {/* Craters (Simulated via dots) */}
                    <div className="absolute top-[20%] left-[30%] w-8 h-8 bg-slate-400/50 rounded-full shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]"></div>
                    <div className="absolute bottom-[30%] right-[20%] w-12 h-12 bg-slate-400/40 rounded-full shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]"></div>
                    <div className="absolute top-[50%] left-[10%] w-6 h-6 bg-slate-400/50 rounded-full shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]"></div>
                    
                    {/* Texture Grain */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJyZ2JhKDAsMCwwLDAuMSkiLz48L3N2Zz4=')] opacity-20"></div>
                </div>
            </div>
        );
    }

    if (theme === 'planet') {
        return (
            <div className="absolute inset-0 z-0 pointer-events-none">
                {/* Atmosphere */}
                <div className="absolute inset-[-5%] rounded-full bg-blue-500/20 blur-[30px] border border-blue-400/30"></div>

                {/* Surface (Oceans/Land) */}
                <div className="absolute inset-0 rounded-full bg-[#1e40af] overflow-hidden shadow-[inset_-30px_-10px_70px_rgba(0,0,0,0.95),inset_5px_5px_20px_rgba(255,255,255,0.2)]">
                    {/* Landmasses (Abstract Shapes) */}
                    <div className="absolute top-[10%] left-[20%] w-[80%] h-[60%] bg-[#065f46] rounded-[40%] blur-[20px] opacity-80 mix-blend-overlay transform rotate-12"></div>
                    
                    {/* Clouds */}
                    <div className="absolute top-[30%] left-[-20%] w-[140%] h-[20%] bg-white blur-[15px] opacity-40 rotate-12 animate-float"></div>
                    <div className="absolute bottom-[20%] right-[-10%] w-[100%] h-[15%] bg-white blur-[20px] opacity-30 -rotate-6 animate-float" style={{ animationDelay: '2s' }}></div>
                </div>
            </div>
        );
    }

    return null;
};

export default BlackHoleEffect;
