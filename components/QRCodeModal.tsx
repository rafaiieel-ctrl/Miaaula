
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, url }) => {
  const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const root = document.getElementById('modal-root');
    if (root) {
      setModalRoot(root);
    }
  }, []);

  if (!isOpen || !modalRoot) {
    return null;
  }

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-code-dialog-title"
    >
      <div
        className="bg-bunker-50 dark:bg-bunker-950 w-full max-w-sm rounded-lg shadow-xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-semibold leading-6 text-slate-900 dark:text-white" id="qr-code-dialog-title">
                Test on Mobile
              </h3>
              <button type="button" onClick={onClose} className="p-1 -m-1 text-2xl font-bold leading-none rounded-full hover:bg-bunker-200 dark:hover:bg-bunker-800" aria-label="Fechar modal">&times;</button>
          </div>
          <div className="mt-2 text-sm text-bunker-600 dark:text-bunker-300 space-y-4">
            <p>Scan the QR code with your phone's camera to open this app on your device.</p>
            <div className="bg-white p-4 rounded-lg inline-block">
                <img src={qrCodeUrl} alt="QR Code" width="200" height="200" />
            </div>
            <p className="text-xs text-bunker-400 break-words">{url}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, modalRoot);
};

export default QRCodeModal;