
import React, { useMemo } from 'react';

interface GalaxyBackgroundProps {
  theme: 'dark' | 'galaxy';
}

const GalaxyBackground: React.FC<GalaxyBackgroundProps> = ({ theme }) => {
  const isGalaxy = theme === 'galaxy';

  // Gerar estrelas de forma performática via box-shadow
  const starsStyle = useMemo(() => {
    let shadow = '';
    for (let i = 0; i < 200; i++) {
      const x = Math.floor(Math.random() * 2000);
      const y = Math.floor(Math.random() * 2000);
      const opacity = Math.random();
      shadow += `${x}px ${y}px rgba(255, 255, 255, ${opacity})${i === 199 ? '' : ', '}`;
    }
    return { boxShadow: shadow };
  }, []);

  if (!isGalaxy) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none animate-fade-in bg-[#020617]">
      {/* Base Space Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#050b1d] to-[#0a1128]"></div>
      
      {/* Nebulas */}
      <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-900/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full"></div>

      {/* Star Field */}
      <div 
        className="absolute w-[2px] h-[2px] bg-transparent rounded-full animate-twinkle opacity-30"
        style={starsStyle}
      ></div>

      {/* Comets / Shooting Stars */}
      <div className="absolute inset-0 motion-safe:block">
        <div className="comet-container" style={{ top: '10%', left: '100%', animationDelay: '2s' }}></div>
        <div className="comet-container" style={{ top: '40%', left: '100%', animationDelay: '15s' }}></div>
        <div className="comet-container" style={{ top: '70%', left: '100%', animationDelay: '8s' }}></div>
      </div>

      <style>{`
        .comet-container {
          position: absolute;
          width: 4px;
          height: 4px;
          background: #fff;
          border-radius: 50%;
          box-shadow: 0 0 10px 2px #fff, 0 0 20px 4px #3b82f6;
          opacity: 0;
          animation: shooting-star 12s linear infinite;
        }

        .comet-container::after {
          content: '';
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 80px;
          height: 1px;
          background: linear-gradient(to left, rgba(255,255,255,0.8), transparent);
          left: 4px;
        }

        @keyframes shooting-star {
          0% { transform: translateX(0) translateY(0) rotate(-35deg); opacity: 0; }
          5% { opacity: 1; }
          15% { transform: translateX(-120vw) translateY(70vh) rotate(-35deg); opacity: 0; }
          100% { transform: translateX(-120vw) translateY(70vh) rotate(-35deg); opacity: 0; }
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-twinkle {
          animation: twinkle 3s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .comet-container {
            display: none;
          }
          .animate-twinkle {
            animation: none;
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
};

export default GalaxyBackground;
