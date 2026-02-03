
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { StarSolidIcon } from './icons';
import * as srs from '../services/srsService';

const XpNotification: React.FC = () => {
    const { lastXpGain, settings } = useSettings();
    const [visible, setVisible] = useState(false);
    const [currentData, setCurrentData] = useState<{ amount: number, message: string } | null>(null);
    const timerRef = useRef<number | null>(null);

    // Performance Optimization: Check for reduced motion preference
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    useEffect(() => {
        if (lastXpGain) {
            // New XP event detected via ID change
            setCurrentData(lastXpGain);
            setVisible(true);
            
            // Clear any existing timer to restart the duration for the new toast
            if (timerRef.current) clearTimeout(timerRef.current);

            // Play success sound
            if (settings.enableSoundEffects) {
                srs.playAchievementSound();
            }

            // Set TTL (Time To Live)
            timerRef.current = window.setTimeout(() => {
                setVisible(false);
            }, 3000);
        }

        // Cleanup on unmount
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [lastXpGain, settings.enableSoundEffects]);

    // Generate random particles for the explosion effect
    const particles = useMemo(() => {
        if (prefersReducedMotion) return [];

        return Array.from({ length: 12 }, (_, i) => {
            const angle = Math.random() * 360 * (Math.PI / 180);
            const distance = 50 + Math.random() * 60;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;
            const color = ['bg-yellow-400', 'bg-amber-500', 'bg-orange-500', 'bg-red-500', 'bg-sky-400', 'bg-emerald-400'][Math.floor(Math.random() * 6)];
            const delay = Math.random() * 0.15;
            const size = 3 + Math.random() * 3;
            
            return {
                id: i,
                className: `absolute top-1/2 left-1/2 rounded-full ${color}`,
                style: {
                    width: `${size}px`,
                    height: `${size}px`,
                    '--tx': `${tx}px`,
                    '--ty': `${ty}px`,
                    willChange: 'transform, opacity', // Hint for GPU acceleration
                } as React.CSSProperties,
                delay
            };
        });
    }, [prefersReducedMotion]);

    if (!currentData) return null;

    return (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-out transform pointer-events-none ${visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-12 opacity-0 scale-90'}`}>
            <style>
                {`
                    @keyframes particle-explode {
                        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                        100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0); opacity: 0; }
                    }
                `}
            </style>
            
            {/* Explosion Container - Only render if motion is allowed */}
            {!prefersReducedMotion && visible && (
                <div className="absolute inset-0 flex items-center justify-center">
                    {particles.map(p => (
                        <div 
                            key={p.id}
                            className={p.className}
                            style={{
                                ...p.style,
                                animation: `particle-explode 0.6s cubic-bezier(0.25, 1, 0.5, 1) ${p.delay}s forwards`,
                                opacity: 0,
                            }}
                        />
                    ))}
                </div>
            )}

            <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-5 border-2 border-white/20 relative z-10 animate-bounce-subtle backdrop-blur-sm">
                <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm shadow-inner">
                    <StarSolidIcon className="w-8 h-8 text-yellow-200" />
                </div>
                <div className="flex flex-col">
                    <span className="text-3xl font-black leading-none drop-shadow-md text-transparent bg-clip-text bg-gradient-to-b from-white to-orange-100">+{currentData.amount} XP</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-90 text-orange-100 mt-1 whitespace-nowrap">{currentData.message}</span>
                </div>
            </div>
        </div>
    );
};

export default XpNotification;
