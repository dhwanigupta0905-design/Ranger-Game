/**
 * Morphin Time: Ranger AR Studio - Master Controller
 * Handles MediaPipe Hands & Face Detection, Webcam streaming,
 * Cyber-HUD skeleton rendering, AR tracking loop, and Demo simulation mode.
 */

class MorphinApp {
    constructor() {
        this.video = document.getElementById('webcam-video');
        this.canvas = document.getElementById('ar-canvas');
        this.ctx = this.canvas.getContext('2d');

        // State
        this.currentRanger = null;
        this.isStreamActive = false;
        this.isDemoMode = false;
        this.isCameraMirrored = true;
        this.lastFrameTime = performance.now();
        this.fps = 0;
        this.frameCount = 0;
        this.fpsTimer = performance.now();

        // MediaPipe Instances
        this.handsDetector = null;
        this.faceDetector = null;
        this.isHandsReady = false;
        this.isFaceReady = false;

        // Latest detection results
        this.latestHandsResult = null;
        this.latestFaceResult = null;
        this.isProcessingFrame = false;

        // Simulated Demo Mode Data
        this.demoState = {
            face: { xCenter: 0.5, yCenter: 0.38, width: 0.32, height: 0.38, angle: 0 },
            hand: { x: 0.5, y: 0.72 },
            gesture: 'none',
            simTimer: 0,
            mouseX: 0.5,
            mouseY: 0.7
        };

        // Hand skeleton connection topology (MediaPipe standard)
        this.HAND_CONNECTIONS = [
            // Thumb
            [0, 1], [1, 2], [2, 3], [3, 4],
            // Index
            [0, 5], [5, 6], [6, 7], [7, 8],
            // Middle
            [0, 9], [9, 10], [10, 11], [11, 12],
            // Ring
            [0, 13], [13, 14], [14, 15], [15, 16],
            // Pinky
            [0, 17], [17, 18], [18, 19], [19, 20],
            // Palm base
            [5, 9], [9, 13], [13, 17]
        ];

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Connect Gesture Engine callbacks
        window.rangerGestureEngine.onMorphTriggered = (rangerId) => this.morphIntoRanger(rangerId);
        window.rangerGestureEngine.onDemorphTriggered = () => this.demorph();

        // Connect Battle Game stats callback
        window.rangerBattleGame.onStatsUpdate = (stats) => this.updateBattleHUD(stats);

        // Initialize MediaPipe AI models
        await this.initMediaPipe();

        // Try opening webcam feed
        this.startWebcam();

        // Start render loop
        requestAnimationFrame((t) => this.renderLoop(t));
    }

    resizeCanvas() {
        const container = document.getElementById('canvas-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    get displayWidth() {
        return this.canvas.width / (window.devicePixelRatio || 1);
    }

    get displayHeight() {
        return this.canvas.height / (window.devicePixelRatio || 1);
    }

    async initMediaPipe() {
        this.updateStatus('INITIALIZING MORPHIN GRID NEURAL AI...', 'warn');

        try {
            // Check if MediaPipe is available from CDN
            if (typeof window.Hands !== 'undefined') {
                this.handsDetector = new window.Hands({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                });

                this.handsDetector.setOptions({
                    maxNumHands: 2,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.6,
                    minTrackingConfidence: 0.55
                });

                this.handsDetector.onResults((results) => {
                    this.latestHandsResult = results;
                });
                this.isHandsReady = true;
            }

            if (typeof window.FaceDetection !== 'undefined') {
                this.faceDetector = new window.FaceDetection({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
                });

                this.faceDetector.setOptions({
                    model: 'short',
                    minDetectionConfidence: 0.6
                });

                this.faceDetector.onResults((results) => {
                    this.latestFaceResult = results;
                });
                this.isFaceReady = true;
            }

            console.log("MediaPipe initialized successfully!");
            this.updateStatus('MORPHIN GRID SENSORS ONLINE', 'ready');
        } catch (e) {
            console.warn("Failed to load MediaPipe models:", e);
            this.updateStatus('NEURAL GRID OFFLINE (USE DEMO MODE)', 'error');
        }
    }

    async startWebcam() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            });

            this.video.srcObject = stream;
            await this.video.play();
            this.isStreamActive = true;
            this.isDemoMode = false;
            document.getElementById('camera-error-modal').classList.add('hidden');
            this.updateStatus('SYSTEM READY - MAKE A MORPHIN GESTURE', 'ready');
        } catch (err) {
            console.warn("Webcam access denied or unavailable:", err);
            this.isStreamActive = false;
            // Show interactive error modal with 1-click fallback
            document.getElementById('camera-error-modal').classList.remove('hidden');
            this.updateStatus('WEBCAM OFFLINE - DEMO SIMULATION READY', 'warn');
        }
    }

    startDemoMode() {
        this.isDemoMode = true;
        this.isStreamActive = false;
        document.getElementById('camera-error-modal').classList.add('hidden');
        this.updateStatus('DEMO SIMULATION ACTIVE - SELECT GESTURES BELOW', 'ready');
        // Unmute and start ambient synth
        window.rangerAudio.ensureContext();
    }

    morphIntoRanger(rangerId) {
        const config = window.rangerGestureEngine.RANGER_CONFIG[rangerId];
        if (!config) return;

        this.currentRanger = rangerId;
        window.rangerARRenderer.triggerTransformationSequence(rangerId, config);
        window.rangerAudio.playMorphSound(rangerId);

        // Update HUD
        const banner = document.getElementById('status-banner');
        banner.textContent = `${config.name.toUpperCase()} - ${config.mode.toUpperCase()} ACTIVE!`;
        banner.style.borderColor = config.themeColor;
        banner.style.boxShadow = `0 0 25px ${config.glowColor}`;
        banner.style.color = config.accentColor;

        document.getElementById('demorph-btn').classList.remove('hidden');

        // Play brief CSS screen flash
        const flashOverlay = document.getElementById('screen-flash');
        if (flashOverlay) {
            flashOverlay.style.background = config.themeColor;
            flashOverlay.classList.remove('animate-flash');
            void flashOverlay.offsetWidth; // trigger reflow
            flashOverlay.classList.add('animate-flash');
        }
    }

    demorph() {
        if (!this.currentRanger) return;
        this.currentRanger = null;
        window.rangerAudio.playDemorphSound();

        const banner = document.getElementById('status-banner');
        banner.textContent = 'CIVILIAN MODE - STANDBY';
        banner.style.borderColor = 'rgba(0, 229, 255, 0.4)';
        banner.style.boxShadow = 'none';
        banner.style.color = '#00E5FF';

        document.getElementById('demorph-btn').classList.add('hidden');
    }

    // Main animation & rendering loop
    async renderLoop(now) {
        const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
        this.lastFrameTime = now;

        // Calculate FPS
        this.frameCount++;
        if (now - this.fpsTimer > 500) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
            this.frameCount = 0;
            this.fpsTimer = now;
            const fpsEl = document.getElementById('fps-counter');
            if (fpsEl) fpsEl.textContent = `FPS: ${this.fps}`;
        }

        const width = this.displayWidth;
        const height = this.displayHeight;
        this.ctx.clearRect(0, 0, width, height);

        // 1. Process Video Frame if Webcam active
        if (this.isStreamActive && this.video.readyState >= 2 && !this.isProcessingFrame) {
            this.isProcessingFrame = true;
            Promise.all([
                this.isHandsReady ? this.handsDetector.send({ image: this.video }) : Promise.resolve(),
                this.isFaceReady ? this.faceDetector.send({ image: this.video }) : Promise.resolve()
            ]).finally(() => {
                this.isProcessingFrame = false;
            });
        }

        // 2. Draw Video Background / Demo background
        if (this.isStreamActive && this.video.readyState >= 2) {
            this.ctx.save();
            if (this.isCameraMirrored) {
                // Mirror horizontally
                this.ctx.translate(width, 0);
                this.ctx.scale(-1, 1);
            }
            this.ctx.drawImage(this.video, 0, 0, width, height);
            this.ctx.restore();
        } else {
            // Draw Sci-Fi Command Center Grid background for demo mode
            this.renderDemoBackground(width, height, now);
        }

        // 3. Process Gesture & Face tracking data
        let processedHandData = null;
        let activeConfig = this.currentRanger ? window.rangerGestureEngine.RANGER_CONFIG[this.currentRanger] : null;

        if (this.isDemoMode) {
            // Update simulated demo state
            processedHandData = this.updateDemoSimulation(dt, width, height);
        } else {
            // Extract MediaPipe results
            if (this.latestFaceResult && this.latestFaceResult.detections && this.latestFaceResult.detections.length > 0) {
                const det = this.latestFaceResult.detections[0];
                // Invert x if mirrored
                const adjustedDet = {
                    boundingBox: {
                        xCenter: this.isCameraMirrored ? (1.0 - det.boundingBox.xCenter) : det.boundingBox.xCenter,
                        yCenter: det.boundingBox.yCenter,
                        width: det.boundingBox.width,
                        height: det.boundingBox.height
                    },
                    landmarks: det.landmarks ? det.landmarks.map(lm => ({
                        x: this.isCameraMirrored ? (1.0 - lm.x) : lm.x,
                        y: lm.y
                    })) : []
                };
                window.rangerARRenderer.updateFace(adjustedDet, width, height);
            } else {
                window.rangerARRenderer.updateFace(null, width, height);
            }

            // Extract hand landmarks & mirror coordinates
            if (this.latestHandsResult && this.latestHandsResult.multiHandLandmarks) {
                const mirroredHands = this.latestHandsResult.multiHandLandmarks.map(hand => {
                    return hand.map(pt => ({
                        x: this.isCameraMirrored ? (1.0 - pt.x) : pt.x,
                        y: pt.y,
                        z: pt.z
                    }));
                });

                processedHandData = window.rangerGestureEngine.processHands(mirroredHands);

                // Draw glowing Cyber-HUD Hand Skeleton
                this.renderCyberSkeleton(mirroredHands, width, height, activeConfig);
            } else {
                processedHandData = window.rangerGestureEngine.processHands([]);
            }
        }

        // 4. Update and Render AR Helmet & Visor Overlays
        window.rangerARRenderer.renderARScene(this.ctx, width, height, this.currentRanger, activeConfig, dt);

        // 5. Draw Hold-to-Charge Progress Ring
        if (processedHandData && processedHandData.isCharging) {
            const targetConfig = processedHandData.ranger ?
                window.rangerGestureEngine.RANGER_CONFIG[processedHandData.ranger] : activeConfig;
            window.rangerARRenderer.renderChargeRing(this.ctx, width, height, processedHandData, targetConfig);
        }

        // 6. Update and Render "Defend the Command Center" Battle Mode
        window.rangerBattleGame.update(dt, width, height, processedHandData, this.currentRanger, activeConfig);
        window.rangerBattleGame.render(this.ctx, width, height, processedHandData, this.currentRanger, activeConfig);

        // 7. Update Gesture Legend HUD highlight
        this.updateGestureLegendHUD(processedHandData ? processedHandData.gesture : 'none');

        requestAnimationFrame((t) => this.renderLoop(t));
    }

    // Render glowing cybernetic hand skeleton
    renderCyberSkeleton(multiHands, width, height, activeConfig) {
        const themeColor = activeConfig ? activeConfig.themeColor : '#00E5FF';
        const accentColor = activeConfig ? activeConfig.accentColor : '#FFFFFF';

        this.ctx.save();
        this.ctx.shadowColor = themeColor;
        this.ctx.shadowBlur = 10;

        for (const hand of multiHands) {
            // Draw connecting bones
            this.ctx.strokeStyle = themeColor;
            this.ctx.lineWidth = 2.5;

            for (const [startIdx, endIdx] of this.HAND_CONNECTIONS) {
                const p1 = hand[startIdx];
                const p2 = hand[endIdx];
                this.ctx.beginPath();
                this.ctx.moveTo(p1.x * width, p1.y * height);
                this.ctx.lineTo(p2.x * width, p2.y * height);
                this.ctx.stroke();
            }

            // Draw joint nodes
            for (let i = 0; i < hand.length; i++) {
                const pt = hand[i];
                const isTip = (i === 4 || i === 8 || i === 12 || i === 16 || i === 20);
                const isWrist = (i === 0);

                this.ctx.fillStyle = isTip ? accentColor : themeColor;
                this.ctx.beginPath();
                this.ctx.arc(pt.x * width, pt.y * height, isTip ? 5.5 : (isWrist ? 6.5 : 3.5), 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        this.ctx.restore();
    }

    // Simulated Demo Mode for testing without webcam
    updateDemoSimulation(dt, width, height) {
        this.demoState.simTimer += dt;
        const t = this.demoState.simTimer;

        // Gentle head sway
        const faceX = 0.5 + Math.sin(t * 0.8) * 0.06;
        const faceY = 0.38 + Math.cos(t * 1.1) * 0.04;
        const faceTilt = Math.sin(t * 0.7) * 0.08;

        const fakeDet = {
            boundingBox: { xCenter: faceX, yCenter: faceY, width: 0.32, height: 0.38 },
            landmarks: [
                { x: faceX - 0.07, y: faceY - 0.04 },
                { x: faceX + 0.07, y: faceY - 0.04 }
            ]
        };
        fakeDet.angle = faceTilt;
        window.rangerARRenderer.updateFace(fakeDet, width, height);

        // Hand follows mouse or automated figure-8
        let hx = this.demoState.mouseX;
        let hy = this.demoState.mouseY;

        // Build anatomically structured synthetic cyber-hand
        const fakeLandmarks = new Array(21);
        fakeLandmarks[0] = { x: hx, y: hy + 0.07, z: 0 }; // Wrist
        // Thumb (1..4)
        fakeLandmarks[1] = { x: hx - 0.022, y: hy + 0.045, z: 0 };
        fakeLandmarks[2] = { x: hx - 0.038, y: hy + 0.025, z: 0 };
        fakeLandmarks[3] = { x: hx - 0.048, y: hy + 0.01, z: 0 };
        fakeLandmarks[4] = { x: hx - 0.058, y: hy - 0.005, z: 0 };
        // Index (5..8)
        fakeLandmarks[5] = { x: hx - 0.02, y: hy - 0.002, z: 0 };
        fakeLandmarks[6] = { x: hx - 0.022, y: hy - 0.03, z: 0 };
        fakeLandmarks[7] = { x: hx - 0.024, y: hy - 0.05, z: 0 };
        fakeLandmarks[8] = { x: hx - 0.025, y: hy - 0.075, z: 0 };
        // Middle (9..12)
        fakeLandmarks[9] = { x: hx, y: hy - 0.005, z: 0 };
        fakeLandmarks[10] = { x: hx, y: hy - 0.035, z: 0 };
        fakeLandmarks[11] = { x: hx, y: hy - 0.06, z: 0 };
        fakeLandmarks[12] = { x: hx, y: hy - 0.085, z: 0 };
        // Ring (13..16)
        fakeLandmarks[13] = { x: hx + 0.02, y: hy - 0.002, z: 0 };
        fakeLandmarks[14] = { x: hx + 0.022, y: hy - 0.03, z: 0 };
        fakeLandmarks[15] = { x: hx + 0.024, y: hy - 0.05, z: 0 };
        fakeLandmarks[16] = { x: hx + 0.025, y: hy - 0.072, z: 0 };
        // Pinky (17..20)
        fakeLandmarks[17] = { x: hx + 0.038, y: hy + 0.008, z: 0 };
        fakeLandmarks[18] = { x: hx + 0.042, y: hy - 0.02, z: 0 };
        fakeLandmarks[19] = { x: hx + 0.044, y: hy - 0.038, z: 0 };
        fakeLandmarks[20] = { x: hx + 0.046, y: hy - 0.055, z: 0 };

        const handData = {
            gesture: this.currentRanger ? 'open_palm' : 'none',
            ranger: this.currentRanger,
            chargeProgress: 0,
            isCharging: false,
            handCenter: { x: hx, y: hy }
        };

        // Render synthetic cyber skeleton
        const activeConfig = this.currentRanger ? window.rangerGestureEngine.RANGER_CONFIG[this.currentRanger] : null;
        this.renderCyberSkeleton([fakeLandmarks], width, height, activeConfig);

        return handData;
    }

    // Sci-Fi Command Center background when camera is disabled or in Demo Mode
    renderDemoBackground(width, height, now) {
        // Dark futuristic gradient
        const bgGrad = this.ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#040810');
        bgGrad.addColorStop(0.5, '#0B1528');
        bgGrad.addColorStop(1, '#02050A');
        this.ctx.fillStyle = bgGrad;
        this.ctx.fillRect(0, 0, width, height);

        // Holographic Hexagonal Grid
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
        this.ctx.lineWidth = 1;
        const hexSize = 55;
        for (let y = 0; y < height + hexSize; y += hexSize * 0.86) {
            for (let x = 0; x < width + hexSize; x += hexSize * 1.5) {
                this.ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI) / 3;
                    const px = x + Math.cos(angle) * (hexSize * 0.45);
                    const py = y + Math.sin(angle) * (hexSize * 0.45);
                    if (i === 0) this.ctx.moveTo(px, py);
                    else this.ctx.lineTo(px, py);
                }
                this.ctx.closePath();
                this.ctx.stroke();
            }
        }

        // Zordon tube vertical light stream in center
        const tubeX = width * 0.5;
        const tubeGrad = this.ctx.createLinearGradient(tubeX - 90, 0, tubeX + 90, 0);
        tubeGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
        tubeGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.12)');
        tubeGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
        this.ctx.fillStyle = tubeGrad;
        this.ctx.fillRect(tubeX - 90, 0, 180, height);

        // Simulation watermark label
        this.ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
        this.ctx.font = "14px 'Orbitron', monospace";
        this.ctx.textAlign = 'center';
        this.ctx.fillText("COMMAND CENTER SIMULATION MATRIX ACTIVE", width * 0.5, height - 35);

        this.ctx.restore();
    }

    // Highlight active gesture card in HUD
    updateGestureLegendHUD(activeGesture) {
        const cards = document.querySelectorAll('.gesture-card');
        cards.forEach(card => {
            const gestureId = card.getAttribute('data-gesture');
            if (gestureId === activeGesture) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        const gestureIndicator = document.getElementById('current-gesture-label');
        if (gestureIndicator) {
            const names = {
                fist: 'FIST DETECTED (RED TYRANNO)',
                peace: 'PEACE SIGN DETECTED (BLUE TRICERA)',
                open_palm: 'OPEN PALM DETECTED (YELLOW SABERTOOTH)',
                horns: 'HORNS SIGN DETECTED (GREEN DRAGON)',
                thumbs_down: 'THUMBS DOWN (DE-MORPH)',
                none: 'SCANNING GESTURES...'
            };
            gestureIndicator.textContent = names[activeGesture] || 'SCANNING...';
        }
    }

    updateBattleHUD(stats) {
        const scoreEl = document.getElementById('battle-score');
        const highEl = document.getElementById('battle-highscore');
        const comboEl = document.getElementById('battle-combo');
        const shieldEl = document.getElementById('shield-bar-fill');
        const shieldText = document.getElementById('shield-val');

        if (scoreEl) scoreEl.textContent = stats.score;
        if (highEl) highEl.textContent = stats.highScore;
        if (comboEl) {
            comboEl.textContent = `x${stats.combo}`;
            comboEl.style.transform = stats.combo > 1 ? 'scale(1.2)' : 'scale(1)';
        }
        if (shieldEl) {
            shieldEl.style.width = `${stats.shield}%`;
            shieldEl.style.backgroundColor = stats.shield > 30 ? '#00E676' : '#FF1744';
        }
        if (shieldText) shieldText.textContent = `${stats.shield}%`;
    }

    updateStatus(message, state = 'ready') {
        const statusEl = document.getElementById('status-indicator');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status-${state}`;
        }
    }

    // Snapshot photo capture (download merged selfie)
    takeSnapshot() {
        try {
            const link = document.createElement('a');
            link.download = `ranger-morph-${this.currentRanger || 'civilian'}-${Date.now()}.png`;
            link.href = this.canvas.toDataURL('image/png');
            link.click();
            this.updateStatus('MORPHIN SNAPSHOT SAVED!', 'ready');
            setTimeout(() => this.updateStatus('SYSTEM READY - MAKE A MORPHIN GESTURE', 'ready'), 2500);
        } catch (e) {
            console.error("Failed to save snapshot:", e);
        }
    }

    setupEventListeners() {
        // Audio Toggle
        const audioBtn = document.getElementById('toggle-audio-btn');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => {
                const muted = window.rangerAudio.toggleMute();
                audioBtn.innerHTML = muted ? '🔇 AUDIO: OFF' : '🔊 AUDIO: ON';
                audioBtn.classList.toggle('active', !muted);
            });
        }

        // Battle Mode Toggle
        const battleBtn = document.getElementById('toggle-battle-btn');
        if (battleBtn) {
            battleBtn.addEventListener('click', () => {
                window.rangerAudio.ensureContext();
                const active = window.rangerBattleGame.toggle();
                battleBtn.innerHTML = active ? '⚔️ BATTLE MODE: ON' : '🛡️ BATTLE MODE: OFF';
                battleBtn.classList.toggle('active-battle', active);
                document.getElementById('battle-hud').classList.toggle('hidden', !active);
            });
        }

        // Demorph Button
        const demorphBtn = document.getElementById('demorph-btn');
        if (demorphBtn) {
            demorphBtn.addEventListener('click', () => this.demorph());
        }

        // Snapshot Button
        const snapshotBtn = document.getElementById('snapshot-btn');
        if (snapshotBtn) {
            snapshotBtn.addEventListener('click', () => this.takeSnapshot());
        }

        // Demo Mode launch buttons
        const launchDemoBtn = document.getElementById('launch-demo-btn');
        if (launchDemoBtn) {
            launchDemoBtn.addEventListener('click', () => this.startDemoMode());
        }
        const demoToggleBtn = document.getElementById('toggle-demo-btn');
        if (demoToggleBtn) {
            demoToggleBtn.addEventListener('click', () => {
                if (this.isDemoMode) {
                    this.startWebcam();
                } else {
                    this.startDemoMode();
                }
            });
        }

        // Manual gesture card click (allows instant triggering in demo/mouse mode)
        const cards = document.querySelectorAll('.gesture-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                window.rangerAudio.ensureContext();
                const rangerId = card.getAttribute('data-ranger');
                if (rangerId === 'demorph') {
                    this.demorph();
                } else if (rangerId) {
                    this.morphIntoRanger(rangerId);
                }
            });
        });

        // Mouse tracking for demo mode
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.demoState.mouseX = (e.clientX - rect.left) / rect.width;
            this.demoState.mouseY = (e.clientY - rect.top) / rect.height;
        });

        // Keyboard hotkeys for quick testing
        window.addEventListener('keydown', (e) => {
            window.rangerAudio.ensureContext();
            if (e.key === '1') this.morphIntoRanger('red');
            if (e.key === '2') this.morphIntoRanger('blue');
            if (e.key === '3') this.morphIntoRanger('yellow');
            if (e.key === '4') this.morphIntoRanger('green');
            if (e.key === '0' || e.key === 'Escape') this.demorph();
            if (e.key.toLowerCase() === 'b') {
                const active = window.rangerBattleGame.toggle();
                if (battleBtn) {
                    battleBtn.innerHTML = active ? '⚔️ BATTLE MODE: ON' : '🛡️ BATTLE MODE: OFF';
                    battleBtn.classList.toggle('active-battle', active);
                }
                document.getElementById('battle-hud').classList.toggle('hidden', !active);
            }
        });
    }
}

// Instantiate once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    window.morphinApp = new MorphinApp();
});
