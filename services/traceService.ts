
import { Question, LiteralnessCard, Flashcard } from '../types';
import { canonicalizeLitRef } from './srsService';

// --- Types ---

export type TraceScope = 'IMPORT' | 'LITERALNESS' | 'QUESTIONS' | 'STORAGE' | 'SRS' | 'UI' | 'BOOT' | 'GAP_SESSION';

export interface TraceEvent {
    id: string;
    sessionId: string;
    ts: number; // Date.now()
    t: number; // performance.now()
    type: string;
    scope: TraceScope;
    ref?: string;
    payload?: any;
}

export interface TraceSnapshot {
    label: string;
    sessionId: string;
    ts: number;
    counts: {
        cards: number;
        questions: number;
        flashcards: number;
        uniqueQuestionIds: number;
        duplicateQuestionIds: number;
        tempIdCount: number;
        emptyLawRefCount: number;
        emptyQuestionRefCount: number;
    };
    duplicatesPreview: string[];
    tempPreview: { id: string; questionRef: string; lawRef: string }[];
    linkHealth: {
        cardId: string;
        questionsFoundByLawRef: number;
        questionIdsCount: number;
        missingLinksCount: number;
    }[];
}

// --- Configuration ---

const DB_NAME = 'MiaaulaBlackboxDB';
const STORE_NAME = 'traces';
const BUFFER_SIZE = 2000;
const SESSION_ID = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

// --- Service ---

class TraceService {
    private buffer: TraceEvent[] = [];
    private dbPromise: Promise<IDBDatabase> | null = null;
    private isEnabled = true; // Default to true for debugging

    constructor() {
        if (typeof window !== 'undefined') {
            this.dbPromise = this.openDB();
            this.trace('SESSION_START', 'BOOT', SESSION_ID, { userAgent: navigator.userAgent });
        }
    }

    private openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('ts', 'ts', { unique: false });
                    store.createIndex('scope', 'scope', { unique: false });
                }
            };
            request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
            request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
        });
    }

    public async trace(type: string, scope: TraceScope, ref?: string, payload?: any) {
        if (!this.isEnabled) return;

        const event: TraceEvent = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            sessionId: SESSION_ID,
            ts: Date.now(),
            t: performance.now(),
            type,
            scope,
            ref,
            payload: payload ? JSON.parse(JSON.stringify(payload)) : undefined // Detach references
        };

        // Ring buffer logic
        this.buffer.push(event);
        if (this.buffer.length > BUFFER_SIZE) {
            this.buffer.shift();
        }

        // Persist async
        try {
            const db = await this.dbPromise;
            if (db) {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).add(event);
            }
        } catch (e) {
            console.error('[TraceService] Failed to persist event', e);
        }
    }

    public snapshot(
        label: string, 
        data: { cards?: LiteralnessCard[]; questions?: Question[]; flashcards?: Flashcard[] }
    ) {
        if (!this.isEnabled) return;

        const questions = data.questions || [];
        const cards = data.cards || [];
        const flashcards = data.flashcards || [];

        // 1. Analyze Questions
        const qIds = new Set<string>();
        const duplicates = new Set<string>();
        let tempIdCount = 0;
        let emptyLawRef = 0;
        let emptyQRef = 0;
        const tempPreview: any[] = [];

        questions.forEach(q => {
            if (qIds.has(q.id)) duplicates.add(q.id);
            qIds.add(q.id);

            if (!q.id || q.id.startsWith('temp') || q.id.startsWith('new_')) {
                tempIdCount++;
                if (tempPreview.length < 30) {
                    tempPreview.push({ id: q.id, questionRef: q.questionRef, lawRef: q.lawRef });
                }
            }

            if (!q.lawRef) emptyLawRef++;
            if (!q.questionRef) emptyQRef++;
        });

        // 2. Link Health
        const linkHealth = cards.map(c => {
            const canonicalId = canonicalizeLitRef(c.id);
            // Single Source of Truth Logic duplicated here for audit
            const byLawRef = questions.filter(q => canonicalizeLitRef(q.lawRef) === canonicalId);
            const arrayCount = c.questionIds?.length || 0;
            
            return {
                cardId: c.id,
                questionsFoundByLawRef: byLawRef.length,
                questionIdsCount: arrayCount,
                missingLinksCount: arrayCount - byLawRef.length 
            };
        }).sort((a, b) => Math.abs(b.missingLinksCount) - Math.abs(a.missingLinksCount))
          .slice(0, 10); 

        const snapshotData: TraceSnapshot = {
            label,
            sessionId: SESSION_ID,
            ts: Date.now(),
            counts: {
                cards: cards.length,
                questions: questions.length,
                flashcards: flashcards.length,
                uniqueQuestionIds: qIds.size,
                duplicateQuestionIds: duplicates.size,
                tempIdCount,
                emptyLawRefCount: emptyLawRef,
                emptyQuestionRefCount: emptyQRef
            },
            duplicatesPreview: Array.from(duplicates).slice(0, 30),
            tempPreview,
            linkHealth
        };

        this.trace('STORAGE_SNAPSHOT', 'STORAGE', label, snapshotData);
    }

    public async exportLogs(): Promise<TraceEvent[]> {
        const db = await this.dbPromise;
        if (!db) return this.buffer;

        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                // Sort by TS desc
                const res = (request.result as TraceEvent[]).sort((a, b) => b.ts - a.ts);
                resolve(res);
            };
            request.onerror = () => resolve(this.buffer);
        });
    }

    public async clearLogs() {
        const db = await this.dbPromise;
        if (db) {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
        }
        this.buffer = [];
    }
}

export const traceService = new TraceService();
