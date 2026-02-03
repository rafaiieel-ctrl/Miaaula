
import React from 'react';

interface ChartData {
  name: string;
  incorrect: number;
  total: number;
  errorRate: number;
}

interface ErrorFrequencyChartProps {
  data: ChartData[];
}

const ErrorFrequencyChart: React.FC<ErrorFrequencyChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-sm text-bunker-500 dark:text-bunker-400">
        Parabéns! Nenhum erro registrado nos tipos de questão.
      </div>
    );
  }

  const maxIncorrect = Math.max(...data.map(d => d.incorrect), 0);

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
      {data.slice(0, 15).map(item => ( // Show top 15
        <div key={item.name} className="flex items-center gap-4 text-sm" title={`${item.incorrect} de ${item.total} questões erradas (${item.errorRate.toFixed(0)}%)`}>
          <span className="w-1/3 truncate text-slate-800 dark:text-slate-200 font-medium" title={item.name}>
            {item.name}
          </span>
          <div className="w-2/3 flex items-center gap-2">
            <div className="flex-grow bg-bunker-200 dark:bg-bunker-800 rounded-full h-5">
              <div
                className="bg-rose-500 h-5 rounded-full flex items-center justify-end px-2 text-white text-xs font-bold transition-all duration-500"
                style={{ width: maxIncorrect > 0 ? `${(item.incorrect / maxIncorrect) * 100}%` : '0%' }}
              >
               {item.incorrect}
              </div>
            </div>
            <span className="w-16 text-right font-semibold text-rose-500">{item.errorRate.toFixed(0)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ErrorFrequencyChart;
