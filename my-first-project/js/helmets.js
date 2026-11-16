/**
 * Morphin Time: Ranger AR Studio - AR Helmet & Visor Renderer
 * Dynamic procedural vector canvas renderer for Power Ranger helmets,
 * glowing visors, shoulder energy auras, charge rings, and lightning bursts.
 */

class RangerARRenderer {
    constructor() {
        this.lightningBolts = [];
        this.flashAlpha = 0;
        this.flashColor = '#FFFFFF';
        this.activeAuraParticles = [];
        this.time = 0;

        // Smooth face tracking variables (EMA smoothing)
        this.smoothedFace = {
            x: 0.5,
            y: 0.4,
            width: 0.3,
            height: 0.35,
            angle: 0,
            hasDetection: false
        };
        this.SMOOTH_FACTOR = 0.28; // Responsive yet stable
    }

    // Update smoothed face coordinates from MediaPipe Face Detection
    updateFace(detection, canvasWidth, canvasHeight) {
        if (!detection) {
            this.smoothedFace.hasDetection = false;
            return;
        }

        const box = detection.boundingBox;
        // Normalized center and dimensions
        let targetX = box.xCenter;
        let targetY = box.yCenter;
        let targetW = box.width;
        let targetH = box.height;

        // Calculate head roll angle from eye landmarks if available
        let targetAngle = 0;
        if (detection.landmarks && detection.landmarks.length >= 2) {
            const rightEye = detection.landmarks[0]; // detected right
            const leftEye = detection.landmarks[1];  // detected left
            const dx = leftEye.x - rightEye.x;
            const dy = leftEye.y - rightEye.y;
            targetAngle = Math.atan2(dy, dx);
        }

        if (!this.smoothedFace.hasDetection) {
            this.smoothedFace.x = targetX;
            this.smoothedFace.y = targetY;
            this.smoothedFace.width = targetW;
            this.smoothedFace.height = targetH;
            this.smoothedFace.angle = targetAngle;
            this.smoothedFace.hasDetection = true;
        } else {
            const f = this.SMOOTH_FACTOR;
            this.smoothedFace.x += (targetX - this.smoothedFace.x) * f;
            this.smoothedFace.y += (targetY - this.smoothedFace.y) * f;
            this.smoothedFace.width += (targetW - this.smoothedFace.width) * f;
            this.smoothedFace.height += (targetH - this.smoothedFace.height) * f;
            this.smoothedFace.angle += (targetAngle - this.smoothedFace.angle) * f;
        }
    }

    // Trigger full transformation lightning shockwave
    triggerTransformationSequence(rangerType, config) {
        this.flashAlpha = 1.0;
        this.flashColor = config.themeColor || '#FFFFFF';

        // Generate radial branching lightning bolts
        this.lightningBolts = [];
        const count = 18;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
            this.lightningBolts.push({
                angle,
                segments: this.generateLightningBranch(0, 0, angle, 450, 6),
                color: config.themeColor,
                life: 1.0,
                width: 3.5 + Math.random() * 3
            });
        }
    }

    generateLightningBranch(startX, startY, angle, maxDist, depth) {
        const points = [{ x: startX, y: startY }];
        let curX = startX;
        let curY = startY;
        const steps = 7;
        const stepDist = maxDist / steps;

        for (let s = 1; s <= steps; s++) {
            const dist = s * stepDist;
            const perp = (Math.random() - 0.5) * 55;
            const ptX = startX + Math.cos(angle) * dist - Math.sin(angle) * perp;
            const ptY = startY + Math.sin(angle) * dist + Math.cos(angle) * perp;
            points.push({ x: ptX, y: ptY });
        }
        return points;
    }

    // Draw full AR scene (Auras, Helmet, Visor, Effects)
    renderARScene(ctx, width, height, currentRanger, config, dt) {
        this.time += dt;

        // Render transformation flash & shockwave if active
        this.renderTransformationEffects(ctx, width, height, dt);

        if (!currentRanger || !config || !this.smoothedFace.hasDetection) {
            return;
        }

        const face = this.smoothedFace;
        const centerX = face.x * width;
        const centerY = face.y * height;
        const facePixelW = face.width * width;
        const facePixelH = face.height * height;

        // Base unit scale for vector artwork
        const scale = (facePixelW / 185) * 1.08;

        // 1. Draw Shoulder Energy Aura & Flames (behind helmet)
        this.renderEnergyAura(ctx, centerX, centerY + facePixelH * 0.65, scale, config, dt);

        // 2. Draw Transformed Helmet & Visor
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(face.angle);
        ctx.scale(scale, scale);

        switch (currentRanger) {
            case 'red':
                this.drawRedTyrannoHelmet(ctx, config);
                break;
            case 'blue':
                this.drawBlueTriceraHelmet(ctx, config);
                break;
            case 'yellow':
                this.drawYellowSabertoothHelmet(ctx, config);
                break;
            case 'green':
                this.drawGreenDragonHelmet(ctx, config);
                break;
        }

        ctx.restore();
    }

    // Dynamic energy flame aura around the Ranger's shoulders
    renderEnergyAura(ctx, x, y, scale, config, dt) {
        // Spawn particles
        if (this.activeAuraParticles.length < 45) {
            this.activeAuraParticles.push({
                x: x + (Math.random() - 0.5) * 190 * scale,
                y: y + (Math.random() - 0.5) * 40 * scale,
                vx: (Math.random() - 0.5) * 40 * scale,
                vy: -80 - Math.random() * 110 * scale,
                size: 14 + Math.random() * 22 * scale,
                alpha: 0.8,
                maxLife: 0.65 + Math.random() * 0.4,
                life: 0.65 + Math.random() * 0.4
            });
        }

        // Draw and update aura particles
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = this.activeAuraParticles.length - 1; i >= 0; i--) {
            const p = this.activeAuraParticles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.activeAuraParticles.splice(i, 1);
                continue;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            const progress = p.life / p.maxLife;

            const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            radGrad.addColorStop(0, config.accentColor || '#FFF');
            radGrad.addColorStop(0.4, config.themeColor);
            radGrad.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = radGrad;
            ctx.globalAlpha = progress * 0.75;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // ==========================================
    // 1. RED RANGER (TYRANNO MODE) HELMET
    // ==========================================
    drawRedTyrannoHelmet(ctx, config) {
        // Outer glowing shadow
        ctx.shadowColor = config.themeColor;
        ctx.shadowBlur = 24;

        // A. Helmet Dome (Crimson Gradient)
        const domeGrad = ctx.createLinearGradient(0, -110, 0, 70);
        domeGrad.addColorStop(0, '#FF3333');
        domeGrad.addColorStop(0.4, '#D50000');
        domeGrad.addColorStop(1, '#8B0000');

        ctx.fillStyle = domeGrad;
        ctx.beginPath();
        ctx.moveTo(0, -105);
        ctx.bezierCurveTo(80, -105, 95, -40, 92, 20);
        ctx.bezierCurveTo(90, 65, 55, 88, 0, 92);
        ctx.bezierCurveTo(-55, 88, -90, 65, -92, 20);
        ctx.bezierCurveTo(-95, -40, -80, -105, 0, -105);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0; // Reset shadow for crisp lines

        // B. White Aerodynamic Temple Cheeks
        ctx.fillStyle = '#E8EAF6';
        ctx.beginPath();
        ctx.moveTo(70, -25);
        ctx.lineTo(88, 25);
        ctx.lineTo(55, 65);
        ctx.lineTo(50, 20);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-70, -25);
        ctx.lineTo(-88, 25);
        ctx.lineTo(-55, 65);
        ctx.lineTo(-50, 20);
        ctx.closePath();
        ctx.fill();

        // C. Silver Sculpted Mouthpiece & Chin
        const silverGrad = ctx.createLinearGradient(0, 30, 0, 88);
        silverGrad.addColorStop(0, '#ECEFF1');
        silverGrad.addColorStop(0.5, '#CFD8DC');
        silverGrad.addColorStop(1, '#90A4AE');

        ctx.fillStyle = silverGrad;
        ctx.strokeStyle = '#546E7A';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.moveTo(-45, 32);
        ctx.lineTo(45, 32);
        ctx.lineTo(40, 84);
        ctx.lineTo(0, 92);
        ctx.lineTo(-40, 84);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Sculpted lips & vent slits
        ctx.fillStyle = '#37474F';
        ctx.fillRect(-15, 52, 30, 4);
        ctx.fillRect(-22, 64, 44, 3.5);
        ctx.fillRect(-12, 74, 24, 2.5);

        // D. T-Rex Tooth Visor Frame (Sawtooth Teeth)
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-78, -32);
        // Top row teeth
        ctx.lineTo(-50, -30); ctx.lineTo(-42, -18); ctx.lineTo(-34, -30);
        ctx.lineTo(-20, -30); ctx.lineTo(-12, -16); ctx.lineTo(-4, -30);
        ctx.lineTo(4, -30);  ctx.lineTo(12, -16);  ctx.lineTo(20, -30);
        ctx.lineTo(34, -30); ctx.lineTo(42, -18);  ctx.lineTo(50, -30);
        ctx.lineTo(78, -32);
        // Outer side curve
        ctx.quadraticCurveTo(84, -2, 72, 24);
        // Bottom row teeth
        ctx.lineTo(50, 22); ctx.lineTo(42, 8);  ctx.lineTo(34, 22);
        ctx.lineTo(20, 22); ctx.lineTo(12, 10); ctx.lineTo(4, 22);
        ctx.lineTo(-4, 22); ctx.lineTo(-12, 10);ctx.lineTo(-20, 22);
        ctx.lineTo(-34, 22);ctx.lineTo(-42, 8); ctx.lineTo(-50, 22);
        ctx.lineTo(-72, 24);
        ctx.quadraticCurveTo(-84, -2, -78, -32);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // E. Obsidian Glossy Visor with Laser Sheen
        ctx.fillStyle = '#08090C';
        ctx.beginPath();
        ctx.moveTo(-68, -24);
        ctx.quadraticCurveTo(0, -28, 68, -24);
        ctx.quadraticCurveTo(76, -2, 64, 18);
        ctx.quadraticCurveTo(0, 22, -64, 18);
        ctx.quadraticCurveTo(-76, -2, -68, -24);
        ctx.closePath();
        ctx.fill();

        // Glowing red visor beam sweep
        this.drawVisorGlint(ctx, -68, 68, -25, 20, '#FF1E1E');

        // Forehead Golden Tyranno Medallion
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#B78103';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -68, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#D50000';
        ctx.beginPath();
        ctx.arc(0, -68, 7, 0, Math.PI * 2);
        ctx.fill();
    }

    // ==========================================
    // 2. BLUE RANGER (TRICERA MODE) HELMET
    // ==========================================
    drawBlueTriceraHelmet(ctx, config) {
        ctx.shadowColor = config.themeColor;
        ctx.shadowBlur = 24;

        // A. Helmet Dome (Cobalt Electric Blue)
        const domeGrad = ctx.createLinearGradient(0, -115, 0, 75);
        domeGrad.addColorStop(0, '#00E5FF');
        domeGrad.addColorStop(0.35, '#0091EA');
        domeGrad.addColorStop(1, '#0D47A1');

        ctx.fillStyle = domeGrad;
        ctx.beginPath();
        ctx.moveTo(0, -110);
        ctx.bezierCurveTo(85, -100, 98, -35, 94, 25);
        ctx.bezierCurveTo(90, 70, 50, 90, 0, 94);
        ctx.bezierCurveTo(-50, 90, -90, 70, -94, 25);
        ctx.bezierCurveTo(-98, -35, -85, -100, 0, -110);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;

        // B. Triceratops Triple Horn Crest
        // Center Nose Horn
        const hornGrad = ctx.createLinearGradient(0, -65, 0, -25);
        hornGrad.addColorStop(0, '#ECEFF1');
        hornGrad.addColorStop(1, '#78909C');

        ctx.fillStyle = hornGrad;
        ctx.strokeStyle = '#37474F';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -78);
        ctx.lineTo(12, -42);
        ctx.lineTo(0, -46);
        ctx.lineTo(-12, -42);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Left & Right Brow Horns
        ctx.beginPath();
        ctx.moveTo(68, -75);
        ctx.lineTo(76, -35);
        ctx.lineTo(54, -30);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-68, -75);
        ctx.lineTo(-54, -30);
        ctx.lineTo(-76, -35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // C. Silver Sculpted Mouthpiece & Chin
        ctx.fillStyle = '#CFD8DC';
        ctx.beginPath();
        ctx.moveTo(-44, 30);
        ctx.lineTo(44, 30);
        ctx.lineTo(38, 86);
        ctx.lineTo(0, 94);
        ctx.lineTo(-38, 86);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Technical mouth slots
        ctx.fillStyle = '#1A237E';
        ctx.fillRect(-18, 50, 36, 4);
        ctx.fillRect(-24, 62, 48, 3.5);
        ctx.fillRect(-15, 74, 30, 2.5);

        // D. Sleek Chiseled Visor Frame
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-78, -26);
        ctx.lineTo(-20, -32);
        ctx.lineTo(0, -36);
        ctx.lineTo(20, -32);
        ctx.lineTo(78, -26);
        ctx.lineTo(70, 22);
        ctx.lineTo(28, 16);
        ctx.lineTo(0, 22);
        ctx.lineTo(-28, 16);
        ctx.lineTo(-70, 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // E. Visor Glass with Cyan Grid
        ctx.fillStyle = '#050B14';
        ctx.beginPath();
        ctx.moveTo(-68, -20);
        ctx.lineTo(0, -28);
        ctx.lineTo(68, -20);
        ctx.lineTo(62, 14);
        ctx.lineTo(0, 18);
        ctx.lineTo(-62, 14);
        ctx.closePath();
        ctx.fill();

        // Cyan HUD Hex Grid Pattern inside visor
        this.drawVisorGrid(ctx, '#00E5FF');
        this.drawVisorGlint(ctx, -68, 68, -20, 18, '#00A8FF');
    }

    // ==========================================
    // 3. YELLOW RANGER (SABERTOOTH MODE) HELMET
    // ==========================================
    drawYellowSabertoothHelmet(ctx, config) {
        ctx.shadowColor = config.themeColor;
        ctx.shadowBlur = 24;

        // A. Helmet Dome (Aerodynamic Golden Amber)
        const domeGrad = ctx.createLinearGradient(0, -110, 0, 75);
        domeGrad.addColorStop(0, '#FFEE58');
        domeGrad.addColorStop(0.35, '#FBC02D');
        domeGrad.addColorStop(1, '#F57F17');

        ctx.fillStyle = domeGrad;
        ctx.beginPath();
        ctx.moveTo(0, -108);
        ctx.bezierCurveTo(82, -102, 94, -36, 90, 24);
        ctx.bezierCurveTo(86, 68, 48, 88, 0, 92);
        ctx.bezierCurveTo(-48, 88, -86, 68, -90, 24);
        ctx.bezierCurveTo(-94, -36, -82, -102, 0, -108);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;

        // B. White and Black Temple Lightning Marks
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(65, -60); ctx.lineTo(88, -20); ctx.lineTo(62, -22); ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-65, -60); ctx.lineTo(-88, -20); ctx.lineTo(-62, -22); ctx.closePath();
        ctx.fill();

        // C. Silver Mouthpiece & Chin
        ctx.fillStyle = '#CFD8DC';
        ctx.strokeStyle = '#455A64';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-42, 28);
        ctx.lineTo(42, 28);
        ctx.lineTo(36, 84);
        ctx.lineTo(0, 92);
        ctx.lineTo(-36, 84);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#263238';
        ctx.fillRect(-16, 48, 32, 4);
        ctx.fillRect(-22, 60, 44, 3.5);
        ctx.fillRect(-12, 72, 24, 2.5);

        // D. Predator Slanted Visor Frame
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-74, -28);
        ctx.quadraticCurveTo(0, -38, 74, -28);
        ctx.quadraticCurveTo(82, -2, 68, 20);
        ctx.quadraticCurveTo(0, 18, -68, 20);
        ctx.quadraticCurveTo(-82, -2, -74, -28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // E. Twin Sabertooth Fangs Flanking Jaw!
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#B0BEC5';
        ctx.lineWidth = 2;
        // Right Fang
        ctx.beginPath();
        ctx.moveTo(42, -5);
        ctx.lineTo(58, -5);
        ctx.lineTo(47, 45); // Extends downward like a saber tooth!
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Left Fang
        ctx.beginPath();
        ctx.moveTo(-42, -5);
        ctx.lineTo(-58, -5);
        ctx.lineTo(-47, 45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // F. Glossy Visor with Gold Sheen
        ctx.fillStyle = '#100C02';
        ctx.beginPath();
        ctx.moveTo(-64, -22);
        ctx.quadraticCurveTo(0, -30, 64, -22);
        ctx.quadraticCurveTo(72, -2, 60, 14);
        ctx.quadraticCurveTo(0, 12, -60, 14);
        ctx.quadraticCurveTo(-72, -2, -64, -22);
        ctx.closePath();
        ctx.fill();

        this.drawVisorGlint(ctx, -64, 64, -22, 14, '#FFD700');
    }

    // ==========================================
    // 4. GREEN RANGER (DRAGON MODE) HELMET
    // ==========================================
    drawGreenDragonHelmet(ctx, config) {
        ctx.shadowColor = config.themeColor;
        ctx.shadowBlur = 24;

        // A. Golden Dragon Shield Shoulder Armor (Drawn behind lower helmet)
        const goldMantleGrad = ctx.createLinearGradient(0, 50, 0, 140);
        goldMantleGrad.addColorStop(0, '#FFE082');
        goldMantleGrad.addColorStop(0.5, '#FFC107');
        goldMantleGrad.addColorStop(1, '#FF8F00');

        ctx.fillStyle = goldMantleGrad;
        ctx.strokeStyle = '#B78103';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-130, 115);
        ctx.lineTo(-85, 68);
        ctx.lineTo(0, 85);
        ctx.lineTo(85, 68);
        ctx.lineTo(130, 115);
        ctx.lineTo(0, 145);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Dragon Shield Diamond Emblem
        ctx.fillStyle = '#1B5E20';
        ctx.beginPath();
        ctx.moveTo(0, 92);
        ctx.lineTo(18, 112);
        ctx.lineTo(0, 132);
        ctx.lineTo(-18, 112);
        ctx.closePath();
        ctx.fill();

        // B. Helmet Dome (Emerald Green)
        const domeGrad = ctx.createLinearGradient(0, -112, 0, 75);
        domeGrad.addColorStop(0, '#69F0AE');
        domeGrad.addColorStop(0.35, '#00E676');
        domeGrad.addColorStop(1, '#1B5E20');

        ctx.fillStyle = domeGrad;
        ctx.beginPath();
        ctx.moveTo(0, -108);
        ctx.bezierCurveTo(80, -104, 94, -38, 92, 22);
        ctx.bezierCurveTo(88, 66, 50, 88, 0, 92);
        ctx.bezierCurveTo(-50, 88, -88, 66, -92, 22);
        ctx.bezierCurveTo(-94, -38, -80, -104, 0, -108);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;

        // C. Golden Dragon Crown Forehead Crest
        ctx.fillStyle = goldMantleGrad;
        ctx.strokeStyle = '#FFD54F';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -88);
        ctx.lineTo(24, -58);
        ctx.lineTo(14, -54);
        ctx.lineTo(32, -42);
        ctx.lineTo(0, -48);
        ctx.lineTo(-32, -42);
        ctx.lineTo(-14, -54);
        ctx.lineTo(-24, -58);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crown Ruby Gem
        ctx.fillStyle = '#D50000';
        ctx.beginPath();
        ctx.arc(0, -56, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // D. Silver Dragon Flute Mouthpiece
        ctx.fillStyle = '#CFD8DC';
        ctx.strokeStyle = '#37474F';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-42, 30);
        ctx.lineTo(42, 30);
        ctx.lineTo(36, 84);
        ctx.lineTo(0, 92);
        ctx.lineTo(-36, 84);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Flute air vent ports
        ctx.fillStyle = '#004D40';
        for (let i = -16; i <= 16; i += 8) {
            ctx.beginPath();
            ctx.arc(i, 56, 2.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillRect(-22, 68, 44, 3.5);

        // E. Predatory Dragon Eye Visor Frame
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-72, -26);
        ctx.quadraticCurveTo(0, -34, 72, -26);
        ctx.quadraticCurveTo(80, -2, 66, 18);
        ctx.quadraticCurveTo(0, 16, -66, 18);
        ctx.quadraticCurveTo(-80, -2, -72, -26);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // F. Obsidian Dragon Visor with Emerald Laser Glint
        ctx.fillStyle = '#041008';
        ctx.beginPath();
        ctx.moveTo(-62, -20);
        ctx.quadraticCurveTo(0, -28, 62, -20);
        ctx.quadraticCurveTo(70, -2, 58, 12);
        ctx.quadraticCurveTo(0, 10, -58, 12);
        ctx.quadraticCurveTo(-70, -2, -62, -20);
        ctx.closePath();
        ctx.fill();

        this.drawVisorGlint(ctx, -62, 62, -20, 12, '#00E676');
    }

    // Dynamic animated laser glare across the glossy visor
    drawVisorGlint(ctx, minX, maxX, minY, maxY, tintColor) {
        ctx.save();
        const sweepPhase = (this.time * 1.5) % 3.0; // 0 to 3s loop
        if (sweepPhase < 1.2) {
            const progress = sweepPhase / 1.2;
            const glintX = minX + (maxX - minX) * progress;
            const grad = ctx.createLinearGradient(glintX - 25, 0, glintX + 25, 0);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(0.5, 'rgba(255,255,255,0.85)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');

            ctx.fillStyle = grad;
            ctx.fillRect(glintX - 25, minY, 50, maxY - minY);
        }

        // Edge rim glow
        ctx.strokeStyle = tintColor;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5 + Math.sin(this.time * 4) * 0.25;
        ctx.stroke();
        ctx.restore();
    }

    // High-tech HUD grid inside visor
    drawVisorGrid(ctx, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.35;
        for (let x = -50; x <= 50; x += 15) {
            ctx.beginPath();
            ctx.moveTo(x, -20);
            ctx.lineTo(x, 15);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Render screen flash & lightning shockwaves during morph
    renderTransformationEffects(ctx, width, height, dt) {
        // 1. Fullscreen flash
        if (this.flashAlpha > 0.01) {
            ctx.save();
            ctx.fillStyle = this.flashColor;
            ctx.globalAlpha = this.flashAlpha * 0.75;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
            this.flashAlpha -= dt * 2.2;
        }

        // 2. Radial lightning bolts
        if (this.lightningBolts.length > 0) {
            ctx.save();
            ctx.translate(width * 0.5, height * 0.45);
            ctx.globalCompositeOperation = 'screen';

            for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
                const bolt = this.lightningBolts[i];
                bolt.life -= dt * 2.8;
                if (bolt.life <= 0) {
                    this.lightningBolts.splice(i, 1);
                    continue;
                }

                ctx.strokeStyle = bolt.color;
                ctx.lineWidth = bolt.width * bolt.life;
                ctx.shadowColor = bolt.color;
                ctx.shadowBlur = 15;
                ctx.globalAlpha = bolt.life;

                ctx.beginPath();
                for (let j = 0; j < bolt.segments.length; j++) {
                    const pt = bolt.segments[j];
                    if (j === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // Holographic Circular Hold-to-Charge Ring around hand
    renderChargeRing(ctx, width, height, chargeData, config) {
        if (!chargeData || !chargeData.isCharging || chargeData.chargeProgress <= 0) return;

        const cx = chargeData.handCenter.x * width;
        const cy = chargeData.handCenter.y * height;
        const radius = 55;
        const progress = Math.min(1.0, chargeData.chargeProgress);
        const color = config ? config.themeColor : '#00E5FF';

        ctx.save();
        ctx.translate(cx, cy);

        // Rotating outer dashed ring
        ctx.save();
        ctx.rotate(this.time * 2.5);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.arc(0, 0, radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Background track
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Filling progress arc with intense neon glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.strokeStyle = color;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, radius, -Math.PI * 0.5, -Math.PI * 0.5 + progress * Math.PI * 2);
        ctx.stroke();

        // Inner pulsing power core
        const pulse = 1 + Math.sin(this.time * 12) * 0.15;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.25 + progress * 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, (radius - 12) * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Percentage text or icon in center
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(progress * 100)}%`, 0, 0);

        ctx.restore();
    }
}

// Global AR renderer
window.rangerARRenderer = new RangerARRenderer();
