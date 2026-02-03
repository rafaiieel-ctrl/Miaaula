
import React from 'react';
import ReactDOM from 'react-dom';
import { ExclamationTriangleIcon } from './icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, children }) => {
  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex justify-center items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
    >
      <div
        className="bg-bunker-50 dark:bg-bunker-950 w-full max-w-md rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
              <div className="text-red-600 dark:text-red-400">
                <ExclamationTriangleIcon />
              </div>
            </div>
            <div className="mt-0 text-left flex-1">
              <h3 className="text-lg font-semibold leading-6 text-slate-900 dark:text-white" id="confirmation-dialog-title">
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
            className="w-full sm:w-auto justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 transition-colors"
            onClick={handleConfirm}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default ConfirmationModal;
