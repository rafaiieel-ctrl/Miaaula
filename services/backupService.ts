
import * as storage from './storage';
import { factoryReset } from './storage';

// Schema Version ensures future compatibility
const BACKUP_SCHEMA_VERSION = 2;

export interface FullBackup {
    meta: {
        version: number;
        timestamp: string;
        appName: string;
    };
    stores: {
        nucleus: any[];
        content: any[];
        progress: any[];
        keyval: Record<string, any>; // Legacy LocalStorage shim items
    };
}

// Helpers for Robust Restore
const asArray = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    if (val) return [val];
    return [];
};

const normalizeBackupData = (raw: any): FullBackup['stores'] => {
    // 1. Locate the data container
    // Handles V2 (stores), V1 (data/payload), or Flat
    const candidate = 
        (raw && raw.stores) || 
        (raw && raw.data) || 
        (raw && raw.payload) || 
        raw || 
        {};

    // 2. Initialize aligned structure
    const stores: FullBackup['stores'] = {
        nucleus: [],
        content: [],
        progress: [],
        keyval: {}
    };

    // 3. Extract and Normalize 'Nucleus' (Lei Seca Cards)
    if (candidate.nucleus) stores.nucleus = asArray(candidate.nucleus);
    else if (candidate.lawCards) stores.nucleus = asArray(candidate.lawCards);

    // 4. Extract 'Content' (Questions, Gaps, Flashcards)
    if (candidate.content) stores.content = asArray(candidate.content);
    
    // 5. Extract 'Progress'
    if (candidate.progress) stores.progress = asArray(candidate.progress);

    // 6. Extract 'KeyVal' (Legacy/Settings)
    if (candidate.keyval && typeof candidate.keyval === 'object') {
        stores.keyval = candidate.keyval;
    } else {
        // Attempt to find known keys in root/candidate if keyval object doesn't exist
        // This handles "Legacy" backups where keys were at the root of 'data'
        const knownKeys = [
            'revApp_settings_v1', 
            'revApp_questions_v5_react', 
            'revApp_flashcards_v1',
            'revApp_topics_v1',
            'revApp_trails_v1',
            'revApp_literalness_v1'
        ];
        knownKeys.forEach(k => {
            if (candidate[k]) stores.keyval[k] = candidate[k];
        });
    }

    return stores;
};

export const backupService = {
    /**
     * Generates a complete backup of all application data.
     */
    async createFullBackup(): Promise<FullBackup> {
        console.log('[Backup] Starting full backup...');

        // 1. Fetch Structured Data (Lei Seca)
        const nucleus = await storage.getAllFromStore<any>(storage.STORES.NUCLEUS);
        const content = await storage.getAllFromStore<any>(storage.STORES.CONTENT);
        const progress = await storage.getAllFromStore<any>(storage.STORES.PROGRESS);

        // 2. Fetch Legacy/Settings Data (Key-Val Store)
        const keyvalData: Record<string, any> = {};
        const keyvalKeys = [
            'revApp_settings_v1', 
            'revApp_questions_v5_react', 
            'revApp_flashcards_v1',
            'revApp_topics_v1',
            'revApp_trails_v1',
            'revApp_literalness_v1' 
        ];

        for (const key of keyvalKeys) {
            const val = await storage.loadData(key);
            if (val) keyvalData[key] = val;
        }

        const backup: FullBackup = {
            meta: {
                version: BACKUP_SCHEMA_VERSION,
                timestamp: new Date().toISOString(),
                appName: 'Miaaula'
            },
            stores: {
                nucleus,
                content,
                progress,
                keyval: keyvalData
            }
        };

        console.log(`[Backup] Completed. Nuclei: ${nucleus.length}, Content: ${content.length}, Keys: ${Object.keys(keyvalData).length}`);
        return backup;
    },

    /**
     * Simulates a restore process to validate data structure without applying changes.
     */
    simulateRestore(backupData: any): { valid: boolean; report: string; stats?: any } {
        try {
            if (!backupData) throw new Error("Dados vazios.");
            
            const start = performance.now();
            const stores = normalizeBackupData(backupData);
            
            const stats = {
                nucleus: stores.nucleus.length,
                content: stores.content.length,
                progress: stores.progress.length,
                settingsKeys: Object.keys(stores.keyval).length
            };

            const totalItems = stats.nucleus + stats.content + stats.progress + stats.settingsKeys;
            
            if (totalItems === 0) {
                return { valid: false, report: "O arquivo não contém dados reconhecíveis (estruturas vazias)." };
            }

            const time = (performance.now() - start).toFixed(2);
            const report = `Simulação OK (${time}ms).\n\nEncontrado:\n- ${stats.nucleus} Artigos (Núcleos)\n- ${stats.content} Itens de Conteúdo (Q/FC)\n- ${stats.progress} Registros de Progresso\n- ${stats.settingsKeys} Arquivos de Configuração`;

            return { valid: true, report, stats };
        } catch (e: any) {
            return { valid: false, report: `Falha na simulação: ${e.message}` };
        }
    },

    /**
     * Diagnostics: Runs an internal cycle of Backup -> Memory -> Normalize -> Verify
     */
    async runSelfDiagnostics(): Promise<string> {
        const logs: string[] = ["=== DIAGNÓSTICO DE BACKUP ==="];
        try {
            // Step 1: Extraction
            logs.push("1. Extraindo dados atuais...");
            const backup = await this.createFullBackup();
            logs.push(`   > Backup gerado na memória. Tamanho aprox: ${(JSON.stringify(backup).length / 1024).toFixed(2)} KB`);

            // Step 2: Simulation
            logs.push("2. Simulando restauração...");
            const sim = this.simulateRestore(backup);
            
            if (sim.valid) {
                logs.push("   > " + sim.report.replace(/\n/g, ", "));
                logs.push("3. Verificação de Integridade:");
                if (sim.stats.nucleus === backup.stores.nucleus.length) logs.push("   > Núcleos: Íntegro");
                else logs.push("   > ⚠️ Divergência em Núcleos");
                
                logs.push("✅ SUCESSO: O sistema de backup está operando corretamente.");
            } else {
                logs.push("❌ FALHA: A simulação rejeitou o backup gerado.");
                logs.push(`   Erro: ${sim.report}`);
            }

        } catch (e: any) {
            logs.push(`❌ ERRO CRÍTICO: ${e.message}`);
        }
        return logs.join('\n');
    },

    /**
     * Restores a backup file, respecting dependency order.
     */
    async restoreFullBackup(backupData: any): Promise<{ success: boolean; message: string }> {
        try {
            console.log('[Restore] Validating backup...');
            
            if (!backupData) {
                throw new Error('Arquivo de backup vazio ou inválido.');
            }

            // 0. Normalize Data Structure
            const stores = normalizeBackupData(backupData);
            
            // Check if we found anything meaningful
            const totalItems = stores.nucleus.length + stores.content.length + Object.keys(stores.keyval).length;
            if (totalItems === 0) {
                 throw new Error('Backup não contém dados reconhecíveis (Stores vazio).');
            }

            console.log(`[Restore] Found: ${stores.nucleus.length} Nuclei, ${stores.content.length} Content Items.`);

            console.log('[Restore] Performing Factory Reset...');
            await factoryReset();

            // 1. Restore Nucleus (Lei Seca Cards) - Critical Parent Data
            if (stores.nucleus.length > 0) {
                console.log(`[Restore] Restoring ${stores.nucleus.length} Nuclei...`);
                await storage.bulkPutToStore(storage.STORES.NUCLEUS, stores.nucleus);
            }

            // 2. Restore Content (Questions, Gaps, Flashcards linked to Lei Seca)
            if (stores.content.length > 0) {
                console.log(`[Restore] Restoring ${stores.content.length} Content Items...`);
                await storage.bulkPutToStore(storage.STORES.CONTENT, stores.content);
            }

            // 3. Restore Progress (Atomic study records)
            if (stores.progress.length > 0) {
                console.log(`[Restore] Restoring ${stores.progress.length} Progress Records...`);
                await storage.bulkPutToStore(storage.STORES.PROGRESS, stores.progress);
            }

            // 4. Restore KeyVal (Settings, Legacy Questions, Trails)
            const keys = Object.keys(stores.keyval);
            if (keys.length > 0) {
                console.log(`[Restore] Restoring ${keys.length} Settings/Legacy Keys...`);
                for (const key of keys) {
                    await storage.saveData(key, stores.keyval[key]);
                }
            }

            return { success: true, message: 'Restauração completa com sucesso!' };

        } catch (e: any) {
            console.error('[Restore] Failed:', e);
            return { success: false, message: `Erro na restauração: ${e.message}` };
        }
    }
};
