
// Retro Audio Service using Web Audio API for 8-bit style SFX
// No external assets required, pure synthesis for performance.

class RetroAudioManager {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private enabled: boolean = true;
    private volume: number = 0.5;

    constructor() {
        try {
            const savedEnabled = localStorage.getItem('retro_arcade_sound_enabled');
            const savedVolume = localStorage.getItem('retro_arcade_sound_volume');
            
            this.enabled = savedEnabled !== 'false';
            this.volume = savedVolume ? parseFloat(savedVolume) : 0.5;
        } catch (e) {
            console.warn("Audio storage access failed", e);
        }
    }

    private init() {
        if (!this.ctx) {
            const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
                this.masterGain = this.ctx.createGain();
                this.masterGain.connect(this.ctx.destination);
                this.masterGain.gain.value = this.volume;
            }
        }
    }

    public unlock() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        } else if (!this.ctx) {
            this.init();
        }
    }

    public setEnabled(enabled: boolean) {
        this.enabled = enabled;
        localStorage.setItem('retro_arcade_sound_enabled', String(enabled));
        if (!enabled && this.ctx) {
            this.ctx.suspend();
        } else if (enabled && this.ctx) {
            this.ctx.resume();
        }
    }

    public setVolume(val: number) {
        this.volume = Math.max(0, Math.min(1, val));
        localStorage.setItem('retro_arcade_sound_volume', String(this.volume));
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx?.currentTime || 0);
        }
    }

    public getSettings() {
        return { enabled: this.enabled, volume: this.volume };
    }

    private playTone(freq: number, type: OscillatorType, duration: number, startTime: number = 0) {
        if (!this.enabled || !this.ctx || !this.masterGain) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    // --- SFX PRESETS ---

    public play(sfx: 'COIN' | 'SELECT' | 'START' | 'CORRECT' | 'WRONG' | 'COMBO' | 'DAMAGE' | 'LEVELUP') {
        this.unlock();
        if (!this.enabled || !this.ctx) return;

        const t = this.ctx.currentTime;

        switch (sfx) {
            case 'COIN':
                this.playTone(987.77, 'square', 0.1, 0); // B5
                this.playTone(1318.51, 'square', 0.2, 0.1); // E6
                break;
            case 'SELECT':
                this.playTone(440, 'triangle', 0.05);
                break;
            case 'START':
                this.playTone(440, 'square', 0.1, 0);
                this.playTone(554, 'square', 0.1, 0.1);
                this.playTone(659, 'square', 0.2, 0.2);
                break;
            case 'CORRECT':
                this.playTone(880, 'square', 0.1, 0);
                this.playTone(1108, 'square', 0.1, 0.1); // High pitch jump
                break;
            case 'WRONG':
                this.playTone(150, 'sawtooth', 0.15, 0);
                this.playTone(100, 'sawtooth', 0.2, 0.15); // Low buzz
                break;
            case 'COMBO':
                this.playTone(523.25, 'sine', 0.1, 0);
                this.playTone(659.25, 'sine', 0.1, 0.08);
                this.playTone(783.99, 'sine', 0.1, 0.16);
                this.playTone(1046.50, 'sine', 0.2, 0.24);
                break;
            case 'DAMAGE':
                // Noise buffer simulation using random freq sawtooths
                this.playTone(100, 'sawtooth', 0.1, 0);
                this.playTone(80, 'sawtooth', 0.1, 0.05);
                this.playTone(60, 'sawtooth', 0.2, 0.1);
                break;
            case 'LEVELUP':
                [440, 554, 659, 880, 1108, 1318].forEach((f, i) => {
                    this.playTone(f, 'square', 0.1, i * 0.08);
                });
                break;
        }
    }
}

export const retroAudio = new RetroAudioManager();
