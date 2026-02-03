import React from 'react';
import { InfoIcon } from './icons';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, onConfirm, title, children, confirmText = 'Continuar' }) => {
  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-dialog-title"
    >
      <div
        className="bg-bunker-50 dark:bg-bunker-950 w-full max-w-md rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/50 sm:mx-0 sm:h-10 sm:w-10">
              <div className="text-sky-600 dark:text-sky-400">
                <InfoIcon />
              </div>
            </div>
            <div className="mt-0 text-left flex-1">
              <h3 className="text-lg font-semibold leading-6 text-slate-900 dark:text-white" id="info-dialog-title">
                {title}
              </h3>
              <div className="mt-2 text-sm text-bunker-600 dark:text-bunker-300">
                {children}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-bunker-100 dark:bg-bunker-900 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 rounded-b-lg">
          <button
            type="button"
            className="w-full sm:w-auto justify-center rounded-md bg-bunker-200 dark:bg-bunker-700 px-4 py-2 text-sm font-semibold text-bunker-800 dark:text-bunker-200 hover:bg-bunker-300 dark:hover:bg-bunker-600 transition-colors"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="w-full sm:w-auto justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
