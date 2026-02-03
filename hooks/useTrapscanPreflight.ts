
import { useState, useCallback } from 'react';
import { AppSettings, TrapscanMode, TrapscanLockLevel, TrapscanSessionConfig } from '../types';

export const useTrapscanPreflight = (settings: AppSettings) => {
    const [isPreflightOpen, setIsPreflightOpen] = useState(true);
    const [sessionConfig, setSessionConfig] = useState<TrapscanSessionConfig | null>(null);

    // Initial check: if Trapscan is globally disabled, we might still want to show pre-flight 
    // to allow user to enable it for this session.
    // However, if the user has explicitly set "Don't show again" logic (not implemented yet), we would skip.
    // For now, we always show it on mount.

    const handleConfirmPreflight = useCallback((config: TrapscanSessionConfig) => {
        setSessionConfig(config);
        setIsPreflightOpen(false);
    }, []);

    const handleOpenPreflight = useCallback(() => {
        setIsPreflightOpen(true);
    }, []);

    // If preflight hasn't run, we use defaults from settings, but we might block UI.
    // The consuming component should check `isPreflightOpen` to block UI.
    const activeConfig = sessionConfig || (settings.trapscan as TrapscanSessionConfig) || {
        enabled: true,
        assistMode: true,
        defaultMode: 'TREINO',
        lockLevel: 'SOFT'
    };

    return {
        isPreflightOpen,
        sessionConfig: activeConfig,
        handleConfirmPreflight,
        handleOpenPreflight
    };
};