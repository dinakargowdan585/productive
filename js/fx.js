/* Productive OS - Sensory FX Engine (Web Audio Synth, Haptics, Confetti & Cosmic Dust) */

const FX = {
  audioCtx: null,
  soundEnabled: typeof localStorage !== "undefined" ? localStorage.getItem("productive_sound_fx") !== "false" : true,

  getAudioContext() {
    if (!this.audioCtx && (typeof window.AudioContext !== "undefined" || typeof window.webkitAudioContext !== "undefined")) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  },

  toggleSound(enabled) {
    this.soundEnabled = (enabled !== undefined) ? Boolean(enabled) : !this.soundEnabled;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("productive_sound_fx", this.soundEnabled ? "true" : "false");
    }
    return this.soundEnabled;
  },

  haptic(type = "light") {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        if (type === "success") navigator.vibrate([15, 35, 20]);
        else if (type === "celebrate") navigator.vibrate([20, 40, 20, 40, 50]);
        else if (type === "delete") navigator.vibrate([30, 50, 25]);
        else navigator.vibrate(12);
      } catch (e) {}
    }
  },

  playChime() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "triangle";

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    } catch (e) {}
  },

  playClick() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  },

  playDelete() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.15);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {}
  },

  playCelebration() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + (idx * 0.08);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.36);
      });
    } catch (e) {}
  },

  burstConfetti(originX = window.innerWidth / 2, originY = window.innerHeight / 2) {
    let canvas = document.getElementById("productiveConfettiCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "productiveConfettiCanvas";
      canvas.style.position = "fixed";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "99999";
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const colors = ["#38BDF8", "#6366F1", "#34C759", "#FF9500", "#EC4899", "#A855F7", "#FCD34D"];
    const particles = [];
    const count = 75;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 9 + 4;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
        gravity: 0.22,
        friction: 0.96
      });
    }

    this.playCelebration();
    this.haptic("celebrate");

    let animId = null;
    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let aliveCount = 0;

      particles.forEach(p => {
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.opacity -= 0.012;

        if (p.opacity > 0) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          ctx.restore();
        }
      });

      if (aliveCount > 0) {
        animId = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (animId) cancelAnimationFrame(animId);
      }
    };

    animate();
  },

  initStandbyCosmicCanvas() {
    const canvas = document.getElementById("standbyCosmicCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animFrame = null;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth * dpr : window.innerWidth * dpr;
      canvas.height = canvas.parentElement ? canvas.parentElement.clientHeight * dpr : window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const stars = [];
    const count = 55;
    const w = () => canvas.width / (window.devicePixelRatio || 1);
    const h = () => canvas.height / (window.devicePixelRatio || 1);

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w(),
        y: Math.random() * h(),
        size: Math.random() * 2 + 0.8,
        alpha: Math.random() * 0.7 + 0.2,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: (Math.random() - 0.5) * 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleDir: Math.random() > 0.5 ? 1 : -1
      });
    }

    const draw = () => {
      const width = w();
      const height = h();
      ctx.clearRect(0, 0, width, height);

      stars.forEach(s => {
        s.x += s.speedX;
        s.y += s.speedY;
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height;
        if (s.y > height) s.y = 0;

        s.alpha += s.twinkleSpeed * s.twinkleDir;
        if (s.alpha > 0.85) { s.alpha = 0.85; s.twinkleDir = -1; }
        if (s.alpha < 0.15) { s.alpha = 0.15; s.twinkleDir = 1; }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${s.alpha * 0.7})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(56, 189, 248, 0.6)";
        ctx.fill();
      });

      const standbyView = document.getElementById("viewStandby");
      if (standbyView && standbyView.style.display !== "none") {
        animFrame = requestAnimationFrame(draw);
      }
    };

    draw();
  }
};

window.FX = FX;
