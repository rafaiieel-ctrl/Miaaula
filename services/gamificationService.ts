
import { GamificationSettings, UserProfile, BadgeID, PointBreakdown, DailyActivityLog } from '../types';
import { toISODate } from './srsService';

export const getDailyXp = (activityLog: DailyActivityLog): number => {
    const today = toISODate(new Date());
    const tasks = activityLog[today] || [];
    // Simple logic: 10 XP per task
    return tasks.length * 10;
};

export const checkStreaks = (activityLog: DailyActivityLog) => {
    const today = toISODate(new Date());
    const hasActivityToday = !!activityLog[today];
    
    // Simplistic streak logic
    let streak = hasActivityToday ? 1 : 0;
    // Calculate backwards... (Placeholder logic)
    
    return { current: streak, lastActivity: hasActivityToday ? today : '' };
};

export const calculateLevel = (xp: number): number => {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
};

export const checkNewBadges = (profile: UserProfile, settings: any): BadgeID[] => {
    const newBadges: BadgeID[] = [];
    // Logic to check badges
    return newBadges;
};
