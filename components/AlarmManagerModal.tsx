
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ReviewAlarm } from '../types';
import { AlarmIcon, TrashIcon, PlusIcon, XMarkIcon, CheckCircleIcon, ClockIcon, BellIcon } from './icons';
import { useSettings } from '../contexts/SettingsContext';

interface AlarmManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const WeekdaySelector: React.FC<{
    selected: number[];
    onChange: (days: number[]) => void;
}> = ({ selected, onChange }) => {
    const days = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    
    const toggleDay = (dayIndex: number) => {
        if (selected.includes(dayIndex)) {
            onChange(selected.filter(d => d !== dayIndex));
        } else {
            onChange([...selected, dayIndex].sort());
        }
    };

    return (
        <div className="flex gap-2 justify-between">
            {days.map((label, idx) => (
                <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                        selected.includes(idx)
                            ? 'bg-sky-500 text-white shadow-md scale-110'
                            : 'bg-bunker-100 dark:bg-bunker-800 text-bunker-500 dark:text-bunker-400 hover:bg-bunker-200 dark:hover:bg-bunker-700'
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
};

const AlarmItem: React.FC<{
    alarm: ReviewAlarm;
    onToggle: () => void;
    onDelete: () => void;
}> = ({ alarm, onToggle, onDelete }) => {
    const daysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    const getFrequencyText = () => {
        if (alarm.mode === 'date') {
            if (!alarm.dateISO) return 'Data inválida';
            const [y, m, d] = alarm.dateISO.split('-');
            return `${d}/${m}/${y}`;
        }
        if (!alarm.weekdays || alarm.weekdays.length === 0) return 'Nunca';
        if (alarm.weekdays.length === 7) return 'Todos os dias';
        if (alarm.weekdays.length === 2 && alarm.weekdays.includes(0) && alarm.weekdays.includes(6)) return 'Fins de semana';
        if (alarm.weekdays.length === 5 && !alarm.weekdays.includes(0) && !alarm.weekdays.includes(6)) return 'Dias úteis';
        
        return alarm.weekdays.map(d => daysMap[d]).join(', ');
    };

    return (
        <div className="flex items-center justify-between p-3 bg-white dark:bg-bunker-900 border border-bunker-200 dark:border-bunker-800 rounded-xl shadow-sm mb-3">
            <div>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-200 font-mono tracking-tight">
                        {alarm.timeHHMM}
                    </span>
                    {alarm.label && (
                        <span className="text-xs bg-bunker-100 dark:bg-bunker-800 text-bunker-600 dark:text-bunker-300 px-2 py-0.5 rounded-md font-medium truncate max-w-[120px]">
                            {alarm.label}
                        </span>
                    )}
                </div>
                <p className="text-xs text-bunker-500 dark:text-bunker-400 mt-1">
                    {getFrequencyText()}
                </p>
            </div>
            
            <div className="flex items-center gap-4">
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={alarm.enabled} onChange={onToggle} className="sr-only peer" />
                    <div className="w-9 h-5 bg-bunker-300 peer-focus:outline-none rounded-full peer dark:bg-bunker-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                </label>
                <button 
                    onClick={onDelete}
                    className="p-2 text-bunker-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const AlarmManagerModal: React.FC<AlarmManagerModalProps> = ({ isOpen, onClose }) => {
    const { settings, addAlarm, updateAlarm, deleteAlarm, requestNotificationPermission } = useSettings();
    const [view, setView] = useState<'list' | 'add'>('list');
    
    // Permission State
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );

    useEffect(() => {
        if (isOpen && typeof Notification !== 'undefined') {
            setPermissionStatus(Notification.permission);
        }
    }, [isOpen]);
    
    // Form State
    const [time, setTime] = useState('09:00');
    const [label, setLabel] = useState('');
    const [message, setMessage] = useState('');
    const [mode, setMode] = useState<'weekly' | 'date'>('weekly');
    const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
    const [dateISO, setDateISO] = useState(new Date().toISOString().split('T')[0]);

    if (!isOpen) return null;

    const handleRequestPermission = async () => {
        const granted = await requestNotificationPermission();
        setPermissionStatus(granted ? 'granted' : 'denied');
    };

    const handleSave = async () => {
        const hasPermission = await requestNotificationPermission();
        setPermissionStatus(Notification.permission);

        if (!hasPermission) {
            alert('Você precisa permitir notificações para que o alarme funcione.');
            return;
        }

        if (mode === 'weekly' && weekdays.length === 0) {
            alert('Selecione pelo menos um dia da semana.');
            return;
        }

        addAlarm({
            timeHHMM: time,
            label: label || 'Revisão',
            message: message || undefined,
            mode,
            weekdays: mode === 'weekly' ? weekdays : undefined,
            dateISO: mode === 'date' ? dateISO : undefined,
            enabled: true,
        });
        
        resetForm();
        setView('list');
    };

    const resetForm = () => {
        setTime('09:00');
        setLabel('');
        setMessage('');
        setMode('weekly');
        setWeekdays([1, 2, 3, 4, 5]);
        setDateISO(new Date().toISOString().split('T')[0]);
    };

    const activeAlarmsCount = settings.alarms?.filter(a => a.enabled).length || 0;

    const modalContent = (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-bunker-50 dark:bg-bunker-950 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-4 border-b border-bunker-200 dark:border-bunker-800 flex justify-between items-center bg-white dark:bg-bunker-900 sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg">
                            <AlarmIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">Despertador</h3>
                            <p className="text-xs text-bunker-500 dark:text-bunker-400">
                                {activeAlarmsCount} ativos
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-bunker-100 dark:hover:bg-bunker-800 transition-colors">
                        <XMarkIcon />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {view === 'list' ? (
                        <div className="space-y-4">
                             {/* Permission Warning */}
                            {permissionStatus !== 'granted' && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/50 flex flex-col gap-2">
                                    <div className="flex items-start gap-3">
                                        <div className="p-1.5 bg-amber-100 dark:bg-amber-800 rounded-full text-amber-600 dark:text-amber-400 mt-0.5">
                                            <BellIcon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Notificações Necessárias</p>
                                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 leading-relaxed">
                                                {permissionStatus === 'denied' 
                                                    ? 'O acesso foi bloqueado. Ative as notificações nas configurações do seu navegador para usar o despertador.' 
                                                    : 'Ative as notificações para receber os lembretes de revisão nos horários definidos.'}
                                            </p>
                                        </div>
                                    </div>
                                    {permissionStatus === 'default' && (
                                        <button 
                                            onClick={handleRequestPermission}
                                            className="self-end px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-md transition-colors shadow-sm"
                                        >
                                            Ativar Agora
                                        </button>
                                    )}
                                </div>
                            )}

                            {(!settings.alarms || settings.alarms.length === 0) ? (
                                <div className="text-center py-10 text-bunker-400">
                                    <ClockIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Nenhum alarme configurado.</p>
                                </div>
                            ) : (
                                settings.alarms.map(alarm => (
                                    <AlarmItem 
                                        key={alarm.id} 
                                        alarm={alarm} 
                                        onToggle={() => updateAlarm(alarm.id, { enabled: !alarm.enabled })}
                                        onDelete={() => deleteAlarm(alarm.id)}
                                    />
                                ))
                            )}
                            
                            <div className="bg-sky-50 dark:bg-sky-900/10 p-3 rounded-lg border border-sky-100 dark:border-sky-800 text-xs text-sky-700 dark:text-sky-300">
                                <p><strong>Nota:</strong> Para garantir que o alarme toque, instale o app (PWA) e mantenha as notificações do sistema ativadas.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-fade-in">
                            {/* Time Picker */}
                            <div className="flex justify-center mb-6">
                                <input 
                                    type="time" 
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="text-5xl font-mono font-bold bg-transparent text-slate-800 dark:text-white border-b-2 border-indigo-500 focus:outline-none p-2 text-center w-40"
                                />
                            </div>

                            {/* Label */}
                            <div>
                                <label className="block text-xs font-bold text-bunker-500 dark:text-bunker-400 uppercase mb-1">Nome do Alarme</label>
                                <input 
                                    value={label}
                                    onChange={e => setLabel(e.target.value)}
                                    placeholder="Ex: Revisão Manhã"
                                    className="w-full bg-white dark:bg-bunker-900 border border-bunker-200 dark:border-bunker-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            {/* Mode Toggle */}
                            <div>
                                <label className="block text-xs font-bold text-bunker-500 dark:text-bunker-400 uppercase mb-2">Frequência</label>
                                <div className="flex bg-bunker-100 dark:bg-bunker-800 p-1 rounded-lg">
                                    <button 
                                        type="button"
                                        onClick={() => setMode('weekly')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mode === 'weekly' ? 'bg-white dark:bg-bunker-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-bunker-500'}`}
                                    >
                                        Semanal
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setMode('date')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mode === 'date' ? 'bg-white dark:bg-bunker-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-bunker-500'}`}
                                    >
                                        Data Única
                                    </button>
                                </div>
                            </div>

                            {/* Specific selectors */}
                            {mode === 'weekly' ? (
                                <WeekdaySelector selected={weekdays} onChange={setWeekdays} />
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-bunker-500 dark:text-bunker-400 uppercase mb-1">Data</label>
                                    <input 
                                        type="date"
                                        value={dateISO}
                                        onChange={e => setDateISO(e.target.value)}
                                        className="w-full bg-white dark:bg-bunker-900 border border-bunker-200 dark:border-bunker-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            )}

                            {/* Optional Message */}
                            <div>
                                <label className="block text-xs font-bold text-bunker-500 dark:text-bunker-400 uppercase mb-1">Mensagem (Opcional)</label>
                                <input 
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Ex: Foco total em Tributário!"
                                    className="w-full bg-white dark:bg-bunker-900 border border-bunker-200 dark:border-bunker-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-bunker-200 dark:border-bunker-800 bg-white dark:bg-bunker-900 flex gap-3">
                    {view === 'list' ? (
                        <button 
                            onClick={() => setView('add')}
                            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-500 transition-all flex items-center justify-center gap-2"
                        >
                            <PlusIcon className="w-5 h-5" /> Novo Alarme
                        </button>
                    ) : (
                        <>
                            <button 
                                onClick={() => setView('list')}
                                className="flex-1 py-3 font-bold text-bunker-500 hover:bg-bunker-100 dark:hover:bg-bunker-800 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                className="flex-[2] bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircleIcon className="w-5 h-5" /> Salvar
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlarmManagerModal;
