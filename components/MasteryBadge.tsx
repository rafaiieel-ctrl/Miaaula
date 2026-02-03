import React from 'react';

type Level = 'Crítico' | 'Baixo' | 'Médio' | 'Bom' | 'Excelente' | 'Indeterminado';

interface MasteryInfo {
  level: Level;
  colorClasses: string;
  textColor: string;
}

const getMasteryInfo = (score: number | undefined | null): MasteryInfo => {
  if (score === undefined || score === null || score < 0) {
    return { level: 'Indeterminado', colorClasses: 'bg-slate-400', textColor: 'text-black' };
  }
  if (score < 40) return { level: 'Crítico', colorClasses: 'bg-red-600', textColor: 'text-white' };
  if (score < 60) return { level: 'Baixo', colorClasses: 'bg-orange-500', textColor: 'text-white' };
  if (score < 75) return { level: 'Médio', colorClasses: 'bg-yellow-500', textColor: 'text-black' };
  if (score < 90) return { level: 'Bom', colorClasses: 'bg-green-500', textColor: 'text-white' };
  return { level: 'Excelente', colorClasses: 'bg-green-700', textColor: 'text-white' };
};

const BarChartIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path clipRule="evenodd" fillRule="evenodd" d="M2.25 2.25a.75.75 0 000 1.5H3v10.5a3 3 0 003 3h1.5a.75.75 0 000-1.5H6a1.5 1.5 0 01-1.5-1.5V3.75h1.5a.75.75 0 000-1.5H2.25zm5.25 4.5a.75.75 0 000 1.5H9v6a3 3 0 003 3h1.5a.75.75 0 000-1.5H12a1.5 1.5 0 01-1.5-1.5V8.25h1.5a.75.75 0 000-1.5H7.5zm5.25 3a.75.75 0 000 1.5H15v1.5a3 3 0 003 3h1.5a.75.75 0 000-1.5H18a1.5 1.5 0 01-1.5-1.5v-1.5h1.5a.75.75 0 000-1.5h-4.5z"></path>
    </svg>
);


export type MasteryBadgeProps = {
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
  labelMode?: 'icon-only' | 'score' | 'level';
  statusFlag?: 'new' | 'learning' | 'review' | 'stable' | 'unknown';
  lastAnswerAt?: string;
  loading?: boolean;
};

const MasteryBadge: React.FC<MasteryBadgeProps> = ({
  score,
  size = 'md',
  labelMode = 'icon-only',
  statusFlag,
  lastAnswerAt,
  loading = false,
}) => {
  const effectiveScore = score;
  const { level, colorClasses, textColor } = getMasteryInfo(effectiveScore);

  const sizeClasses = {
    sm: { container: 'px-2 py-1 text-xs rounded-md', icon: 'h-3 w-3' },
    md: { container: 'px-2.5 py-1.5 text-sm rounded-lg', icon: 'h-4 w-4' },
    lg: { container: 'px-3 py-2 text-base rounded-lg', icon: 'h-5 w-5' },
  }[size];
  
  // Note: 'animate-pulse' is a simple opacity pulse. For a border color pulse, a custom animation would be needed in index.html.
  const statusClasses = {
    review: 'ring-2 ring-offset-1 ring-offset-bunker-50 dark:ring-offset-bunker-950 ring-violet-500 animate-pulse',
    new: 'ring-2 ring-offset-1 ring-offset-bunker-50 dark:ring-offset-bunker-950 ring-sky-400',
    learning: 'ring-2 ring-offset-1 ring-offset-bunker-50 dark:ring-offset-bunker-950 ring-amber-400',
    stable: '',
    unknown: '',
  }[statusFlag || ''] || '';

  const tooltipText = `Domínio: ${level}${effectiveScore !== undefined && effectiveScore !== null ? ` — ${Math.round(effectiveScore)}%` : ''}`;

  if (loading) {
      const loadingSize = {
          sm: 'w-16 h-6',
          md: 'w-20 h-8',
          lg: 'w-24 h-10',
      }[size];
      return <div className={`bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg ${loadingSize}`}></div>;
  }
  
  let showMemoryDecayDot = false;
  if (lastAnswerAt && effectiveScore && effectiveScore >= 60 && effectiveScore < 75) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (new Date(lastAnswerAt) < thirtyDaysAgo) {
          showMemoryDecayDot = true;
      }
  }

  const badgeContent = () => {
    switch (labelMode) {
      case 'score':
        return <span>{effectiveScore !== undefined && effectiveScore !== null ? `${Math.round(effectiveScore)}%` : '—'}</span>;
      case 'level':
        return <span>{level}</span>;
      case 'icon-only':
      default:
        return <BarChartIcon className={`${sizeClasses.icon}`} />;
    }
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center font-semibold gap-1.5 ${sizeClasses.container} ${colorClasses} ${textColor} ${statusClasses}`}
      title={tooltipText}
      aria-label={tooltipText}
    >
      {badgeContent()}
      {showMemoryDecayDot && (
          <span className="absolute -top-1 -right-1 block h-2.5 w-2.5 rounded-full bg-violet-500 ring-2 ring-white dark:ring-bunker-900" title="Revisão sugerida por tempo"></span>
      )}
    </div>
  );
};

export default MasteryBadge;
