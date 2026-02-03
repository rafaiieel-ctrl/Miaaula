
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { UploadIcon, DownloadIcon, LogOutIcon, GoogleIcon, CogIcon } from './icons';
import ConfirmationModal from './ConfirmationModal';
import { useSettings } from '../contexts/SettingsContext';
import { backupService } from '../services/backupService'; // Use new service

declare global {
  interface Window {
    gapi: any;
  }
}

const LS_API_KEY = 'revApp_googleApiKey';
const LS_CLIENT_ID = 'revApp_googleClientId';

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'miaaula_backup.json';

interface GoogleDriveSyncProps {
    isOpen: boolean;
    onClose: () => void;
}

const GoogleDriveSync: React.FC<GoogleDriveSyncProps> = ({ isOpen, onClose }) => {
    const { settings } = useSettings();
    const [gapiState, setGapiState] = useState<'uninitialized' | 'loading' | 'ready' | 'error'>('uninitialized');
    const [isConfigured, setIsConfigured] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [clientId, setClientId] = useState('');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [clientIdInput, setClientIdInput] = useState('');
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [operationState, setOperationState] = useState<'idle' | 'saving' | 'loading'>('idle');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
    const [isLoadConfirmOpen, setIsLoadConfirmOpen] = useState(false);
    
    useEffect(() => {
        const savedApiKey = localStorage.getItem(LS_API_KEY);
        const savedClientId = localStorage.getItem(LS_CLIENT_ID);
        if (savedApiKey && savedClientId) {
            setApiKey(savedApiKey);
            setClientId(savedClientId);
            setIsConfigured(true);
        }
    }, []);

    const updateSigninStatus = useCallback((signedIn: boolean) => {
        setIsSignedIn(signedIn);
        if (signedIn) {
            setCurrentUser(window.gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile());
        } else {
            setCurrentUser(null);
        }
    }, []);
    
    const initializeGapiClient = useCallback(() => {
        if (!apiKey || !clientId) {
            setStatusMessage({ type: 'error', text: "API Key e Client ID são necessários." });
            setGapiState('error');
            return;
        }
        setGapiState('loading');
        window.gapi.load('client:auth2', () => {
            window.gapi.client.init({
                apiKey: apiKey,
                clientId: clientId,
                discoveryDocs: DISCOVERY_DOCS,
                scope: SCOPES,
            }).then(() => {
                setGapiState('ready');
                const authInstance = window.gapi.auth2.getAuthInstance();
                authInstance.isSignedIn.listen(updateSigninStatus);
                updateSigninStatus(authInstance.isSignedIn.get());
            }).catch((error: any) => {
                console.error("Error initializing GAPI client:", error);
                let message = "Falha ao inicializar a conexão com o Google.";
                if (error.details?.includes("invalid_client")) {
                    message = "Client ID inválido ou origem não autorizada. Verifique suas credenciais no Google Cloud Console.";
                } else if (error.details?.includes("api_key_not_activated")) {
                    message = "API Key inválida ou a API do Google Drive não está ativa.";
                }
                setStatusMessage({ type: 'error', text: message });
                setGapiState('error');
            });
        });
    }, [apiKey, clientId, updateSigninStatus]);

    useEffect(() => {
        if (isConfigured && isOpen && gapiState === 'uninitialized') {
            const script = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
            const handleScriptLoad = () => {
                if (window.gapi) {
                    initializeGapiClient();
                } else {
                    setGapiState('error');
                    setStatusMessage({ type: 'error', text: 'Falha ao carregar script do Google.' });
                }
            };

            if (window.gapi && window.gapi.client) {
                initializeGapiClient();
            } else if (script) {
                script.addEventListener('load', handleScriptLoad);
            }
        }
    }, [isConfigured, isOpen, gapiState, initializeGapiClient]);

    const handleSaveKeys = () => {
        if (apiKeyInput.trim() && clientIdInput.trim()) {
            const trimmedApiKey = apiKeyInput.trim();
            const trimmedClientId = clientIdInput.trim();
            localStorage.setItem(LS_API_KEY, trimmedApiKey);
            localStorage.setItem(LS_CLIENT_ID, trimmedClientId);
            setApiKey(trimmedApiKey);
            setClientId(trimmedClientId);
            setIsConfigured(true);
            setGapiState('uninitialized');
        } else {
            setStatusMessage({ type: 'error', text: "Por favor, preencha ambos os campos." });
        }
    };

    const handleForgetKeys = () => {
        localStorage.removeItem(LS_API_KEY);
        localStorage.removeItem(LS_CLIENT_ID);
        setIsConfigured(false);
        setApiKey('');
        setClientId('');
        setApiKeyInput('');
        setClientIdInput('');
        setGapiState('uninitialized');
        setIsSignedIn(false);
        setStatusMessage(null);
    };

    const handleAuthClick = () => window.gapi.auth2.getAuthInstance().signIn();
    const handleSignoutClick = () => window.gapi.auth2.getAuthInstance().signOut();

    const findBackupFile = async (): Promise<string | null> => {
        setStatusMessage({ type: 'info', text: 'Procurando arquivo de backup...' });
        const response = await window.gapi.client.drive.files.list({
            q: `name='${BACKUP_FILENAME}' and trashed=false`, spaces: 'drive', fields: 'files(id, name)',
        });
        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        }
        return null;
    };

    const handleSave = async () => {
        setOperationState('saving');
        try {
            // USE BACKUP SERVICE TO CREATE PAYLOAD
            const backupData = await backupService.createFullBackup();
            const content = JSON.stringify(backupData, null, 2);
            
            const blob = new Blob([content], { type: 'application/json' });
            const fileId = await findBackupFile();
            const metadata = { name: BACKUP_FILENAME, mimeType: 'application/json' };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            const path = fileId ? `/upload/drive/v3/files/${fileId}` : '/upload/drive/v3/files';
            const method = fileId ? 'PATCH' : 'POST';
            
            setStatusMessage({ type: 'info', text: fileId ? 'Atualizando backup...' : 'Criando novo backup...' });

            await window.gapi.client.request({ path, method, params: { uploadType: 'multipart' }, body: form });
            
            setStatusMessage({ type: 'success', text: `Dados salvos com sucesso! (${new Date().toLocaleTimeString()})` });
        } catch (error) {
            console.error('Erro ao salvar no Drive:', error);
            setStatusMessage({ type: 'error', text: 'Falha ao salvar. Verifique o console.' });
        } finally {
            setOperationState('idle');
        }
    };

    const confirmLoad = async () => {
        setOperationState('loading');
        try {
            const fileId = await findBackupFile();
            if (!fileId) {
                throw new Error('Nenhum arquivo de backup encontrado no seu Google Drive.');
            }
            setStatusMessage({ type: 'info', text: 'Baixando e verificando dados...' });
            const response = await window.gapi.client.drive.files.get({ fileId, alt: 'media' });
            
            const data = JSON.parse(response.body);
            
            // Validate integrity using backupService
            const sim = backupService.simulateRestore(data);
            if (!sim.valid) {
                throw new Error(`Backup inválido: ${sim.report}`);
            }

            setStatusMessage({ type: 'info', text: 'Dados verificados. Aplicando e reiniciando o app...' });
            
            // Execute restore
            await backupService.restoreFullBackup(data);
            
            // Page reload happens inside restoreFullBackup or we can do it here if needed, 
            // but service handles it cleanly usually. The service reloads.
            
        } catch (error: any) {
            console.error('Erro ao carregar do Drive:', error);
            setStatusMessage({ type: 'error', text: error.message || 'Falha ao carregar os dados.' });
            setOperationState('idle');
        }
    };
    
    if (!isOpen) return null;

    const renderStateContent = () => {
        if (!isConfigured) {
            return (
                <div className="space-y-4">
                    <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                        <strong>Ação necessária:</strong> Para usar a sincronização, você precisa fornecer suas próprias chaves da API do Google. Isso garante que seus dados sejam salvos apenas na sua conta do Google Drive.
                    </p>
                    <details className="text-xs text-bunker-500 dark:text-bunker-400">
                        <summary className="cursor-pointer font-semibold">Como obter as chaves? (Passo a Passo)</summary>
                        <ol className="list-decimal list-inside space-y-1 mt-2 p-2 bg-bunker-100 dark:bg-bunker-800/50 rounded">
                            <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-sky-500 underline">Google Cloud Console</a>.</li>
                            <li>Crie um novo projeto (ex: "Miaaula Sync").</li>
                            <li>No menu, vá para "APIs & Services" &gt; "Library", procure por "Google Drive API" e ative-a.</li>
                            <li>Vá para "APIs & Services" &gt; "Credentials".</li>
                            <li>Clique em "Create Credentials" &gt; "API key". Copie a chave.</li>
                            <li>Clique em "Create Credentials" &gt; "OAuth client ID".</li>
                            <li>Selecione "Web application", dê um nome e em "Authorized JavaScript origins" adicione a URL exata deste app.</li>
                            <li>Copie o "Client ID".</li>
                        </ol>
                    </details>
                    <div>
                        <label className="block text-sm font-medium mb-1">Google API Key</label>
                        <input value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="Cole sua API Key aqui" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Google Client ID</label>
                        <input value={clientIdInput} onChange={e => setClientIdInput(e.target.value)} placeholder="Cole seu Client ID aqui" className="w-full bg-bunker-50 dark:bg-bunker-800 border border-bunker-200 dark:border-bunker-700 rounded-md p-2" />
                    </div>
                    <button onClick={handleSaveKeys} className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-500">Salvar e Iniciar</button>
                </div>
            );
        }

        switch(gapiState) {
            case 'uninitialized':
            case 'loading':
                return <p className="text-sm text-center text-bunker-500 dark:text-bunker-400">Conectando ao Google...</p>;
            case 'error':
                return (
                    <div className="text-center">
                        <p className="text-sm text-rose-500">{statusMessage?.text || 'Ocorreu um erro inesperado.'}</p>
                        <button onClick={handleForgetKeys} className="mt-2 text-xs text-sky-500 underline">Tentar com outras chaves</button>
                    </div>
                );
            case 'ready':
                if (!isSignedIn) {
                    return (
                        <div className="text-center">
                            <p className="text-sm text-bunker-500 dark:text-bunker-400 mb-4">Faça login para salvar e carregar seus dados na nuvem com segurança.</p>
                            <button onClick={handleAuthClick} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-bunker-800 text-bunker-700 dark:text-bunker-200 font-bold py-2 px-6 rounded-lg border border-bunker-200 dark:border-bunker-700 hover:bg-bunker-200/50 dark:hover:bg-bunker-700/50 transition-colors shadow-sm">
                                <GoogleIcon /> Login com Google
                            </button>
                        </div>
                    );
                }
                return (
                     <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-bunker-100 dark:bg-bunker-800/50 rounded-lg">
                            <img src={currentUser?.getImageUrl()} alt="User" className="w-10 h-10 rounded-full" />
                            <div>
                                <p className="font-semibold text-sm">{currentUser?.getName()}</p>
                                <p className="text-xs text-bunker-500 dark:text-bunker-400">{currentUser?.getEmail()}</p>
                            </div>
                            <button onClick={handleSignoutClick} className="ml-auto text-xs font-semibold text-rose-500 hover:underline p-2 flex items-center gap-1"><LogOutIcon /> Sair</button>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={handleSave} disabled={operationState !== 'idle'} className="flex-1 flex items-center justify-center gap-2 bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold py-3 px-4 rounded-lg hover:bg-sky-500/30 transition-colors disabled:opacity-50 disabled:cursor-wait">
                                <UploadIcon /> {operationState === 'saving' ? 'Salvando...' : 'Salvar no Drive'}
                            </button>
                            <button onClick={() => setIsLoadConfirmOpen(true)} disabled={operationState !== 'idle'} className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold py-3 px-4 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-wait">
                                <DownloadIcon /> {operationState === 'loading' ? 'Carregando...' : 'Carregar do Drive'}
                            </button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    }

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-bunker-50 dark:bg-bunker-950 w-full max-w-lg rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-bunker-200 dark:border-b-bunker-800 pb-3">
                        <h3 className="font-bold text-lg">Sincronização com Google Drive</h3>
                        {isConfigured && (
                            <button onClick={handleForgetKeys} className="text-xs text-bunker-500 hover:text-rose-500 flex items-center gap-1" title="Esquecer chaves salvas">
                                <CogIcon /> Alterar Chaves
                            </button>
                        )}
                    </div>
                    {renderStateContent()}
                    {statusMessage && (
                        <div className={`mt-4 p-3 text-sm font-semibold rounded-lg text-center
                            ${statusMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-600' : ''}
                            ${statusMessage.type === 'error' ? 'bg-rose-500/10 text-rose-600' : ''}
                            ${statusMessage.type === 'info' ? 'bg-sky-500/10 text-sky-600' : ''}
                        `}>
                            {statusMessage.text}
                        </div>
                    )}
                </div>
                 <div className="bg-bunker-100 dark:bg-bunker-900 px-6 py-3 flex justify-end rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md bg-bunker-200 dark:bg-bunker-700">Fechar</button>
                 </div>
            </div>
            <ConfirmationModal
                isOpen={isLoadConfirmOpen}
                onClose={() => setIsLoadConfirmOpen(false)}
                onConfirm={confirmLoad}
                title="Carregar Dados do Google Drive?"
            >
                <p>Esta ação irá <strong>substituir todos os dados locais</strong> com os dados salvos no seu Google Drive.</p>
                <p className="font-bold mt-4">Essa operação não pode ser desfeita. Deseja continuar?</p>
            </ConfirmationModal>
        </div>
    );
    
    const modalRoot = document.getElementById('modal-root');
    return modalRoot ? ReactDOM.createPortal(modalContent, modalRoot) : null;
};

export default GoogleDriveSync;
