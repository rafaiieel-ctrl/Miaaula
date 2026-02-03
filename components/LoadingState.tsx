import React from 'react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Carregando...', className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 w-full h-full min-h-[50vh] animate-fade-in ${className}`}>
      <div className="relative w-14 h-14 mb-5">
        {/* Background circle */}
        <div className="absolute inset-0 border-4 border-bunker-200 dark:border-bunker-800 rounded-full opacity-50"></div>
        {/* Spinner */}
        <div className="absolute inset-0 border-4 border-sky-500 rounded-full border-t-transparent animate-spin shadow-sm"></div>
        {/* Inner pulsing dot */}
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse shadow-md shadow-sky-500/50"></div>
        </div>
      </div>
      <p className="text-xs font-bold text-bunker-500 dark:text-bunker-400 animate-pulse tracking-[0.2em] uppercase">
        {message}
      </p>
    </div>
  );
};

export default LoadingState;