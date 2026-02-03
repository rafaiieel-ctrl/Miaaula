
const DB_NAME = 'MiaaulaDB';
const DB_VERSION = 9; 

export const STORES = {
    NUCLEUS: 'nucleus',     // PK: lit_ref
    CONTENT: 'content',     // PK: id (DETERMINISTIC), INDEX: lit_ref, type
    PROGRESS: 'progress',   // PK: pk (userId:itemId), INDEX: lit_ref
    SETTINGS: 'settings',   
    KEYVAL: 'keyval'        
};

export function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            if (!db.objectStoreNames.contains(STORES.NUCLEUS)) {
                db.createObjectStore(STORES.NUCLEUS, { keyPath: 'id' });
            }
            
            if (!db.objectStoreNames.contains(STORES.CONTENT)) {
                const store = db.createObjectStore(STORES.CONTENT, { keyPath: 'id' });
                store.createIndex('litRef', 'litRef', { unique: false });
                store.createIndex('type', 'type', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.PROGRESS)) {
                const store = db.createObjectStore(STORES.PROGRESS, { keyPath: 'pk' });
                store.createIndex('litRef', 'litRef', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(STORES.KEYVAL)) {
                db.createObjectStore(STORES.KEYVAL);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject((e.target as any).error);
    });
}

// --- GENERIC HELPERS ---

export async function dbPut(storeName: string, data: any | any[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        if (Array.isArray(data)) {
            data.forEach(item => store.put(item));
        } else {
            store.put(data);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function dbGetByIndex<T>(storeName: string, indexName: string, value: string): Promise<T[]> {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    const request = index.getAll(value);
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

export async function dbGet<T>(storeName: string, key: string): Promise<T | null> {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

export async function dbDelete(storeName: string, key: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    return new Promise((resolve) => tx.oncomplete = () => resolve());
}

// --- SPECIFIC KEY-VAL HELPERS (Legacy Support) ---

export async function loadData<T>(key: string): Promise<T | null> {
    const db = await openDB();
    const tx = db.transaction(STORES.KEYVAL, 'readonly');
    const request = tx.objectStore(STORES.KEYVAL).get(key);
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
}

export async function saveData(key: string, data: any): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.KEYVAL, 'readwrite');
    tx.objectStore(STORES.KEYVAL).put(data, key);
    return new Promise((resolve) => tx.oncomplete = () => resolve());
}

// --- BULK OPERATIONS FOR BACKUP ---

export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

export async function bulkPutToStore(storeName: string, items: any[]): Promise<void> {
    if (!items || items.length === 0) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        items.forEach(item => store.put(item));
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject((e.target as any).error);
    });
}

/**
 * FACTORY RESET: Wipes EVERYTHING from IndexedDB and LocalStorage.
 * Used before restoring a backup to ensure no "ghost data" remains.
 */
export async function factoryReset(): Promise<void> {
    console.warn("!!! INITIATING FACTORY RESET !!!");
    
    // 1. Wipe IndexedDB Stores
    const db = await openDB();
    const storeNames = Array.from(db.objectStoreNames);
    
    if (storeNames.length > 0) {
        const tx = db.transaction(storeNames, 'readwrite');
        const promises = storeNames.map(name => {
            return new Promise<void>((resolve, reject) => {
                const req = tx.objectStore(name).clear();
                req.onsuccess = () => {
                    console.log(`[FactoryReset] Cleared store: ${name}`);
                    resolve();
                };
                req.onerror = (e) => {
                    console.error(`[FactoryReset] Failed to clear ${name}`, e);
                    reject(e);
                };
            });
        });
        await Promise.all(promises);
    }

    // 2. Wipe LocalStorage (App prefixes only to be safe, or just clear all)
    // Prefixes: revApp_, miaaula_
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('revApp_') || key.startsWith('miaaula_'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    console.log(`[FactoryReset] Cleared ${keysToRemove.length} keys from LocalStorage.`);
}
