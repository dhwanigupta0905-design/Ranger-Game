/**
 * Morphin Time: Ranger AR Studio - Gesture Recognizer
 * Rule-based geometric classifier for MediaPipe Hands landmarks
 * Tracks steady holds, charge progression, and demorph commands
 */

class RangerGestureEngine {
    constructor() {
        this.CHARGE_DURATION = 1.5; // 1.5 seconds to morph
        this.DEMORPH_HOLD_DURATION = 0.8; // Quick hold for demorph

        this.currentRawGesture = 'none';
        this.stableGesture = 'none';
        this.gestureHistory = [];
        this.HISTORY_SIZE = 5;

        // Charge state
        this.targetRanger = null; // 'red', 'blue', 'yellow', 'green', 'demorph'
        this.chargeProgress = 0; // 0.0 to 1.0
        this.lastUpdateTime = performance.now();
        this.handCenter = { x: 0.5, y: 0.5 }; // normalized

        // Event callbacks
        this.onMorphTriggered = null; // function(rangerType)
        this.onDemorphTriggered = null; // function()
        this.onChargeProgress = null; // function(progress, targetRanger, handCenter)
        this.onChargeCanceled = null; // function()

        // Ranger color definitions
        this.RANGER_CONFIG = {
            red: {
                id: 'red',
                name: 'Red Ranger',
                mode: 'Tyranno Mode',
                themeColor: '#FF1E1E',
                glowColor: 'rgba(255, 30, 30, 0.7)',
                accentColor: '#FF6B6B',
                symbol: 'Fist / Closed Hand',
                icon: '✊'
            },
            blue: {
                id: 'blue',
                name: 'Blue Ranger',
                mode: 'Tricera Mode',
                themeColor: '#00A8FF',
                glowColor: 'rgba(0, 168, 255, 0.7)',
                accentColor: '#70D6FF',
                symbol: 'Peace Sign (V)',
                icon: '✌️'
            },
            yellow: {
                id: 'yellow',
                name: 'Yellow Ranger',
                mode: 'Sabertooth Mode',
                themeColor: '#FFD700',
                glowColor: 'rgba(255, 215, 0, 0.7)',
                accentColor: '#FFF176',
                symbol: 'Open Palm',
                icon: '🖐️'
            },
            green: {
                id: 'green',
                name: 'Green Ranger',
                mode: 'Dragon Mode',
                themeColor: '#00E676',
                glowColor: 'rgba(0, 230, 118, 0.7)',
                accentColor: '#69F0AE',
                symbol: 'Rock / Horns Sign',
                icon: '🤘'
            }
        };
    }

    // Euclidean distance in 2D normalized coordinate space
    dist(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Classify a single hand's 21 landmarks
    classifyHand(landmarks) {
        if (!landmarks || landmarks.length < 21) {
            return { gesture: 'none', handCenter: { x: 0.5, y: 0.5 }, palmSize: 0 };
        }

        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const thumbIp = landmarks[3];
        const thumbMcp = landmarks[2];

        const indexMcp = landmarks[5];
        const indexPip = landmarks[6];
        const indexTip = landmarks[8];

        const middleMcp = landmarks[9];
        const middlePip = landmarks[10];
        const middleTip = landmarks[12];

        const ringMcp = landmarks[13];
        const ringPip = landmarks[14];
        const ringTip = landmarks[16];

        const pinkyMcp = landmarks[17];
        const pinkyPip = landmarks[18];
        const pinkyTip = landmarks[20];

        // Palm reference size (Wrist to Middle MCP)
        const palmSize = Math.max(0.01, this.dist(wrist, middleMcp));

        // Palm center (approx midpoint between wrist and middle MCP)
        const handCenter = {
            x: (wrist.x + middleMcp.x) * 0.5,
            y: (wrist.y + middleMcp.y) * 0.5
        };

        // Determine extension state of fingers
        const isIndexExtended = this.dist(indexTip, wrist) > this.dist(indexPip, wrist) * 1.15 &&
                                this.dist(indexTip, indexMcp) > palmSize * 0.65;
        const isIndexCurled = this.dist(indexTip, wrist) < this.dist(indexPip, wrist) * 1.05 ||
                              this.dist(indexTip, indexMcp) < palmSize * 0.6;

        const isMiddleExtended = this.dist(middleTip, wrist) > this.dist(middlePip, wrist) * 1.15 &&
                                 this.dist(middleTip, middleMcp) > palmSize * 0.65;
        const isMiddleCurled = this.dist(middleTip, wrist) < this.dist(middlePip, wrist) * 1.05 ||
                               this.dist(middleTip, middleMcp) < palmSize * 0.6;

        const isRingExtended = this.dist(ringTip, wrist) > this.dist(ringPip, wrist) * 1.15 &&
                               this.dist(ringTip, ringMcp) > palmSize * 0.65;
        const isRingCurled = this.dist(ringTip, wrist) < this.dist(ringPip, wrist) * 1.05 ||
                             this.dist(ringTip, ringMcp) < palmSize * 0.6;

        const isPinkyExtended = this.dist(pinkyTip, wrist) > this.dist(pinkyPip, wrist) * 1.15 &&
                                this.dist(pinkyTip, pinkyMcp) > palmSize * 0.65;
        const isPinkyCurled = this.dist(pinkyTip, wrist) < this.dist(pinkyPip, wrist) * 1.05 ||
                              this.dist(pinkyTip, pinkyMcp) < palmSize * 0.6;

        // Thumb checks
        const isThumbExtended = this.dist(thumbTip, middleMcp) > palmSize * 0.85;
        const isThumbCurled = this.dist(thumbTip, middleMcp) < palmSize * 0.65;

        // Thumbs down: Thumb points downward significantly relative to wrist & MCPs
        const isThumbDown = (thumbTip.y > thumbMcp.y + palmSize * 0.25) &&
                            (thumbTip.y > thumbIp.y) &&
                            (thumbTip.y > wrist.y - palmSize * 0.2);

        let gesture = 'none';

        // 1. Check for Thumbs Down (Demorph gesture)
        if (isThumbDown && isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled) {
            gesture = 'thumbs_down';
        }
        // 2. Open Palm (Yellow Ranger): All 4 fingers extended, thumb extended or neutral
        else if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
            gesture = 'open_palm';
        }
        // 3. Peace Sign (Blue Ranger): Index & Middle extended, Ring & Pinky curled
        else if (isIndexExtended && isMiddleExtended && isRingCurled && isPinkyCurled) {
            gesture = 'peace';
        }
        // 4. Rock / Horns Sign (Green Ranger): Index & Pinky extended, Middle & Ring curled
        else if (isIndexExtended && isPinkyExtended && isMiddleCurled && isRingCurled) {
            gesture = 'horns';
        }
        // 5. Fist / Closed Hand (Red Ranger): All 4 fingers curled, thumb curled or tucked
        else if (isIndexCurled && isMiddleCurled && isRingCurled && isPinkyCurled) {
            gesture = 'fist';
        }

        return {
            gesture,
            handCenter,
            palmSize,
            fingers: {
                index: isIndexExtended,
                middle: isMiddleExtended,
                ring: isRingExtended,
                pinky: isPinkyExtended,
                thumb: isThumbExtended
            }
        };
    }

    // Process detected hands from MediaPipe Hands
    processHands(multiHandLandmarks) {
        const now = performance.now();
        const dt = Math.min((now - this.lastUpdateTime) / 1000, 0.1);
        this.lastUpdateTime = now;

        if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
            this.handleNoHands(dt);
            return {
                gesture: 'none',
                ranger: null,
                chargeProgress: 0,
                isCharging: false,
                handCenter: this.handCenter
            };
        }

        // Check for Crossed Hands Demorph if 2 hands are present
        if (multiHandLandmarks.length >= 2) {
            const h1Wrist = multiHandLandmarks[0][0];
            const h2Wrist = multiHandLandmarks[1][0];
            const wristDist = this.dist(h1Wrist, h2Wrist);
            if (wristDist < 0.15) {
                return this.updateChargeState('demorph', {
                    x: (h1Wrist.x + h2Wrist.x) * 0.5,
                    y: (h1Wrist.y + h2Wrist.y) * 0.5
                }, dt);
            }
        }

        // Analyze primary hand (first detected)
        const primaryHand = multiHandLandmarks[0];
        const classification = this.classifyHand(primaryHand);
        this.handCenter = classification.handCenter;

        // Smooth gesture with history buffer
        this.gestureHistory.push(classification.gesture);
        if (this.gestureHistory.length > this.HISTORY_SIZE) {
            this.gestureHistory.shift();
        }

        // Find most frequent gesture in history
        const counts = {};
        for (const g of this.gestureHistory) {
            counts[g] = (counts[g] || 0) + 1;
        }

        let maxCount = 0;
        let dominantGesture = 'none';
        for (const [g, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                dominantGesture = g;
            }
        }

        this.currentRawGesture = classification.gesture;
        this.stableGesture = maxCount >= 3 ? dominantGesture : 'none';

        // Map gesture to Ranger / Demorph
        let targetAction = null;
        if (this.stableGesture === 'fist') targetAction = 'red';
        else if (this.stableGesture === 'peace') targetAction = 'blue';
        else if (this.stableGesture === 'open_palm') targetAction = 'yellow';
        else if (this.stableGesture === 'horns') targetAction = 'green';
        else if (this.stableGesture === 'thumbs_down') targetAction = 'demorph';

        return this.updateChargeState(targetAction, this.handCenter, dt);
    }

    updateChargeState(targetAction, center, dt) {
        if (!targetAction) {
            this.handleNoHands(dt);
            return {
                gesture: this.stableGesture,
                ranger: null,
                chargeProgress: 0,
                isCharging: false,
                handCenter: center
            };
        }

        const isDemorph = (targetAction === 'demorph');
        const requiredTime = isDemorph ? this.DEMORPH_HOLD_DURATION : this.CHARGE_DURATION;

        // If target changed, reset progress
        if (this.targetRanger !== targetAction) {
            this.targetRanger = targetAction;
            this.chargeProgress = 0;
            if (!isDemorph && window.rangerAudio) {
                window.rangerAudio.startChargeHum();
            }
        }

        // Accumulate charge
        this.chargeProgress = Math.min(1.0, this.chargeProgress + (dt / requiredTime));

        if (!isDemorph && window.rangerAudio) {
            window.rangerAudio.updateChargeHum(this.chargeProgress);
        }

        if (this.onChargeProgress) {
            this.onChargeProgress(this.chargeProgress, this.targetRanger, center);
        }

        // Check if charge reached 100%
        if (this.chargeProgress >= 1.0) {
            if (isDemorph) {
                if (this.onDemorphTriggered) {
                    this.onDemorphTriggered();
                }
            } else {
                if (this.onMorphTriggered) {
                    this.onMorphTriggered(this.targetRanger);
                }
            }
            // Reset after trigger
            this.chargeProgress = 0;
            this.targetRanger = null;
            if (window.rangerAudio) {
                window.rangerAudio.stopChargeHum();
            }
        }

        return {
            gesture: this.stableGesture,
            ranger: this.targetRanger,
            chargeProgress: this.chargeProgress,
            isCharging: this.chargeProgress > 0.05,
            handCenter: center
        };
    }

    handleNoHands(dt) {
        if (this.chargeProgress > 0) {
            // Rapidly decay charge when hand is lost
            this.chargeProgress = Math.max(0, this.chargeProgress - dt * 2.5);
            if (this.chargeProgress === 0) {
                this.targetRanger = null;
                if (window.rangerAudio) {
                    window.rangerAudio.stopChargeHum();
                }
                if (this.onChargeCanceled) {
                    this.onChargeCanceled();
                }
            }
        }
    }

    reset() {
        this.chargeProgress = 0;
        this.targetRanger = null;
        this.gestureHistory = [];
        this.stableGesture = 'none';
        if (window.rangerAudio) {
            window.rangerAudio.stopChargeHum();
        }
    }
}

// Global gesture engine
window.rangerGestureEngine = new RangerGestureEngine();
