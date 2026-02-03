
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, DailyXp, PointBreakdown, BadgeID, AppSettings } from '../types';
import { loadData, saveData } from '../services/storage';

const LS_PROFILE_KEY = 'miaaula_user_profile';

interface ProfileContextType {
    profile: UserProfile;
    updateProfile: (updates: Partial<UserProfile>) => void;
    checkBadges: (settings: AppSettings) => void;
}

const defaultProfile: UserProfile = {
    level: 1,
    currentXp: 0,
    totalXp: 0,
    streak: 0,
    badges: [],
    dailyHistory: []
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [profile, setProfile] = useState<UserProfile>(defaultProfile);

    useEffect(() => {
        loadData<UserProfile>(LS_PROFILE_KEY).then(data => {
            if (data) setProfile(data);
        });
    }, []);

    useEffect(() => {
        saveData(LS_PROFILE_KEY, profile);
    }, [profile]);

    const updateProfile = (updates: Partial<UserProfile>) => {
        setProfile(prev => ({ ...prev, ...updates }));
    };

    const checkBadges = (settings: AppSettings) => {
        // Implementation placeholder for badge checking logic
        // This ensures the method exists for consumers
        if (settings.gamification?.enabled) {
            // Check logic here
        }
    };

    return (
        <ProfileContext.Provider value={{ profile, updateProfile, checkBadges }}>
            {children}
        </ProfileContext.Provider>
    );
};

export const useProfile = () => {
    const context = useContext(ProfileContext);
    if (!context) throw new Error('useProfile must be used within a ProfileProvider');
    return context;
};
