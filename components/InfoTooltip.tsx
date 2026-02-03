
import React from 'react';
import { InfoIcon } from './icons';

interface InfoTooltipProps {
  text: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text }) => {
  return (
    <div className="group relative flex items-center">
      <span className="text-bunker-400 dark:text-bunker-500 cursor-help">
        <InfoIcon />
      </span>
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 p-3 bg-slate-800 dark:bg-bunker-900 text-slate-100 text-xs font-normal rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-10 text-left whitespace-normal">
        <p>{text}</p>
      </div>
    </div>
  );
};

export default InfoTooltip;
