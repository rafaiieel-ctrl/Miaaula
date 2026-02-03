
import React, { useState, useRef, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useQuestionState, useQuestionDispatch } from '../contexts/QuestionContext';
import { useFlashcardState, useFlashcardDispatch } from '../contexts/FlashcardContext';
import { useLiteralnessState } from '../contexts/LiteralnessContext';
import { 
    MobileIcon, BellIcon, RefreshIcon, 
    MoonIcon, SparklesIcon, DownloadIcon, UploadIcon, 
    CheckCircleIcon, TrashIcon, ChevronRightIcon, 
    LockClosedIcon, CloudIcon, CogIcon, ChartBarIcon,
    ExclamationTriangleIcon, ArrowPathIcon, BrainIcon,
    ScaleIcon, ChevronDownIcon, ListBulletIcon,
    SunIcon, BoltIcon, PencilIcon, BookOpenIcon, WrenchScrewdriverIcon, EyeIcon
} from '../components/icons';
import ConfirmationModal from '../components/ConfirmationModal';
import AuditView from '../components/AuditView';
import BatchReportModal from '../components/BatchReportModal';
import BlackboxReportModal from '../components/BlackboxReportModal'; 
import { loadData, saveData, factoryReset } from '../services/storage'; 
import { backupService } from '../services/backupService'; // NEW IMPORT
import * as srs from '../services/srsService';
import * as doctor from '../services/leiSecaDoctor';
import { normalizeDiscipline } from '../services/taxonomyService';

interface SettingsViewProps {
  onOpenQrModal: () => void;
  onOpenSyncModal: () => void;
}

const SettingsSection: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-8">
        {title && <h3 className="text-xs font-bold text-bunker-400 dark:text-bunker-50 uppercase tracking-widest mb-3 ml-4">{title}</h3>}
        <div className="bg-transparent dark:bg-bunker-900 rounded-2xl overflow-hidden shadow-sm border border-bunker-100 dark:border-bunker-800 text-slate-900 dark:text-white">
            {children}
        </div>
    </div>
);

const SettingsItem: React.FC<{ 
    icon: React.ReactNode; 
    label: string; 
    subLabel?: string; 
    onClick?: () => void;
    action?: React.ReactNode;
    isDestructive?: boolean;
    hasChevron?: boolean;
}> = ({ icon, label, subLabel, onClick, action, isDestructive, hasChevron = false }) => (
    <div 
        onClick={onClick}
        className={`
            group flex items-center justify-between p-4 bg-transparent dark:bg-bunker-900 
            border-b border-bunker-100 dark:border-bunker-800 last:border-b-0 
            transition-colors ${onClick ? 'cursor-pointer hover:bg-bunker-50 dark:hover:bg-bunker-800/50' : ''}
        `}
    >
        <div className="flex items-center gap-4">
            <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center shrink-0 
                ${isDestructive 
                    ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500' 
                    : 'bg-bunker-50 dark:bg-bunker-800 text-bunker-500 dark:text-bunker-400 group-hover:text-sky-500 group-hover:bg-sky-50 dark:group-hover:bg-sky-900/20 transition-colors'
                }
            `}>
                {React.cloneElement(icon as React.ReactElement<any>, { className: "w-5 h-5" })}
            </div>
            <div>
                <p className={`font-semibold text-sm ${isDestructive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-200'}`}>{label}</p>
                {subLabel && <p className="text-xs text-slate-500 dark:text-bunker-500 mt-0.5">{subLabel}</p>}
            </div>
        </div>
        <div className="flex items-center gap-2">
            {action}
            {hasChevron && <ChevronRightIcon className="w-4 h-4 text-bunker-300 dark:text-bunker-600" />}
        </div>
    </div>
);

const ThemeCard: React.FC<{
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
    previewColors: string;
}> = ({ label, icon, active, onClick, previewColors }) => (
    <button 
        onClick={onClick}
        className={`flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
            active 
                ? 'bg-transparent dark:bg-bunker-800 border-sky-500 shadow-md ring-1 ring-sky-500/50 text-slate-950 dark:text-white' 
                : 'bg-bunker-50 dark:bg-bunker-900 border-transparent hover:border-bunker-200 dark:hover:border-bunker-700 text-bunker-500 dark:text-bunker-400'
        }`}
    >
        <div className={`w-full aspect-video rounded-lg mb-1 shadow-sm ${previewColors}`}></div>
        <div className={`flex items-center gap-2 ${active ? 'text-sky-600 dark:text-sky-400' : 'text-bunker-500 dark:text-bunker-400'}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { className: "w-4 h-4" })}
            <span className="text-xs font-bold">{label}</span>
        </div>
    </button>
);

const SettingsView: React.FC<SettingsViewProps> = ({ onOpenQrModal, onOpenSyncModal }) => {
  const { settings, updateSettings, systemLogs, clearLogs } = useSettings();
  const questions = useQuestionState();
  const flashcards = useFlashcardState();
  const cards = useLiteralnessState();
  const { updateBatchQuestions } = useQuestionDispatch();
  const { updateBatchFlashcards } = useFlashcardDispatch();
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  
  const [batchReport, setBatchReport] = useState<any>(null);
  const [isBlackboxOpen, setIsBlackboxOpen] = useState(false);

  const handleHistoryToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ showHistoryAfterAnswer: e.target.checked });
  };

  const handleBlackHoleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ enableBlackHoleEffect: e.target.checked });
  };
  
  // NEW: Robust Backup
  const handleDownloadBackup = async () => {
      setIsExporting(true);
      try {
          const backupData = await backupService.createFullBackup();
          const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url; 
          link.download = `miaaula_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(link); 
          link.click(); 
          document.body.removeChild(link);
      } catch (e) { 
          alert("Erro ao gerar backup completo."); 
          console.error(e);
      } finally { 
          setIsExporting(false); 
      }
  };

  const handleRunSelfTest = async () => {
      if (window.confirm("Isso irá gerar um backup em memória, testar a integridade dele e verificar se ele seria restaurado corretamente. Nenhum dado será apagado. Continuar?")) {
          const report = await backupService.runSelfDiagnostics();
          alert(report);
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const content = event.target?.result as string; 
              const parsed = JSON.parse(content);
              
              // Validate using the Service logic instead of ad-hoc
              const sim = backupService.simulateRestore(parsed);
              
              setImportPreview({ 
                  meta: parsed.meta || { version: 'Legacy/Desconhecido' }, 
                  stats: sim.stats || {},
                  valid: sim.valid,
                  report: sim.report,
                  data: parsed 
              });
          } catch (err) { alert("Arquivo inválido."); }
      };
      reader.readAsText(file);
  };

  // NEW: Robust Restore
  const executeRestore = async () => {
      if (!importPreview || !importPreview.valid) return;
      try {
          const result = await backupService.restoreFullBackup(importPreview.data);
          alert(result.message);
          window.location.reload();
      } catch (e: any) { 
          alert(`Erro crítico no restore: ${e.message}`); 
      }
  };
  
  const handleFactoryReset = async () => {
      await factoryReset();
      window.location.reload();
  };
  
  const handleNormalizeDisciplines = () => {
      if (!window.confirm("Isso unificará disciplinas semelhantes (ex: 'CTN' -> 'DIREITO TRIBUTÁRIO'). Deseja continuar?")) return;
      const updatedQuestions = [];
      for (const q of questions) {
          const normalized = normalizeDiscipline(q.subject);
          if (normalized !== q.subject) updatedQuestions.push({ id: q.id, subject: normalized });
      }
      const updatedFlashcards = [];
      for (const fc of flashcards) {
          const normalized = normalizeDiscipline(fc.discipline);
          if (normalized !== fc.discipline) updatedFlashcards.push({ id: fc.id, discipline: normalized });
      }
      if (updatedQuestions.length > 0) updateBatchQuestions(updatedQuestions);
      if (updatedFlashcards.length > 0) updateBatchFlashcards(updatedFlashcards);
      alert(`Migração concluída!\nQuestões atualizadas: ${updatedQuestions.length}\nFlashcards atualizados: ${updatedFlashcards.length}`);
  };

  const handleBatchMigration = async () => {
      if (!window.confirm("Esta operação irá reprocessar todas as questões usando o texto original para recuperar campos ausentes (como Explicação Storytelling, Perfis de Distratores, etc). Isso pode levar alguns instantes. Deseja continuar?")) return;
      setIsMigrating(true);
      try {
          const result = await doctor.runBatchMigration(questions, cards);
          if (result.success) {
               alert(`Migração Completa!\n\nQuestões Reparadas: ${result.stats.migrated}\nSem fonte original: ${result.stats.noRawData}\nTotal Processado: ${result.stats.total}`);
               window.location.reload();
          } else {
               alert("Erro na migração. Verifique os logs.");
          }
      } catch (e: any) {
          alert(`Erro crítico: ${e.message}`);
      } finally {
          setIsMigrating(false);
      }
  };

  const handleShowBatchReport = async () => {
      if (!settings.lastImportBatchId) {
          alert("Nenhum lote importado recentemente.");
          return;
      }
      const report = await doctor.generateBatchReport(settings.lastImportBatchId);
      setBatchReport(report);
  };
  
  const handleDumpDatabase = async () => {
      if (window.confirm("Isso fará o download de todos os seus dados em JSON. Continuar?")) {
          await doctor.dumpDatabase();
      }
  };

  if (showAudit) return <div className="max-w-4xl mx-auto animate-fade-in"><button onClick={() => setShowAudit(false)} className="mb-4 text-sm font-bold text-sky-500 hover:underline">&larr; Voltar</button><AuditView /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Ajustes</h2>
        <p className="text-bunker-500 dark:text-bunker-400 font-medium">Preferências e Gestão de Dados</p>
      </div>

      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
          <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner"><CloudIcon className="w-8 h-8 text-white" /></div>
                  <div><h3 className="font-bold text-lg">Sincronização Nuvem</h3><p className="text-indigo-100 text-xs opacity-90">Google Drive & bull; Backup Seguro</p></div>
              </div>
              <button onClick={onOpenSyncModal} className="px-5 py-2.5 bg-white text-indigo-700 font-bold rounded-xl shadow-lg hover:bg-indigo-50 transition-colors text-sm active:scale-95">Configurar</button>
          </div>
      </div>

      <SettingsSection title="Experiência de Estudo">
          {/* ... (Existing Toggles) ... */}
          <div className="p-4 flex items-center justify-between bg-transparent dark:bg-bunker-900 border-b border-bunker-100 dark:border-bunker-800">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-50 dark:bg-sky-900/20 text-sky-500"><ChartBarIcon className="w-5 h-5" /></div>
                <div>
                    <p className="font-semibold text-sm text-slate-950 dark:text-slate-200">Relatório Técnico Detalhado</p>
                    <p className="text-xs text-slate-500 dark:text-bunker-500 mt-0.5">Exibir diagnóstico de SRS após cada questão.</p>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.showHistoryAfterAnswer} onChange={handleHistoryToggle} className="sr-only peer" />
              <div className="w-11 h-6 bg-bunker-200 dark:bg-bunker-700 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
         </div>
         <div className="p-4 flex items-center justify-between bg-transparent dark:bg-bunker-900 border-b border-bunker-100 dark:border-bunker-800">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 text-amber-500"><PencilIcon className="w-5 h-5" /></div>
                <div>
                    <p className="font-semibold text-sm text-slate-950 dark:text-slate-200">Anotações após Resposta</p>
                    <p className="text-xs text-slate-500 dark:text-bunker-500 mt-0.5">Mostrar notas pessoais logo após o gabarito.</p>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.showNotesAfterAnswer} onChange={(e) => updateSettings({ showNotesAfterAnswer: e.target.checked })} className="sr-only peer" />
              <div className="w-11 h-6 bg-bunker-200 dark:bg-bunker-700 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
         </div>
         <div className="p-4 flex items-center justify-between bg-transparent dark:bg-bunker-900">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-50 dark:bg-violet-900/20 text-violet-500"><SunIcon className="w-5 h-5" /></div>
                <div>
                    <p className="font-semibold text-sm text-slate-950 dark:text-slate-200">Efeito Buraco Negro</p>
                    <p className="text-xs text-slate-500 dark:text-bunker-500 mt-0.5">Animação sutil no dashboard "Hoje".</p>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.enableBlackHoleEffect ?? false} onChange={handleBlackHoleToggle} className="sr-only peer" />
              <div className="w-11 h-6 bg-bunker-200 dark:bg-bunker-700 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
         </div>
      </SettingsSection>

      <SettingsSection title="Aparência">
          <div className="p-2 flex gap-2">
            <ThemeCard label="Escuro" icon={<MoonIcon />} active={settings.appTheme === 'dark'} onClick={() => updateSettings({ appTheme: 'dark' })} previewColors="bg-slate-900 border border-slate-700" />
            <ThemeCard label="Galáxia" icon={<SparklesIcon />} active={settings.appTheme === 'galaxy'} onClick={() => updateSettings({ appTheme: 'galaxy' })} previewColors="bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950 border border-indigo-900" />
          </div>
      </SettingsSection>

      <SettingsSection title="Seus Dados">
          <SettingsItem icon={isExporting ? <ArrowPathIcon className="w-5 h-5 animate-spin text-sky-500"/> : <DownloadIcon />} label="Exportar Backup Completo" subLabel="Inclui Lei Seca e Progresso" onClick={handleDownloadBackup}/>
          <SettingsItem icon={<UploadIcon />} label="Restaurar Backup" subLabel="Substitui todos os dados atuais" onClick={() => fileInputRef.current?.click()}/>
          <SettingsItem icon={<BoltIcon />} label="Normalizar Disciplinas" subLabel="Corrigir duplicatas (ex: CTN -> Direito Tributário)" onClick={handleNormalizeDisciplines} />
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".json" className="hidden"/>
      </SettingsSection>

      <SettingsSection title="Diagnóstico e Logs">
          <SettingsItem icon={<ScaleIcon />} label="Relatório do Último Lote (Lei Seca)" subLabel="Análise técnica de integridade" onClick={handleShowBatchReport} hasChevron />
          <SettingsItem icon={<EyeIcon />} label="Blackbox Trace (Audit Log)" subLabel="Visualizar logs de eventos do sistema" onClick={() => setIsBlackboxOpen(true)} hasChevron />
          <SettingsItem icon={<CheckCircleIcon />} label="Diagnóstico de Backup (Simulação)" subLabel="Testar integridade da extração/restauração" onClick={handleRunSelfTest} />
          <SettingsItem icon={<DownloadIcon />} label="Dump do Banco (JSON)" subLabel="Exportação bruta para debug" onClick={handleDumpDatabase} />
          <SettingsItem icon={isMigrating ? <ArrowPathIcon className="w-5 h-5 animate-spin text-emerald-500" /> : <WrenchScrewdriverIcon />} label="Atualizar Banco Antigo (Migração)" subLabel="Recupera campos faltantes de imports antigos" onClick={handleBatchMigration} />
          <SettingsItem icon={<ChartBarIcon />} label="Auditoria" onClick={() => setShowAudit(true)} hasChevron />
          <SettingsItem 
            icon={<ListBulletIcon />} 
            label="Logs do Sistema" 
            subLabel={`${(systemLogs as any[] | undefined)?.length || 0} eventos`} 
            onClick={() => setShowLogs(!showLogs)} 
            action={<span className="text-[10px] font-black">{showLogs ? 'OCULTAR' : 'VER'}</span>} 
          />
          {showLogs && (
              <div className="p-4 border-t border-bunker-100 dark:border-white/5 bg-bunker-50/50 dark:bg-bunker-950/30">
                  {((systemLogs as any[]) || []).length === 0 ? (
                      <p className="text-sm text-slate-700 dark:text-bunker-500 font-medium">Nenhum log registrado.</p>
                  ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar mb-4">
                          {((systemLogs as any[]) || []).map((log: any) => (
                              <div key={log.id} className="text-[10px] font-mono p-2 bg-transparent dark:bg-bunker-800 rounded border border-bunker-200 dark:border-bunker-700">
                                  <span className="text-slate-500 dark:text-slate-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                  <span className={`ml-2 font-bold ${log.type === 'error' ? 'text-rose-600' : 'text-sky-600'}`}>{log.type?.toUpperCase()}:</span>
                                  <span className="ml-2 text-slate-800 dark:text-slate-300">{log.message}</span>
                              </div>
                          ))}
                      </div>
                  )}
                  <button onClick={clearLogs} className="text-xs font-black text-rose-600 hover:underline">Limpar Logs</button>
              </div>
          )}
      </SettingsSection>

      <div className="flex justify-center mt-12 gap-3">
          <button onClick={() => setIsConfirmModalOpen(true)} className="text-rose-600 dark:text-rose-500 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all border border-rose-500/10">
              <TrashIcon className="w-4 h-4" /> Factory Reset (Zerar Tudo)
          </button>
      </div>

      {importPreview && (
          <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-transparent dark:bg-bunker-950 w-full max-w-md rounded-2xl shadow-2xl p-6 text-center border border-white/10">
                  <UploadIcon className="w-16 h-16 text-sky-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2 text-slate-950 dark:text-white">Confirmar Restauração?</h3>
                  <div className="bg-white/5 p-3 rounded-xl mb-4 text-xs text-left space-y-1 overflow-y-auto max-h-48">
                      {importPreview.valid ? (
                          <pre className="whitespace-pre-wrap font-sans text-slate-400">{importPreview.report}</pre>
                      ) : (
                          <p className="text-rose-400 font-bold">{importPreview.report}</p>
                      )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Esta ação irá <strong>APAGAR TODOS</strong> os dados atuais e substituir pelo backup. A operação é irreversível.</p>
                  <div className="flex gap-3"><button onClick={() => setImportPreview(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all">Cancelar</button><button onClick={executeRestore} disabled={!importPreview.valid} className="flex-1 py-3 bg-sky-600 text-white font-bold rounded-xl shadow-lg hover:bg-sky-500 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">Restaurar e Limpar</button></div>
              </div>
          </div>
      )}
      
      <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={handleFactoryReset} title="Zerar Tudo?">
          <div className="space-y-3">
              <p>Tem certeza que deseja apagar <strong>TODO</strong> o progresso, questões, flashcards e configurações?</p>
              <p className="text-xs text-rose-500 font-bold uppercase">O aplicativo retornará ao estado inicial de fábrica.</p>
          </div>
      </ConfirmationModal>

      {batchReport && (
          <BatchReportModal isOpen={!!batchReport} onClose={() => setBatchReport(null)} report={batchReport} />
      )}
      <BlackboxReportModal isOpen={isBlackboxOpen} onClose={() => setIsBlackboxOpen(false)} />
    </div>
  );
};

export default SettingsView;
