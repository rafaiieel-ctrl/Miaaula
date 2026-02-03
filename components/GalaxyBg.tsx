
import React, { useMemo } from 'react';

interface GalaxyBackgroundProps {
  theme: 'dark' | 'galaxy';
}

const GalaxyBackground: React.FC<GalaxyBackgroundProps> = ({ theme }) => {
  const isGalaxy = theme === 'galaxy';

  const stars = useMemo(() => {
    return Array.from({ length: 120 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.2,
      duration: Math.random() * 5 + 3,
    }));
  }, []);

  if (!isGalaxy) return <div className="fixed inset-0 z-0 bg-[#020617]"></div>;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-[#02010a]">
      {/* Deep Nebulas */}
      <div className="absolute top-[-10%] left-[-5%] w-[90%] h-[90%] bg-sky-900/10 blur-[180px] rounded-full animate-glow-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-indigo-950/20 blur-[200px] rounded-full animate-glow-pulse" style={{ animationDelay: '-3s' }}></div>
      <div className="absolute top-[20%] left-[30%] w-[50%] h-[50%] bg-purple-900/5 blur-[150px] rounded-full opacity-50"></div>

      {/* Static Grain/Noise Overlay */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      {/* Star Field */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            boxShadow: `0 0 ${star.size * 2}px rgba(255,255,255,0.4)`,
            animation: `twinkle ${star.duration}s ease-in-out infinite`,
          }}
        />
      ))}

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default GalaxyBackground;
