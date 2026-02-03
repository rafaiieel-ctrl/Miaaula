
import React, { useEffect, useState } from 'react';
import { Badge } from '../types';
import { TrophyIcon } from './icons';

interface BadgeToastProps {
  badge: Badge | null;
  onClose: () => void;
}

const BadgeToast: React.FC<BadgeToastProps> = ({ badge, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (badge) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 500); // Wait for exit animation
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [badge, onClose]);

  if (!badge) return null;

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[150] transition-all duration-500 transform ${visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-white/20 min-w-[300px]">
            <div className="p-3 bg-white/20 rounded-full animate-bounce">
                <TrophyIcon className="w-8 h-8 text-yellow-300" />
            </div>
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Conquista Desbloqueada</p>
                <h3 className="font-black text-lg">{badge.name}</h3>
                <p className="text-xs opacity-90">{badge.description}</p>
            </div>
        </div>
    </div>
  );
};

export default BadgeToast;
