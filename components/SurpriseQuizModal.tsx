
import React from 'react';
import ReactDOM from 'react-dom';
import { LightningIcon, FireIcon } from './icons';

interface SurpriseQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

const SurpriseQuizModal: React.FC<SurpriseQuizModalProps> = ({ isOpen, onClose, onAccept }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-1 shadow-2xl max-w-sm w-full transform transition-all scale-100">
        <div className="bg-bunker-950 rounded-[1.4rem] p-6 text-center relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-orange-500/20 to-transparent"></div>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(249,115,22,0.4)] animate-bounce-subtle">
                    <LightningIcon className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-2xl font-extrabold text-white mb-2 leading-tight">
                    Desafio Relâmpago!
                </h2>
                
                <p className="text-orange-200 text-sm mb-6 leading-relaxed">
                    Um minuto de porrada valendo <strong className="text-white">BÔNUS DE PONTOS</strong>. Topa o desafio?
                </p>
                
                <div className="space-y-3">
                    <button 
                        onClick={onAccept}
                        className="w-full bg-white text-orange-600 font-black text-lg py-3 rounded-xl shadow-lg hover:bg-orange-50 hover:scale-105 transition-all flex items-center justify-center gap-2"
                    >
                        <FireIcon className="w-5 h-5" />
                        BORA!
                    </button>
                    <button 
                        onClick={onClose}
                        className="w-full text-slate-400 font-semibold text-sm hover:text-white transition-colors py-2"
                    >
                        Agora não...
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  );
};

export default SurpriseQuizModal;
