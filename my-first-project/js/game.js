/**
 * Morphin Time: Ranger AR Studio - Battle Mode Engine
 * "Defend the Command Center" interactive mini-game.
 * Meteors spawn from screen edges; morphed players shoot colored laser beams
 * from their hand landmarks to obliterate threats and rack up combo scores!
 */

class RangerBattleGame {
    constructor() {
        this.isActive = false;
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('ranger_highscore') || '0', 10);
        this.combo = 1;
        this.comboTimer = 0;
        this.shield = 100; // Command center shield 0-100%
        this.wave = 1;
        this.waveTimer = 0;

        this.meteors = [];
        this.lasers = [];
        this.particles = [];
        this.floatingTexts = [];

        this.spawnTimer = 0;
        this.fireCooldown = 0;
        this.screenShake = 0;

        // Callback for HUD UI updates
        this.onStatsUpdate = null; // function(stats)
    }

    start() {
        this.isActive = true;
        this.score = 0;
        this.combo = 1;
        this.shield = 100;
        this.wave = 1;
        this.waveTimer = 0;
        this.meteors = [];
        this.lasers = [];
        this.particles = [];
        this.floatingTexts = [];
        this.notifyStats();
    }

    stop() {
        this.isActive = false;
        this.notifyStats();
    }

    toggle() {
        if (this.isActive) this.stop();
        else this.start();
        return this.isActive;
    }

    notifyStats() {
        if (this.onStatsUpdate) {
            this.onStatsUpdate({
                isActive: this.isActive,
                score: this.score,
                highScore: this.highScore,
                combo: this.combo,
                shield: Math.max(0, Math.round(this.shield)),
                wave: this.wave
            });
        }
    }

    // Spawn a meteor or plasma core from outside canvas border
    spawnMeteor(width, height) {
        const edge = Math.floor(Math.random() * 4); // 0: Top, 1: Right, 2: Bottom, 3: Left
        let x = 0, y = 0;
        const padding = 40;

        switch (edge) {
            case 0: // Top
                x = Math.random() * width;
                y = -padding;
                break;
            case 1: // Right
                x = width + padding;
                y = Math.random() * height;
                break;
            case 2: // Bottom
                x = Math.random() * width;
                y = height + padding;
                break;
            case 3: // Left
                x = -padding;
                y = Math.random() * height;
                break;
        }

        // Target: Center of Command Center (approx 50% width, 60% height)
        const targetX = width * 0.5 + (Math.random() - 0.5) * 120;
        const targetY = height * 0.6 + (Math.random() - 0.5) * 120;
        const angle = Math.atan2(targetY - y, targetX - x);

        const baseSpeed = 100 + this.wave * 18;
        const speed = baseSpeed + Math.random() * 60;
        const isElite = Math.random() < 0.22;
        const radius = isElite ? 34 : 22 + Math.random() * 8;

        this.meteors.push({
            x,
            y,
            targetX,
            targetY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius,
            hp: isElite ? 3 : 1,
            maxHp: isElite ? 3 : 1,
            isElite,
            color: isElite ? '#FF0055' : '#FF9100',
            glowColor: isElite ? 'rgba(255, 0, 85, 0.8)' : 'rgba(255, 145, 0, 0.8)',
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 3,
            pulsePhase: Math.random() * Math.PI * 2
        });
    }

    // Main update loop
    update(dt, canvasWidth, canvasHeight, handData, currentRanger, rangerConfig) {
        if (!this.isActive) return;

        // Wave progression
        this.waveTimer += dt;
        if (this.waveTimer > 18.0) {
            this.waveTimer = 0;
            this.wave++;
            this.addFloatingText(canvasWidth * 0.5, canvasHeight * 0.35, `WAVE ${this.wave}!`, '#FFD700', 36);
            this.notifyStats();
        }

        // Combo decay
        if (this.combo > 1) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 1;
                this.notifyStats();
            }
        }

        // Screen shake decay
        if (this.screenShake > 0) {
            this.screenShake = Math.max(0, this.screenShake - dt * 25);
        }

        // Spawn meteor check
        this.spawnTimer -= dt;
        const spawnInterval = Math.max(0.65, 2.2 - this.wave * 0.18);
        if (this.spawnTimer <= 0 && this.meteors.length < 14) {
            this.spawnMeteor(canvasWidth, canvasHeight);
            this.spawnTimer = spawnInterval;
        }

        // Update player targeting & firing
        this.updatePlayerWeapon(dt, canvasWidth, canvasHeight, handData, currentRanger, rangerConfig);

        // Update existing meteors
        const coreX = canvasWidth * 0.5;
        const coreY = canvasHeight * 0.6;
        const coreHitRadius = 55;

        for (let i = this.meteors.length - 1; i >= 0; i--) {
            const m = this.meteors[i];
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            m.rotation += m.rotSpeed * dt;
            m.pulsePhase += dt * 4;

            // Check if meteor impacted Command Center core
            const distToCore = Math.hypot(m.x - coreX, m.y - coreY);
            if (distToCore < coreHitRadius + m.radius) {
                // Impact!
                this.shield = Math.max(0, this.shield - (m.isElite ? 22 : 12));
                this.screenShake = 14;
                this.combo = 1;
                if (window.rangerAudio) {
                    window.rangerAudio.playExplosionSfx(1.4);
                }
                this.createExplosionParticles(m.x, m.y, '#FF1744', 35);
                this.addFloatingText(m.x, m.y, `SHIELD DAMAGED!`, '#FF1744', 22);
                this.meteors.splice(i, 1);
                this.notifyStats();

                if (this.shield <= 0) {
                    this.addFloatingText(coreX, coreY - 40, `COMMAND SHIELD OFFLINE!`, '#FF1744', 32);
                }
            }
        }

        // Update laser beams
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const l = this.lasers[i];
            l.life -= dt * 6.5; // fades fast
            if (l.life <= 0) {
                this.lasers.splice(i, 1);
            }
        }

        // Update debris particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const t = this.floatingTexts[i];
            t.y -= 45 * dt;
            t.life -= dt;
            if (t.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    // Player aiming with hand and firing lasers
    updatePlayerWeapon(dt, width, height, handData, currentRanger, rangerConfig) {
        if (!currentRanger || !rangerConfig || !handData || !handData.handCenter) return;

        this.fireCooldown -= dt;

        // Hand pixel position
        const handX = handData.handCenter.x * width;
        const handY = handData.handCenter.y * height;

        // Find nearest meteor to hand crosshair
        let closestMeteor = null;
        let closestDist = Infinity;

        for (const m of this.meteors) {
            const dist = Math.hypot(m.x - handX, m.y - handY);
            if (dist < closestDist) {
                closestDist = dist;
                closestMeteor = m;
            }
        }

        // Auto-lock & fire when aimed within proximity or continuous pulse
        // Range: 220px lock-on radius, or auto-fire at nearest if player is morphed
        const lockOnRadius = 260;
        if (closestMeteor && closestDist < lockOnRadius && this.fireCooldown <= 0) {
            this.fireLaser(handX, handY, closestMeteor, rangerConfig);
            this.fireCooldown = 0.20; // 5 shots per second
        }
    }

    fireLaser(startX, startY, targetMeteor, rangerConfig) {
        const themeColor = rangerConfig.themeColor || '#FF1E1E';
        const targetX = targetMeteor.x;
        const targetY = targetMeteor.y;

        // Add laser beam
        this.lasers.push({
            x1: startX,
            y1: startY,
            x2: targetX,
            y2: targetY,
            color: themeColor,
            accentColor: rangerConfig.accentColor || '#FFFFFF',
            life: 1.0
        });

        // Laser SFX
        if (window.rangerAudio) {
            window.rangerAudio.playLaserSfx(1.0 + Math.random() * 0.25);
        }

        // Apply damage to target meteor
        targetMeteor.hp -= 1;
        this.createSparks(targetX, targetY, themeColor, 12);

        if (targetMeteor.hp <= 0) {
            // Obliterated!
            const idx = this.meteors.indexOf(targetMeteor);
            if (idx !== -1) {
                this.meteors.splice(idx, 1);
            }

            // Explosion & scoring
            if (window.rangerAudio) {
                window.rangerAudio.playExplosionSfx(targetMeteor.isElite ? 1.2 : 0.85);
            }
            this.createExplosionParticles(targetX, targetY, targetMeteor.color, targetMeteor.isElite ? 45 : 24);

            // Combo & Points
            const basePoints = targetMeteor.isElite ? 350 : 100;
            const earnedPoints = basePoints * this.combo;
            this.score += earnedPoints;

            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('ranger_highscore', this.highScore.toString());
            }

            this.combo++;
            this.comboTimer = 2.8; // 2.8s combo window
            if (window.rangerAudio && this.combo > 2) {
                window.rangerAudio.playComboSfx(this.combo);
            }

            const comboLabel = this.combo > 2 ? ` (+${earnedPoints} COMBO x${this.combo}!)` : ` (+${earnedPoints})`;
            this.addFloatingText(targetX, targetY - 15, comboLabel, themeColor, 20);
            this.notifyStats();
        }
    }

    createSparks(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 120 + Math.random() * 200;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                size: 2.5 + Math.random() * 3,
                life: 0.25 + Math.random() * 0.2,
                maxLife: 0.4
            });
        }
    }

    createExplosionParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 260;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                size: 4 + Math.random() * 6,
                life: 0.45 + Math.random() * 0.35,
                maxLife: 0.8
            });
        }
    }

    addFloatingText(x, y, text, color, fontSize = 20) {
        this.floatingTexts.push({
            x,
            y,
            text,
            color,
            fontSize,
            life: 1.1,
            maxLife: 1.1
        });
    }

    // Render battle elements on canvas
    render(ctx, width, height, handData, currentRanger, rangerConfig) {
        if (!this.isActive) return;

        // Apply screen shake
        if (this.screenShake > 0) {
            const sx = (Math.random() - 0.5) * this.screenShake;
            const sy = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(sx, sy);
        }

        // 1. Draw Command Center Core Shield in the center
        this.renderCommandCore(ctx, width * 0.5, height * 0.6);

        // 2. Draw Meteors
        for (const m of this.meteors) {
            this.renderMeteor(ctx, m);
        }

        // 3. Draw Laser Beams
        this.renderLasers(ctx);

        // 4. Draw Particles
        this.renderParticles(ctx);

        // 5. Draw Hand Targeting Reticle
        if (handData && handData.handCenter) {
            this.renderTargetingReticle(ctx, width, height, handData, currentRanger, rangerConfig);
        }

        // 6. Draw Floating Texts
        this.renderFloatingTexts(ctx);
    }

    renderCommandCore(ctx, cx, cy) {
        ctx.save();
        const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.08;
        const coreRad = 48 * pulse;

        // Outer shield barrier
        ctx.shadowColor = this.shield > 25 ? '#00E5FF' : '#FF1744';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = this.shield > 25 ? 'rgba(0, 229, 255, 0.45)' : 'rgba(255, 23, 68, 0.65)';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(cx, cy, coreRad + 14, 0, Math.PI * 2);
        ctx.stroke();

        // Inner glowing core
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRad);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.5, this.shield > 25 ? 'rgba(0, 168, 255, 0.4)' : 'rgba(255, 30, 30, 0.4)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, coreRad, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    renderMeteor(ctx, m) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.rotation);

        // Glow
        ctx.shadowColor = m.glowColor;
        ctx.shadowBlur = 20;

        // Jagged asteroid body
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, m.radius);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.4, m.color);
        grad.addColorStop(1, '#212121');

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        const points = 7;
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const r = m.radius * (0.8 + Math.sin(i * 3 + m.pulsePhase) * 0.2);
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Multi-hit health bar for elite meteors
        if (m.maxHp > 1) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(-20, -m.radius - 14, 40, 6);
            ctx.fillStyle = '#00E676';
            const hpWidth = (m.hp / m.maxHp) * 38;
            ctx.fillRect(-19, -m.radius - 13, hpWidth, 4);
        }

        ctx.restore();
    }

    renderLasers(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        for (const l of this.lasers) {
            const alpha = l.life;

            // Outer thick laser glow
            ctx.strokeStyle = l.color;
            ctx.shadowColor = l.color;
            ctx.shadowBlur = 22;
            ctx.lineWidth = 10 * alpha;
            ctx.globalAlpha = alpha * 0.85;

            ctx.beginPath();
            ctx.moveTo(l.x1, l.y1);
            ctx.lineTo(l.x2, l.y2);
            ctx.stroke();

            // Inner intense white core
            ctx.strokeStyle = l.accentColor;
            ctx.lineWidth = 3.5 * alpha;
            ctx.globalAlpha = alpha;

            ctx.beginPath();
            ctx.moveTo(l.x1, l.y1);
            ctx.lineTo(l.x2, l.y2);
            ctx.stroke();
        }

        ctx.restore();
    }

    renderParticles(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (const p of this.particles) {
            const progress = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.globalAlpha = progress;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    renderTargetingReticle(ctx, width, height, handData, currentRanger, rangerConfig) {
        const hx = handData.handCenter.x * width;
        const hy = handData.handCenter.y * height;
        const color = rangerConfig ? rangerConfig.themeColor : '#00E5FF';

        ctx.save();
        ctx.translate(hx, hy);

        const time = performance.now() * 0.003;
        ctx.rotate(time);

        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2;

        // Circular brackets
        const retRad = 32;
        ctx.beginPath();
        ctx.arc(0, 0, retRad, 0, Math.PI * 0.4);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, retRad, Math.PI * 0.5, Math.PI * 0.9);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, retRad, Math.PI, Math.PI * 1.4);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, retRad, Math.PI * 1.5, Math.PI * 1.9);
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(0, -retRad - 8); ctx.lineTo(0, -retRad + 4);
        ctx.moveTo(0, retRad + 8);  ctx.lineTo(0, retRad - 4);
        ctx.moveTo(-retRad - 8, 0); ctx.lineTo(-retRad + 4, 0);
        ctx.moveTo(retRad + 8, 0);  ctx.lineTo(retRad - 4, 0);
        ctx.stroke();

        // Center beacon point
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    renderFloatingTexts(ctx) {
        ctx.save();
        for (const t of this.floatingTexts) {
            const alpha = t.life / t.maxLife;
            ctx.font = `bold ${t.fontSize}px 'Orbitron', monospace`;
            ctx.textAlign = 'center';
            ctx.fillStyle = t.color;
            ctx.shadowColor = t.color;
            ctx.shadowBlur = 12;
            ctx.globalAlpha = alpha;
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.restore();
    }
}

// Global battle game
window.rangerBattleGame = new RangerBattleGame();
