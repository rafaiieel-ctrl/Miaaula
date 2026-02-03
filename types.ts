
export type TabID = 'today' | 'study' | 'flashcards' | 'porrada' | 'manage' | 'list' | 'map' | 'dash' | 'profile' | 'settings' | 'trail' | 'pair-match' | 'literalness' | 'normas' | 'jurisprudencia' | 'sectors' | 'radar' | 'battle';

export type QuestionType = string;

export interface Attempt {
    date: string;
    wasCorrect: boolean;
    masteryAfter: number;
    stabilityAfter: number;
    difficultyAfter?: number;
    timeSec: number;
    selfEvalLevel: number;
    trapCode?: string;
    grade?: string;
    timingClass?: string;
    targetSec?: number;
    trapscanData?: TrapscanEntry;
}

export interface Question {
    id: string;
    questionRef: string;
    questionText: string;
    options: { [key: string]: string | undefined };
    correctAnswer: string;
    subject: string;
    topic: string;
    subtopic?: string;
    bank?: string;
    position?: string;
    area?: string;
    explanation?: string;
    explanationTech?: string;
    explanationStory?: string;
    feynmanQuestions?: string;
    comments?: string;
    questionImage?: string;
    questionAudio?: string;
    questionType?: string;
    
    // Stats
    totalAttempts: number;
    masteryScore: number;
    stability: number;
    difficulty?: number;
    nextReviewDate: string;
    lastReviewedAt?: string;
    lastAttemptDate?: string;
    lastWasCorrect?: boolean;
    recentError?: number;
    correctStreak?: number;
    errorCount?: number;
    attemptHistory: Attempt[];
    masteryHistory?: { date: string; mastery: number }[];
    
    // Flags
    hotTopic?: boolean;
    isCritical?: boolean;
    isFundamental?: boolean;
    willFallExam?: boolean;
    isFavorite?: boolean;
    
    // Advanced / Trapscan
    guiaTrapscan?: string;
    keyDistinction?: string;
    anchorText?: string | Record<string, string>;
    wrongDiagnosis?: string | Record<string, string>;
    distractorProfile?: Record<string, string>;
    wrongDiagnosisMap?: Record<string, string>;
    
    // Linkage
    lawRef?: string;
    litRef?: string;
    
    // SRS
    srsStage?: number;
    srsVersion?: number;
    timeSec?: number;
    selfEvalLevel?: number;
    
    // Legacy / Misc
    sequenceNumber?: number;
    ignoreDuplicatesFor?: string[];
    difficultyLevel?: 'easy' | 'normal' | 'difficult';
    sourceSchema?: string;
    
    // Gap Support
    isGapType?: boolean;
    parentCard?: LiteralnessCard;
    importBatchId?: string;
    
    yourAnswer?: string;
    skill?: string;
    tags?: string[];

    // New Fields for Build Fixes
    rawImportBlock?: string;
    fingerprint?: string;
    createdAt?: string;
    studyRefs?: StudyRef[];
    lapses?: number;
}

export interface Flashcard {
    id: string;
    front: string;
    back: string;
    discipline: string;
    topic: string;
    type: 'basic' | 'cloze' | 'imageOcclusion';
    tags: string[];
    
    frontImage?: string;
    frontAudio?: string;
    backImage?: string;
    backAudio?: string;
    
    stability: number;
    masteryScore: number;
    nextReviewDate: string;
    lastReviewedAt?: string;
    totalAttempts: number;
    lastWasCorrect?: boolean;
    correctStreak?: number;
    recentError?: number;
    attemptHistory: Attempt[];
    masteryHistory?: { date: string; mastery: number }[];
    
    hotTopic?: boolean;
    isCritical?: boolean;
    isFundamental?: boolean;
    
    comments?: string;
    createdAt?: string;
    updatedAt?: string;
    bank?: string;
    source?: string;
    
    pairMatchPlayed?: boolean;
    dominioLevel?: number;
    lastGrade?: string;
    lapses?: number;
    
    litRef?: string;
    importBatchId?: string;
    
    lastAttemptDate?: string;
    timeSec?: number;
    selfEvalLevel?: number;
    
    lastTimeSec?: number;
    avgTimeSec?: number;
    domainDCache?: number;
    queroCair?: number;
    
    studyRefs?: StudyRef[];

    // New Fields for Build Fixes
    srsStage?: number;
    extra?: string;
}

export type LawContentType = 'LAW_DRY' | 'LAW_NORM' | 'LAW_JURIS';

export interface StudyStep {
    id: string;
    type: StudyStepType;
    title: string;
    content: string;
    enabled: boolean;
    completed?: boolean;
}

export type StudyStepType = 'READING' | 'PARTS_SUMMARY' | 'KEYWORDS_PROVA' | 'RISCO_FCC' | 'GANCHO' | 'EXPLANATION' | 'STORYTELLING' | 'FEYNMAN' | 'SUMMARY';

export interface Gap {
    id?: string;
    text: string;
    options?: { [key: string]: string };
    correct?: string;
    questionRef?: string;
}

export interface LiteralnessCard {
    id: string;
    lawId: string;
    article: string;
    topic: string;
    
    phase1Full: string;
    partsSummary?: string;
    keywordsProva?: string;
    riscoFcc?: string;
    gancho?: string;
    storytelling?: string;
    feynmanExplanation?: string;
    
    storytellingArticle?: string;
    feynmanArticle?: string;
    explain?: string;
    
    studyFlow?: StudyStep[];
    
    questionIds?: string[];
    extraGaps?: Gap[];
    phase2Lacuna?: string;
    phase2Options?: any;
    phase2Correct?: string;
    
    phase3Original?: string;
    phase3Variant?: string;
    
    domainPercent?: number;
    masteryScore: number;
    stability?: number;
    nextReviewDate: string;
    lastReviewedAt?: string;
    totalAttempts: number;
    lastResult?: number;
    
    createdAt: string;
    importBatchId?: string;
    contentType?: LawContentType;
    scope?: 'LEI_SECA' | 'TRILHA';
    schemaVersion?: number;
    
    visualColor?: 'default' | 'yellow' | 'orange' | 'red' | 'gray';
    isCritical?: boolean;
    
    batteryProgress?: number;
    progressionLevel?: number;
    userNotes?: string;
    
    lastCycleCompletedAt?: string;
    cycleProgress?: {
        readDone?: boolean;
        gapsDone?: boolean;
        questionsDone?: boolean;
        flashcardsDone?: boolean;
    };
    
    dominio?: number;

    // New Fields for Build Fixes
    pairsLastSessionErrors?: number;
    oneMinBestScore?: number;
}

export interface StudyRef {
    sourceType: 'LEI_SECA' | 'QUESTOES' | 'FLASHCARDS' | 'TRILHA';
    target: {
        cardId?: string;
        questionId?: string;
        flashcardId?: string;
        trailId?: string;
        lessonId?: string;
    };
    label?: string;
}

export type PriorityLevel = 'low' | 'medium' | 'high';

export interface SubjectConfig {
    priority: PriorityLevel;
    isFrozen?: boolean;
    isCritical?: boolean;
}

export interface TrapscanSessionConfig {
    enabled: boolean;
    assistMode: boolean;
    defaultMode: TrapscanMode;
    lockLevel: TrapscanLockLevel;
}

export type TrapscanMode = 'GUIA' | 'TREINO';
export type TrapscanLockLevel = 'SOFT' | 'HARD';

export interface AppSettings {
    userName?: string;
    appTheme: 'dark' | 'galaxy';
    enableBlackHoleEffect?: boolean;
    userXp: number;
    
    navOrder?: string[];
    quickAccessTools?: string[];
    
    questionsPerPage: number;
    enableTimer: boolean;
    studyTimerDuration: number;
    targetResponseTimeSec: number;
    timeSensitivity: number;
    srsIntervals: number[];
    
    useNewSrsLogic: boolean;
    srs: {
        rTarget: number;
        rNear: number;
        conservativeFactorOnExamDay: number;
        conservativeFactorOnExamEve: number;
        weights: {
            isHot: number;
            isFundamental: number;
            isCritical: number;
            recentError: number;
            lowS: number;
        };
    };
    srsV2: {
        time_target_sec: number;
        alpha_easy: number;
        alpha_good: number;
        alpha_hard: number;
        gamma_fail: number;
        rt_fast: number;
        rt_slow: number;
        k_rt_bonus: number;
        k_long_gap: number;
        target_R: number;
        min_interval_days: number;
        max_hot_days: number;
        S_default_days: number;
        cap_S_days: number;
        enableRetrievabilityCheck: boolean;
    };
    
    trapscan?: TrapscanSessionConfig;
    readerMode?: 'compact' | 'fullscreen';
    enableSoundEffects?: boolean;
    
    subjectConfigs: Record<string, SubjectConfig>;
    lawConfigs?: any;
    
    dailyActivityLog: DailyActivityLog;
    battleHistory?: BattleHistoryEntry[];
    pairMatchHistory?: PairMatchHistoryEntry[];
    gameRecords?: any[];
    
    goals: Goal[];
    
    enableUnlimitedMemory?: boolean;
    showNotesAfterAnswer?: boolean;
    showHistoryAfterAnswer?: boolean;
    showMissingExplainFields?: boolean;
    lockEarlyReview?: boolean;
    isPinLockEnabled?: boolean;
    pinHash?: string;
    studyProtocolMode?: string;
    alarms?: ReviewAlarm[];
    studyMode?: 'standard' | 'exam';
    examDate?: string;
    enableStandardPomodoro?: boolean;
    standardPomodoroFocusMinutes?: number;
    standardPomodoroBreakMinutes?: number;
    target_sec_default: number;
    
    literalnessHighScore?: number;
    wallet?: { coins: number; gems: number };
    streaks: { current: number; longest: number; lastActivity: string };
    
    battleEliminationWeight?: number;
    lightningHighScore?: number;
    
    sopGuardTypes?: string[];
    min_think_sec?: number;
    rush_threshold?: number;
    over_threshold?: number;
    sop_band_low?: number;
    sop_band_high?: number;
    lambda_ewma?: number;
    mad_alert_z?: number;
    window_n?: number;
    
    inventory?: any[];
    lastImportBatchId?: string;
    customColors?: { bg: string, text: string, surface: string };
    
    learning?: {
        srs: {
            enabled: boolean;
            maxLatenessDays: number;
            stabilityCapDays: number;
            decayLevel: number;
            gainLevel: number;
            penaltyLevel: number;
            failReviewDelayDays: number;
            successMinDelayDays: number;
            rTarget: number;
            rNear: number;
            conservativeFactorOnExamDay: number;
            conservativeFactorOnExamEve: number;
            weights: {
                isHot: number;
                isFundamental: number;
                isCritical: number;
                recentError: number;
                lowS: number;
            }
        };
        mastery: {
            enabled: boolean;
            diminishingReturns: boolean;
            maxGainPerSession: number;
            errorPenaltyLevel: number;
            weightsByActivity: {
                reading: number;
                questions: number;
                gaps: number;
                flashcards: number;
                pairs: number;
                onemin: number;
            }
        };
        overridesByActivity: any;
        keyStrategy: { mode: string };
        maintenance: any;
    };
    
    examMode?: {
        timePerQuestionSec: number;
        blockMinutes: number;
        breakMinutes: number;
        microSpacedHours: number[];
    };

    // New Fields for Build Fixes
    gamification?: GamificationSettings;
}

export type DailyTaskType = 'COMPLETE_QUESTIONS' | 'COMPLETE_FLASHCARDS' | 'PLAY_BATTLE' | 'PLAY_PAIR_MATCH' | 'FINISH_EXAM';
export type DailyActivityLog = Record<string, DailyTaskType[]>;

export interface ReviewAlarm {
    id: string;
    timeHHMM: string;
    label: string;
    message?: string;
    enabled: boolean;
    mode: 'weekly' | 'date';
    weekdays?: number[];
    dateISO?: string;
    createdAt: number;
    lastFiredAt?: number;
}

export interface BattleHistoryEntry {
    id: string;
    date: string;
    questionRef: string;
    score: number;
    wasCorrect: boolean;
    eliminatedCorrectly: number;
    eliminatedIncorrectly: number;
    eliminatedOptions: string[];
    finalAnswer: string | null;
    timeSec: number;
}

export interface PairMatchHistoryEntry {
    id: string;
    date: string;
    topicTitle: string;
    pairCount: number;
    totalTimeSec: number;
    totalClicks: number;
}

export interface GameRecord {
    topicTitle: string;
    pairCount: number;
    bestTimeSec: number;
    minClicks: number;
}

export type SubFilterType = 'all' | 'critical' | 'hot' | 'incorrect';

export interface Goal {
    id: string;
    type: 'review' | 'add';
    target: number;
    filter: {
        type: 'all' | 'subject' | 'topic' | 'bank' | 'position' | 'questionType' | 'area';
        value: string;
    };
    subFilter: SubFilterType;
}

export type LessonStatus = 'locked' | 'not_started' | 'in_progress' | 'review' | 'mastered';

export interface LessonNode {
    id: string;
    uid?: string;
    subjectId: string;
    title: string;
    code: string;
    order: number;
    status: LessonStatus;
    domainLevel: number;
    keyPoints: string[];
    summary: string[];
    explanations: string[];
    questionRefs?: string[];
    flashcardRefs?: string[];
    themeTag?: string;
    successRate?: number;
    lastSessionAt?: string;
    nextReviewAt?: string;
}

export interface SubjectTrail {
    id: string;
    lessons: LessonNode[];
    description?: string;
    themeImage?: string;
    themeTag?: string;
}

export interface AttemptReport {
    id: string;
    lessonId: string;
    practiceType: PracticeType;
    startedAt: string;
    finishedAt: string;
    totalItems: number;
    totalCorrect: number;
    totalWrong: number;
    accuracyPct: number;
    durationSec: number;
    wrongItems: WrongItemReport[];
}

export type PracticeType = 'QUESTOES' | 'FLASHCARDS' | 'LACUNAS' | 'PARES' | 'GERAL';

export interface WrongItemReport {
    itemId: string;
    qRef: string;
    text: string;
    userAnswer: string;
    correctAnswer: string;
    userAnswerText: string;
    correctAnswerText: string;
    explanation?: string;
    wrongDiagnosis?: string | Record<string, string>; // Allow objects (maps)
    subject: string;
    topic: string;
    timeSec?: number;
}

export interface SessionResult {
    id: string;
    title: string;
    startedAt: string;
    endedAt: string;
    totalQuestions: number;
    answeredCount: number;
    correctCount: number;
    wrongCount: number;
    accuracy: number;
    totalTimeSec: number;
    masteryGain: number;
    domainGain: number;
    performanceScore: number;
    isCompleted: boolean;
}

export interface TriggerStat {
    term: string;
    category: string;
    detected: boolean;
}

export interface TrapscanEntry {
    mode: 'GUIA' | 'TREINO';
    enabled: boolean;
    p0_pause: boolean;
    command: string;
    trapType: string;
    p3_cut: boolean;
    eliminatedOptions: string[];
    ruleText: string;
    prediction: string;
    p7_check: boolean;
    triggerStats: TriggerStat[];
    scriptChecks: string[];
    checklistState?: string[];
    detectedSuggestions?: {
        command: string;
        trap: string;
        confidence: number;
    };
    autoAnalysis?: TrapscanAutoAnalysis;
    evidenceMap?: TrapscanEvidenceMap;
    overrideUsed?: boolean;
    userMissReason?: string;
    decisiveRule?: string;
    unlockAtMs?: number;
    detectedCommand?: string;
    detectedTrap?: string;
    completedSteps?: number;
}

export interface TrapscanAutoAnalysis {
    suggestedCommand: string;
    suggestedTrap: string;
    confidence: number;
    reasons: string[];
    scores: Record<string, number>;
    triggersFound: string[];
    alertNegation: boolean;
    axisCandidates?: AxisCandidate[];
    keyQuestions?: { asksWho: boolean, asksWhat: boolean, asksException: boolean };
    decisiveRule?: string;
}

export interface AxisCandidate {
    axis: string;
    score: number;
    primaryReason: string;
    whyNotReasons?: string[];
}

export type TrapType = 'T' | 'R' | 'A' | 'P' | 'S' | 'C' | 'A2' | 'N' | 'SEM_DADO';

export interface TrapscanGuide {
    concept: string;
    pattern: string;
    triggers: string[];
    method: string[];
    training: string[];
    kpi: string;
}

export interface TrapscanPlan {
    axis: string;
    label: string;
    objective: string;
    cause: string;
    steps: string[];
    targetCount: number;
    estimatedTime: string;
}

export interface VulnerabilityStats {
    code: string;
    label: string;
    riskScore: number;
    errorRate: number;
    sampleSize: number;
    realError?: {
        userChoice: { p1: string; p2: string };
        correctChoice: { p1: string; p2: string };
        anchor: string;
        why: string;
    };
}

export interface NucleusStats {
    litRef: string;
    lawId: string;
    topic: string;
    totalAttempts: number;
    errorCount: number;
    errorRate: number;
    riskScore: number;
    topSignal: string;
    lastAttemptAt: string;
    lastErrorAt: string | null;
}

export interface DiagnosticSummary {
    situation: string;
    cause: string;
    impact: string;
}

export interface TrapscanQualityMetrics {
    eliminationEfficiency: number;
    didEliminateCorrect: boolean;
    isLuckyGuess: boolean;
    adherenceScore: number;
    processRating: 'PERFECT' | 'RISKY' | 'FAILED' | 'GOOD';
}

export interface TrapscanReport {
    period: number;
    kpis: {
        totalAttempts: number;
        accuracyQuestions: number | null;
        avgMastery: number;
        topErrorSubject: string;
        riskSubject: string;
        topErrorLitRef: string;
        p1Accuracy?: number | null;
        p2Accuracy?: number | null;
        eliminationRate?: number | null;
        dataConsistency: number;
        failureDominance: 'OPERATIONAL' | 'CONCEPTUAL';
    };
    signals: TrapSignal[];
    weakestNuclei: NucleusStats[];
    focusSuggestion: string;
    recommendedPlan: TrapscanPlan | null;
    diagnostic: DiagnosticSummary;
    vulnerabilities: VulnerabilityStats[];
    guides: Record<string, TrapscanGuide>;
}

export interface TrapSignal {
    id: string;
    code: TrapType;
    label: string;
    description: string;
    advice: string;
    riskScore: number;
    riskTrend: number;
    totalAttempts: number;
    errorCount: number;
    lastErrorAt: string | null;
    severity: 'low' | 'medium' | 'high';
    trend: 'improving' | 'stable' | 'worsening';
    confidence: number;
}

export interface EvidenceItem {
    term: string;
    axis: string;
    reason: string;
    confidence: number;
    color: string;
}

export interface TrapscanEvidenceMap {
    stem: EvidenceItem[];
    options: Record<string, EvidenceItem[]>;
}

export interface QueueFilters {
    subjects?: string[];
    topics?: string[];
    banks?: string[];
    areas?: string[];
    questionTypes?: string[];
    tags?: string[];
    isHot?: boolean;
    isFundamental?: boolean;
    isCritical?: boolean;
    recentError?: boolean;
    isFavorite?: boolean;
    isStudyLater?: boolean;
}

export interface QueueBuilderParams<T extends SrsItem> {
    mode: StudyMode;
    allItems: T[];
    settings: AppSettings;
    filters: QueueFilters;
    sessionSize: number;
    newContentLimit?: number;
    allowEarlyItems?: boolean;
}

export type StudyMode = 'standard' | 'exam' | 'critical';

export interface CalculatedItemMetrics<T extends SrsItem> {
    item: T;
    dt: number;
    R_now: number;
    D: number;
    priority_spaced: number;
    priority_exam: number;
    R_proj: number;
    dueReason?: 'due' | 'new';
}

export interface SessionKPIs {
    mode: StudyMode;
    filters: QueueFilters;
    mix: { due: number; nearDue: number; new: number; critical: number; total: number; pctNew: number; };
    targets: { R_target: number; timeBaseSec: number; };
    kpiPreview: { meanD: number; medianD: number; meanPriority: number; pctNew: number; };
}

export interface BuildStudyQueueResult<T extends SrsItem> {
    queue: CalculatedItemMetrics<T>[];
    kpis: SessionKPIs;
}

export interface SrsItem {
    id: string;
    nextReviewDate: string;
    stability: number;
    difficulty?: number;
    masteryScore: number;
    totalAttempts: number;
    lastWasCorrect?: boolean;
    recentError?: number;
    hotTopic?: boolean;
    isCritical?: boolean;
    isFundamental?: boolean;
    lastReviewedAt?: string;
    srsVersion?: number;
    attemptHistory: Attempt[];
    lastGrade?: string;
    lapses?: number;
}

export type ImportMode = 'SKIP' | 'MERGE' | 'OVERWRITE';

export interface ImportReport {
    importId: string;
    timestamp: string;
    summary: {
        status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';
        totalEntities: number;
        importedEntities: number;
        skippedEntities: number;
        normalizedEntities: number;
        errorsCount: number;
        warningsCount: number;
    };
    counts: {
        lawCards: ImportCountDetail;
        gaps: ImportCountDetail;
        questions: ImportCountDetail;
        flashcards: ImportCountDetail;
        pairs: ImportCountDetail;
    };
    details: ImportDetail[];
}

export interface ImportCountDetail {
    received: number;
    imported: number;
    skipped: number;
    normalized: number;
}

export type ImportEntityType = 'question' | 'flashcard' | 'lawCard' | 'gap' | 'pair' | 'module' | 'meta';

export interface ImportDetail {
    entityType: ImportEntityType;
    ref: string;
    action: 'IMPORTED' | 'SKIPPED' | 'NORMALIZED' | 'ERROR';
    reasonCode: string;
    message: string;
    path?: string;
    moduleId?: string;
}

export interface ImportStagingData {
    cards: LiteralnessCard[];
    questions: Question[];
    flashcards: Flashcard[];
    gaps: any[];
}

export interface ItemGameStats {
    itemId: string;
    attempts: number;
    errors: number;
    timeToMatchSec: number;
}

export interface GameResult {
    statsByItem: ItemGameStats[];
    totalPairs: number;
    foundPairs: number;
    totalClicks: number;
    totalTimeSec: number;
}

export type BadgeID = 'streak_7' | 'streak_30' | 'master_100' | 'explorer';

export interface Badge {
    id: BadgeID;
    name: string;
    description: string;
    icon: string;
    unlockedAt?: string;
}

export interface DailyXp {
    date: string;
    xp: number;
    breakdown: PointBreakdown;
}

export interface PointBreakdown {
    reviews: number;
    perfectBonus: number;
    streakBonus: number;
    battleWins: number;
    newContent: number;
}

export interface UserProfile {
    level: number;
    currentXp: number;
    totalXp: number;
    streak: number;
    badges: Badge[];
    dailyHistory: DailyXp[];
    avatar?: string;
}

export interface GamificationSettings {
    enabled: boolean;
    dailyGoalXp: number;
    soundEnabled: boolean;
}

export interface NodeAgg {
    id: string;
    label: string;
    masteryAll: number;
    isOverdue: boolean;
    errorCount: number;
    criticalCount: number;
    markedCount: number;
    total: number;
}

export type DominioLevel = 1 | 2 | 3 | 4;

export interface Topic {
    id: string;
    name: string;
    subject: string;
    description?: string;
}

export interface SystemLog {
    id: string;
    timestamp: number;
    type: 'error' | 'info' | 'warn';
    message: string;
    details?: string;
}
