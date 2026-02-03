
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Topic } from '../types';
import { saveData, loadData } from '../services/storage';
import { useSettings } from './SettingsContext';

const LS_TOPICS_KEY = 'revApp_topics_v1';

// --- State Context ---
const TopicStateContext = createContext<Topic[] | undefined>(undefined);

// --- Dispatch Context ---
interface TopicDispatch {
  addOrUpdateTopic: (topicData: { name: string, subject: string, description: string }) => void;
  updateTopicDescription: (topicId: string, description: string) => void;
}
const TopicDispatchContext = createContext<TopicDispatch | undefined>(undefined);

export const TopicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { logSystemError } = useSettings();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load Data Async
  useEffect(() => {
      async function load() {
          try {
              const data = await loadData<Topic[]>(LS_TOPICS_KEY);
              if (data && Array.isArray(data)) {
                  setTopics(data.filter(t => t.id && t.name && t.subject));
              }
          } catch (e) {
              logSystemError(e, 'TopicContext Load');
          } finally {
              setIsLoaded(true);
          }
      }
      load();
  }, [logSystemError]);

  // Save Data Async
  useEffect(() => {
    if (!isLoaded) return;
    const save = async () => {
        try {
            await saveData(LS_TOPICS_KEY, topics);
        } catch (error) {
            logSystemError(error, 'TopicContext Save');
        }
    };
    save();
  }, [topics, isLoaded, logSystemError]);

  const addOrUpdateTopic = useCallback((topicData: { name: string, subject: string, description: string }) => {
    setTopics(prev => {
      const existing = prev.find(t => t.name === topicData.name && t.subject === topicData.subject);
      if (existing) {
        // Only update if a new description is provided and is different
        if (topicData.description && existing.description !== topicData.description) {
          return prev.map(t => t.id === existing.id ? { ...t, description: topicData.description } : t);
        }
        return prev; // No change needed
      } else {
        // Add new topic if it doesn't exist
        const newTopic: Topic = {
          ...topicData,
          id: `topic_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        };
        return [...prev, newTopic];
      }
    });
  }, []);

  const updateTopicDescription = useCallback((topicId: string, description: string) => {
    setTopics(prev => prev.map(t => (t.id === topicId ? { ...t, description } : t)));
  }, []);
  
  const dispatchValue = useMemo(() => ({
    addOrUpdateTopic,
    updateTopicDescription,
  }), [addOrUpdateTopic, updateTopicDescription]);

  return (
    <TopicStateContext.Provider value={topics}>
        <TopicDispatchContext.Provider value={dispatchValue}>
            {children}
        </TopicDispatchContext.Provider>
    </TopicStateContext.Provider>
  );
};

export const useTopicState = (): Topic[] => {
  const context = useContext(TopicStateContext);
  if (context === undefined) {
    throw new Error('useTopicState must be used within a TopicProvider');
  }
  return context;
};

export const useTopicDispatch = (): TopicDispatch => {
  const context = useContext(TopicDispatchContext);
  if (context === undefined) {
    throw new Error('useTopicDispatch must be used within a TopicProvider');
  }
  return context;
};
