/**
 * Morphin Time: Ranger AR Studio - Audio Synthesizer
 * Procedural sci-fi sound effects using HTML5 Web Audio API
 * No external audio files needed!
 */

class RangerAudio {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.volume = 0.7;
        this.masterGain = null;
        this.chargeOsc = null;
        this.chargeGain = null;
        this.chargeLfo = null;
        this.isCharging = false;
        this.bgmOsc = null;
        this.bgmGain = null;
        this.isBgmPlaying = false;
    }

    init() {
        if (this.ctx) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
        } catch (e) {
            console.warn("Web Audio API not supported on this browser", e);
        }
    }

    ensureContext() {
        if (!this.ctx) {
            this.init();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
        }
    }

    toggleMute() {
        this.setMuted(!this.isMuted);
        return this.isMuted;
    }

    // Continuous rising charge hum as gesture is held
    startChargeHum() {
        this.ensureContext();
        if (!this.ctx || this.isCharging) return;
        this.isCharging = true;

        const now = this.ctx.currentTime;
        
        this.chargeOsc = this.ctx.createOscillator();
        this.chargeOsc.type = 'sawtooth';
        this.chargeOsc.frequency.setValueAtTime(110, now);

        // Lowpass filter to smooth the sawtooth
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now);

        // LFO for tension tremolo
        this.chargeLfo = this.ctx.createOscillator();
        this.chargeLfo.frequency.setValueAtTime(8, now);
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(15, now);
        this.chargeLfo.connect(lfoGain);
        lfoGain.connect(this.chargeOsc.frequency);

        this.chargeGain = this.ctx.createGain();
        this.chargeGain.gain.setValueAtTime(0.01, now);
        this.chargeGain.gain.linearRampToValueAtTime(0.22, now + 0.15);

        this.chargeOsc.connect(filter);
        filter.connect(this.chargeGain);
        this.chargeGain.connect(this.masterGain);

        this.chargeOsc.start(now);
        this.chargeLfo.start(now);
    }

    updateChargeHum(progress) {
        if (!this.ctx || !this.isCharging || !this.chargeOsc) return;
        const now = this.ctx.currentTime;
        const targetFreq = 120 + progress * 580; // 120Hz up to 700Hz
        this.chargeOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);

        if (this.chargeLfo) {
            this.chargeLfo.frequency.setTargetAtTime(8 + progress * 24, now, 0.05);
        }
        if (this.chargeGain) {
            this.chargeGain.gain.setTargetAtTime(0.18 + progress * 0.18, now, 0.05);
        }
    }

    stopChargeHum() {
        if (!this.isCharging) return;
        this.isCharging = false;
        if (this.chargeGain && this.ctx) {
            const now = this.ctx.currentTime;
            this.chargeGain.gain.linearRampToValueAtTime(0.001, now + 0.1);
            setTimeout(() => {
                try {
                    if (this.chargeOsc) { this.chargeOsc.stop(); this.chargeOsc.disconnect(); }
                    if (this.chargeLfo) { this.chargeLfo.stop(); this.chargeLfo.disconnect(); }
                } catch(e) {}
                this.chargeOsc = null;
                this.chargeGain = null;
                this.chargeLfo = null;
            }, 120);
        }
    }

    // Epic superhero transformation fanfare
    playMorphSound(rangerType = 'red') {
        this.ensureContext();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // 1. Sub-bass punch drop
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(140, now);
        subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.45);
        subGain.gain.setValueAtTime(0.65, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        subOsc.connect(subGain);
        subGain.connect(this.masterGain);
        subOsc.start(now);
        subOsc.stop(now + 0.7);

        // 2. Multi-tone heroic power chord based on Ranger
        let chords = [];
        if (rangerType === 'red') {
            // Tyranno: Bold brassy triad [C4, G4, C5, Eb5]
            chords = [261.63, 392.00, 523.25, 622.25];
        } else if (rangerType === 'blue') {
            // Tricera: High-tech crystalline major 7th [D4, F#4, A4, C#5]
            chords = [293.66, 369.99, 440.00, 554.37];
        } else if (rangerType === 'yellow') {
            // Sabertooth: Electric rapid pentatonic [E4, G4, A4, B4, E5]
            chords = [329.63, 392.00, 440.00, 493.88, 659.25];
        } else if (rangerType === 'green') {
            // Dragon: Mysterious majestic fifths & flutey resonance [D4, A4, D5, F#5]
            chords = [293.66, 440.00, 587.33, 739.99];
        }

        chords.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = (rangerType === 'green') ? 'sine' : 'sawtooth';
            
            // Staggered arpeggiated entrance
            const noteStart = now + idx * 0.045;
            osc.frequency.setValueAtTime(freq * 0.9, noteStart);
            osc.frequency.exponentialRampToValueAtTime(freq, noteStart + 0.08);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(600, noteStart);
            filter.frequency.exponentialRampToValueAtTime(4500, noteStart + 0.35);

            gain.gain.setValueAtTime(0.001, noteStart);
            gain.gain.linearRampToValueAtTime(0.28 / chords.length, noteStart + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 1.4);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(noteStart);
            osc.stop(noteStart + 1.5);
        });

        // 3. Electrical lightning energy sizzle
        this.playNoiseBurst(0.4, 0.25, 2000);
    }

    playNoiseBurst(duration = 0.3, volume = 0.2, filterFreq = 1500) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(filterFreq, now);
        filter.Q.setValueAtTime(3.0, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
    }

    playLaserSfx(pitch = 1.0) {
        this.ensureContext();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        const startFreq = 880 * pitch;
        const endFreq = 95 * pitch;

        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.16);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.18);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    playExplosionSfx(scale = 1.0) {
        this.ensureContext();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Sub thud
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(110, now);
        sub.frequency.exponentialRampToValueAtTime(25, now + 0.35);
        subGain.gain.setValueAtTime(0.45 * scale, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        sub.connect(subGain);
        subGain.connect(this.masterGain);
        sub.start(now);
        sub.stop(now + 0.45);

        // Noise crunch
        this.playNoiseBurst(0.35 * scale, 0.32 * scale, 850);
    }

    playDemorphSound() {
        this.ensureContext();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.55);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.65);
    }

    playComboSfx(comboCount = 2) {
        this.ensureContext();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const baseFreq = 440;
        const multiplier = 1 + Math.min(comboCount * 0.12, 1.5);
        osc.frequency.setValueAtTime(baseFreq * multiplier, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * multiplier * 1.5, now + 0.12);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.3);
    }
}

// Global audio singleton
window.rangerAudio = new RangerAudio();
