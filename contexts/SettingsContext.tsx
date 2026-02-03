
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppSettings, Goal, BattleHistoryEntry, DailyTaskType, DailyActivityLog, GameRecord, PairMatchHistoryEntry, ReviewAlarm, SystemLog } from '../types';
import { loadData, saveData } from '../services/storage';

const LS_SETTINGS_KEY = 'revApp_settings_v1';

const defaultSettings: AppSettings = {
  userName: 'Estudante',
  appTheme: 'dark',
  enableBlackHoleEffect: false,
  userXp: 0,
  enableUnlimitedMemory: true,
  navOrder: [
    'today', 'study', 'radar', 'flashcards', 'trail', 
    'porrada', 'pair-match', 'literalness', 
    'manage', 'list', 'battle', 'map', 
    'dash', 'profile', 'settings'
  ],
  quickAccessTools: ['flashcards', 'trail', 'porrada', 'literalness', 'alarms'],
  readerMode: 'compact', // DEFAULT TO COMPACT

  trapscan: {
      enabled: true,
      assistMode: true, 
      defaultMode: 'TREINO', // Padrão recomendado
      lockLevel: 'SOFT', // New default
  },

  learning: {
      srs: {
          enabled: true,
          maxLatenessDays: 30,
          stabilityCapDays: 365,
          decayLevel: 0.5,
          gainLevel: 1.0,
          penaltyLevel: 0.5,
          failReviewDelayDays: 1,
          successMinDelayDays: 1,
          rTarget: 0.85,
          rNear: 0.90,
          conservativeFactorOnExamDay: 0.5,
          conservativeFactorOnExamEve: 0.7,
          weights: {
              isHot: 0.5,
              isFundamental: 0.3,
              isCritical: 0.4,
              recentError: 0.3,
              lowS: 0.2
          }
      },
      mastery: {
          enabled: true,
          diminishingReturns: true,
          maxGainPerSession: 15,
          errorPenaltyLevel: 0.2,
          weightsByActivity: {
              reading: 10,
              questions: 30,
              gaps: 20,
              flashcards: 20,
              pairs: 10,
              onemin: 10
          }
      },
      overridesByActivity: {},
      keyStrategy: { mode: 'id' },
      maintenance: {}
  },
  
  questionsPerPage: 20,
  enableTimer: true,
  studyTimerDuration: 25,
  targetResponseTimeSec: 120,
  timeSensitivity: 1,
  srsIntervals: [0.5, 1, 7, 14, 30],
  goals: [],
  useNewSrsLogic: true,
  showNotesAfterAnswer: true,
  showHistoryAfterAnswer: false,
  showMissingExplainFields: true, 
  enableSoundEffects: true,
  lockEarlyReview: true,
  isPinLockEnabled: false,
  pinHash: undefined,
  studyProtocolMode: 'free', 
  
  alarms: [],
  studyMode: 'standard',
  examDate: new Date(Date.now() + 30 * 86400000).toISOString(),
  enableStandardPomodoro: false,
  standardPomodoroFocusMinutes: 25,
  standardPomodoroBreakMinutes: 5,
  subjectConfigs: {
      'Legislação Tributária Estadual (SP)': { priority: 'medium', isFrozen: true }
  },
  lawConfigs: {},
  srs: {
    rTarget: 0.80,
    rNear: 0.85,
    conservativeFactorOnExamDay: 0.4,
    conservativeFactorOnExamEve: 0.6,
    weights: {
      isHot: 0.5,
      isFundamental: 0.3,
      isCritical: 0.3,
      recentError: 0.3,
      lowS: 0.2,
    },
  },
  examMode: {
    timePerQuestionSec: 120,
    blockMinutes: 30,
    breakMinutes: 6,
    microSpacedHours: [0, 6, 18],
  },
  srsV2: {
    time_target_sec: 120,
    alpha_easy: 0.30,
    alpha_good: 0.22,
    alpha_hard: 0.12,
    gamma_fail: 0.50,
    rt_fast: 0.50,
    rt_slow: 1.50,
    k_rt_bonus: 0.06,
    k_long_gap: 0.10,
    target_R: 0.85,
    min_interval_days: 1,
    max_hot_days: 3,
    S_default_days: 1,
    cap_S_days: 365,
    enableRetrievabilityCheck: true,
  },
  target_sec_default: 120,
  literalnessHighScore: 0,
  dailyActivityLog: {},
  wallet: { coins: 0, gems: 0 },
  streaks: { current: 0, longest: 0, lastActivity: '' },
  battleEliminationWeight: 60,
  battleHistory: [],
  lightningHighScore: 0,
  pairMatchHistory: [],
  gameRecords: [],
  sopGuardTypes: ['02', '03', '04', '07', '15'],
  min_think_sec: 5,
  rush_threshold: 0.5,
  over_threshold: 2.0,
  sop_band_low: 0.8,
  sop_band_high: 1.2,
  lambda_ewma: 0.3,
  mad_alert_z: 3,
  window_n: 10,
  inventory: [],
  lastImportBatchId: '' // Initialize
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  lastXpGain: { amount: number, message: string, id: number } | null;
  addXp: (amount: number, message: string) => void;
  logDailyActivity: (taskType: DailyTaskType) => void;
  addBattleHistoryEntry: (entry: Omit<BattleHistoryEntry, 'id' | 'date'>) => void;
  updateGameRecord: (record: { topicTitle: string; pairCount: number; timeSec: number; clicks: number }) => void;
  addPairMatchHistory: (entry: Omit<PairMatchHistoryEntry, 'id' | 'date'>) => void;
  addAlarm: (alarm: Omit<ReviewAlarm, 'id' | 'createdAt' | 'lastFiredAt'>) => void;
  updateAlarm: (id: string, updates: Partial<ReviewAlarm>) => void;
  deleteAlarm: (id: string) => void;
  requestNotificationPermission: () => Promise<boolean>;
  setPin: (pin: string | null) => void;
  systemLogs: SystemLog[];
  logSystemError: (error: any, context?: string) => void;
  clearLogs: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  // Add ID to allow UI to track unique events
  const [lastXpGain, setLastXpGain] = useState<{ amount: number, message: string, id: number } | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await loadData<AppSettings>(LS_SETTINGS_KEY);
        if (data) {
          setSettings(prev => {
              const merged = { ...prev, ...data };
              // Ensure defaults if missing
              if (!merged.readerMode) merged.readerMode = 'compact';

              // Ensure srsV2 exists and has required properties
              if (!merged.srsV2) {
                  merged.srsV2 = defaultSettings.srsV2;
              } else {
                  merged.srsV2 = { ...defaultSettings.srsV2, ...merged.srsV2 };
              }
              
              // Ensure Trapscan config
              if (!merged.trapscan) {
                  merged.trapscan = defaultSettings.trapscan;
              } else {
                  // Merge default trapscan properties if they are missing
                  merged.trapscan = { ...defaultSettings.trapscan, ...merged.trapscan };
              }

              if (!merged.learning) {
                  merged.learning = defaultSettings.learning;
              } else {
                  // Merge learning object but ensure SRS config is also merged if missing
                  merged.learning = { ...defaultSettings.learning, ...merged.learning };
                  if (!merged.learning.srs) {
                      merged.learning.srs = defaultSettings.learning.srs;
                  } else {
                      merged.learning.srs = { ...defaultSettings.learning.srs, ...merged.learning.srs };
                  }
              }
              return merged;
          });
        }
      } catch (error) {
        console.error("Failed to load settings", error);
      } finally {
        setIsLoaded(true);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveData(LS_SETTINGS_KEY, settings).catch(err => console.error("Failed to save settings", err));
    }
  }, [settings, isLoaded]);

  // --- APLICAR CORES CUSTOMIZADAS ---
  useEffect(() => {
    if (settings.customColors) {
      const root = document.documentElement;
      if (settings.customColors.bg) root.style.setProperty('--app-bg', settings.customColors.bg);
      else root.style.removeProperty('--app-bg');

      if (settings.customColors.text) root.style.setProperty('--app-text', settings.customColors.text);
      else root.style.removeProperty('--app-text');

      if (settings.customColors.surface) root.style.setProperty('--app-surface', settings.customColors.surface);
      else root.style.removeProperty('--app-surface');
    }
  }, [settings.customColors]);
  // ---------------------------------

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
        const next = { ...prev, ...newSettings };
        // Deep merge trapscan if present in updates
        if (newSettings.trapscan) {
            next.trapscan = { ...prev.trapscan, ...newSettings.trapscan };
        }
        return next;
    });
  }, []);

  const addXp = useCallback((amount: number, message: string) => {
    setSettings(prev => ({ ...prev, userXp: (prev.userXp || 0) + amount }));
    // Generate a unique ID (timestamp) so UI knows this is a fresh event
    // Removed internal setTimeout to allow UI components to manage their own display duration
    setLastXpGain({ amount, message, id: Date.now() });
  }, []);

  const logDailyActivity = useCallback((taskType: DailyTaskType) => {
    const today = new Date().toISOString().split('T')[0];
    setSettings(prev => {
        const log = { ...prev.dailyActivityLog };
        if (!log[today]) log[today] = [];
        log[today].push(taskType);
        
        // Streak Logic
        let streak = prev.streaks.current;
        const lastDate = prev.streaks.lastActivity;
        
        if (lastDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            if (lastDate === yesterdayStr) {
                streak++;
            } else {
                streak = 1;
            }
        }

        return {
            ...prev,
            dailyActivityLog: log,
            streaks: {
                current: streak,
                longest: Math.max(streak, prev.streaks.longest),
                lastActivity: today
            }
        };
    });
  }, []);

  const addBattleHistoryEntry = useCallback((entry: Omit<BattleHistoryEntry, 'id' | 'date'>) => {
      const newEntry: BattleHistoryEntry = {
          id: `battle_${Date.now()}`,
          date: new Date().toISOString(),
          ...entry
      };
      setSettings(prev => ({
          ...prev,
          battleHistory: [...(prev.battleHistory || []), newEntry]
      }));
  }, []);

  const updateGameRecord = useCallback((record: { topicTitle: string; pairCount: number; timeSec: number; clicks: number }) => {
      setSettings(prev => {
          const records = [...(prev.gameRecords || [])];
          const existingIndex = records.findIndex(r => r.topicTitle === record.topicTitle && r.pairCount === record.pairCount);
          
          if (existingIndex >= 0) {
              const current = records[existingIndex];
              if (record.timeSec < current.bestTimeSec || (record.timeSec === current.bestTimeSec && record.clicks < current.minClicks)) {
                  records[existingIndex] = { ...current, bestTimeSec: record.timeSec, minClicks: record.clicks };
              }
          } else {
              records.push({ topicTitle: record.topicTitle, pairCount: record.pairCount, bestTimeSec: record.timeSec, minClicks: record.clicks });
          }
          return { ...prev, gameRecords: records };
      });
  }, []);

  const addPairMatchHistory = useCallback((entry: Omit<PairMatchHistoryEntry, 'id' | 'date'>) => {
      const newEntry: PairMatchHistoryEntry = {
          id: `pm_${Date.now()}`,
          date: new Date().toISOString(),
          ...entry
      };
      setSettings(prev => ({
          ...prev,
          pairMatchHistory: [...(prev.pairMatchHistory || []), newEntry]
      }));
  }, []);

  const addAlarm = useCallback((alarm: Omit<ReviewAlarm, 'id' | 'createdAt' | 'lastFiredAt'>) => {
      const newAlarm: ReviewAlarm = {
          id: `alarm_${Date.now()}`,
          createdAt: Date.now(),
          ...alarm
      };
      setSettings(prev => ({ ...prev, alarms: [...(prev.alarms || []), newAlarm] }));
  }, []);

  const updateAlarm = useCallback((id: string, updates: Partial<ReviewAlarm>) => {
      setSettings(prev => ({
          ...prev,
          alarms: (prev.alarms || []).map(a => a.id === id ? { ...a, ...updates } : a)
      }));
  }, []);

  const deleteAlarm = useCallback((id: string) => {
      setSettings(prev => ({
          ...prev,
          alarms: (prev.alarms || []).filter(a => a.id !== id)
      }));
  }, []);

  const requestNotificationPermission = useCallback(async () => {
      if (!("Notification" in window)) return false;
      const permission = await Notification.requestPermission();
      return permission === 'granted';
  }, []);

  const setPin = useCallback((pin: string | null) => {
      setSettings(prev => ({
          ...prev,
          isPinLockEnabled: !!pin,
          pinHash: pin ? btoa(pin) : undefined // Simple encoding for demo
      }));
  }, []);

  const logSystemError = useCallback((error: any, context?: string) => {
      const newLog: SystemLog = {
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          type: 'error',
          message: error?.message || String(error),
          details: context
      };
      setSystemLogs(prev => [newLog, ...prev].slice(0, 50));
      console.error(`[System Error] ${context}:`, error);
  }, []);

  const clearLogs = useCallback(() => {
      setSystemLogs([]);
  }, []);

  return (
    <SettingsContext.Provider value={{
      settings,
      updateSettings,
      lastXpGain,
      addXp,
      logDailyActivity,
      addBattleHistoryEntry,
      updateGameRecord,
      addPairMatchHistory,
      addAlarm,
      updateAlarm,
      deleteAlarm,
      requestNotificationPermission,
      setPin,
      systemLogs,
      logSystemError,
      clearLogs
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
