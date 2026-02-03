
const LS_KEY = 'miaaula.studyLater.v1';

export interface StudyLaterEntry {
    addedAt: number;
}

export type StudyLaterMap = Record<string, StudyLaterEntry>;

const getMap = (): StudyLaterMap => {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
};

const saveMap = (map: StudyLaterMap) => {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
};

export const isStudyLater = (questionId: string): boolean => {
    return !!getMap()[questionId];
};

export const toggleStudyLater = (questionId: string): boolean => {
    const map = getMap();
    let isAdded = false;
    
    if (map[questionId]) {
        delete map[questionId];
    } else {
        map[questionId] = { addedAt: Date.now() };
        isAdded = true;
    }
    
    saveMap(map);
    return isAdded;
};

export const getStudyLaterIds = (): string[] => {
    return Object.keys(getMap());
};

export const clearInvalidIds = (validIds: Set<string>) => {
    const map = getMap();
    let hasChanges = false;
    
    Object.keys(map).forEach(id => {
        if (!validIds.has(id)) {
            delete map[id];
            hasChanges = true;
        }
    });
    
    if (hasChanges) saveMap(map);
};
