// Draws a vertical 9:16 frame of a clip. The editor preview and the exporter use the
// exact same function, so what you see is what you upload.
const Render = (() => {
  const BASE_W = 1080; // all sizes below are in 1080x1920 units

  const STYLES = {
    classic: { label: 'Classic', fill: '#ffffff', stroke: '#000000', strokeW: 14 },
    gold:    { label: 'Gold',    fill: '#ffd23f', stroke: '#000000', strokeW: 14 },
    neon:    { label: 'Neon',    fill: '#ff4fd8', stroke: '#2a0030', strokeW: 10, glow: '#ff4fd8' },
    sunset:  { label: 'Sunset',  fill: '#ff8a3d', stroke: '#2b0a00', strokeW: 12, glow: '#ff3d77' },
    boxed:   { label: 'Boxed',   fill: '#111111', box: '#ffffff' },
    alert:   { label: 'Alert',   fill: '#ffffff', box: '#e0162b' },
  };

  const FONT = '900 {S}px "Arial Black", Impact, "Helvetica Neue", system-ui, sans-serif';

  // Envelope for the "punch in" zoom and slow-mo around the peak moment.
  function peakEnv(t, peak) {
    const d = t - peak;
    if (d < -0.35 || d > 1.6) return 0;
    if (d < 0) return 1 - Math.pow(-d / 0.35, 2); // fast ease in
    if (d < 0.6) return 1;
    return 1 - (d - 0.6) / 1.0; // ease out
  }

  function speedAt(clip, t) {
    let r = clip.speed || 1;
    if (clip.fx.slowmo && clip.peak != null && t >= clip.peak - 0.6 && t <= clip.peak + 1.4) r *= 0.4;
    return r;
  }

  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = 54; blurCanvas.height = 96;
  const blurCtx = blurCanvas.getContext('2d');

  function wrapLines(ctx, text, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
      }
      if (line) out.push(line);
    }
    return out;
  }

  function drawText(ctx, k, text, styleKey, size, yFrac, W, H, align = 'center') {
    if (!text || !text.trim()) return;
    const st = STYLES[styleKey] || STYLES.classic;
    const px = size * k;
    ctx.save();
    ctx.font = FONT.replace('{S}', Math.round(px));
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const lines = wrapLines(ctx, text, W * 0.86);
    const lh = px * 1.12;
    const total = lh * lines.length;
    let y = H * yFrac - total / 2 + lh / 2;
    const x = W / 2;
    for (const line of lines) {
      if (st.box) {
        const w = ctx.measureText(line).width + px * 0.6;
        const h = lh * 1.02;
        ctx.fillStyle = st.box;
        roundRect(ctx, x - w / 2, y - h / 2, w, h, px * 0.22);
        ctx.fill();
        ctx.fillStyle = st.box === '#ffffff' ? st.fill : '#ffffff';
        ctx.fillText(line, x, y + px * 0.04);
      } else {
        if (st.glow) { ctx.shadowColor = st.glow; ctx.shadowBlur = 28 * k; }
        ctx.lineWidth = st.strokeW * k;
        ctx.strokeStyle = st.stroke;
        ctx.strokeText(line, x, y);
        ctx.shadowBlur = 0;
        ctx.fillStyle = st.fill;
        ctx.fillText(line, x, y);
      }
      y += lh;
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // t = current time in the source video.
  function draw(ctx, W, H, video, clip, t, opts = {}) {
    const k = W / BASE_W;
    const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    let zoom = clip.frame.zoom || 1;
    if (clip.fx.punch && clip.peak != null) zoom *= 1 + 0.28 * peakEnv(t, clip.peak);
    let shakeX = 0, shakeY = 0;
    if (clip.fx.shake && clip.peak != null) {
      const e = peakEnv(t, clip.peak);
      if (e > 0) { shakeX = Math.sin(t * 91) * 18 * k * e; shakeY = Math.cos(t * 77) * 14 * k * e; }
    }
    const panX = clip.frame.panX ?? 0.5, panY = clip.frame.panY ?? 0.5;
    const layout = clip.frame.layout || 'fill';

    if (video.readyState >= 2) {
      if (layout === 'stream') {
        // Facecam (cropped from the source) stacked on top of the gameplay.
        const cam = clip.frame.cam || { x: 0.02, y: 0.02, w: 0.28, h: 0.28 };
        const split = clip.frame.split ?? 0.38;
        const camH = Math.round(H * split);
        const sx = cam.x * vw, sy = cam.y * vh, sw = cam.w * vw, sh = cam.h * vh;
        // Cover-fit the cam crop into W x camH.
        const want = W / camH, have = sw / sh;
        let cx = sx, cy = sy, cw = sw, ch = sh;
        if (have > want) { cw = sh * want; cx = sx + (sw - cw) / 2; } else { ch = sw / want; cy = sy + (sh - ch) / 2; }
        ctx.drawImage(video, cx, cy, cw, ch, 0, 0, W, camH);
        // Gameplay fills the rest.
        const gh = H - camH;
        const s = Math.max(W / vw, gh / vh) * zoom;
        const dw = vw * s, dh = vh * s;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, camH, W, gh); ctx.clip();
        ctx.drawImage(video, (W - dw) * panX + shakeX, camH + (gh - dh) * panY + shakeY, dw, dh);
        ctx.restore();
        ctx.fillStyle = '#ff3ea5';
        ctx.fillRect(0, camH - 4 * k, W, 8 * k);
      } else if (layout === 'fill') {
        const s = Math.max(W / vw, H / vh) * zoom;
        const dw = vw * s, dh = vh * s;
        ctx.drawImage(video, (W - dw) * panX + shakeX, (H - dh) * panY + shakeY, dw, dh);
      } else {
        if (layout === 'blur') {
          // Cheap, portable blur: draw tiny, then scale back up.
          const s0 = Math.max(blurCanvas.width / vw, blurCanvas.height / vh);
          blurCtx.drawImage(video, (blurCanvas.width - vw * s0) / 2, (blurCanvas.height - vh * s0) / 2, vw * s0, vh * s0);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(blurCanvas, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1);
          ctx.fillStyle = 'rgba(0,0,0,.45)';
          ctx.fillRect(0, 0, W, H);
        }
        const s = (W / vw) * zoom;
        const dw = vw * s, dh = vh * s;
        const x = (W - dw) * panX;
        const y = H * 0.5 - dh / 2 + (panY - 0.5) * H * 0.5;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, Math.max(0, y), W, Math.min(H, dh));
        ctx.clip();
        ctx.drawImage(video, x + shakeX, y + shakeY, dw, dh);
        ctx.restore();
      }
    }

    // Flash on the hit.
    if (clip.fx.flash && clip.peak != null) {
      const d = t - clip.peak;
      if (d >= 0 && d < 0.25) { ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - d / 0.25)})`; ctx.fillRect(0, 0, W, H); }
    }

    const tx = clip.text;
    drawText(ctx, k, tx.hook, tx.style, tx.size, tx.y, W, H);
    // Caption that only shows from the peak onwards (the "payoff" line).
    if (tx.payoff && (clip.peak == null || t >= clip.peak)) drawText(ctx, k, tx.payoff, tx.payoffStyle || tx.style, tx.size * 0.85, tx.payoffY ?? 0.72, W, H);

    // Timed captions (subtitles), with a quick "pop" as each one appears.
    const caps = clip.captions || [];
    for (const cap of caps) {
      if (t < cap.start || t >= cap.end || !cap.text) continue;
      const cy = H * (tx.capY ?? 0.6);
      const pop = tx.capPop === false ? 1 : 0.82 + 0.18 * Math.min(1, (t - cap.start) / 0.12);
      ctx.save();
      ctx.translate(W / 2, cy); ctx.scale(pop, pop); ctx.translate(-W / 2, -cy);
      drawText(ctx, k, tx.capUpper === false ? cap.text : cap.text.toUpperCase(), tx.capStyle || 'classic', tx.capSize || 66, tx.capY ?? 0.6, W, H);
      ctx.restore();
      break;
    }

    if (tx.handle) {
      ctx.save();
      ctx.font = `800 ${Math.round(38 * k)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.shadowColor = 'rgba(0,0,0,.8)';
      ctx.shadowBlur = 8 * k;
      ctx.fillText(tx.handle, W / 2, H * 0.865);
      ctx.restore();
    }

    if (clip.fx.progress) {
      const p = Math.max(0, Math.min(1, (t - clip.in) / Math.max(0.01, clip.out - clip.in)));
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(0, H - 12 * k, W, 12 * k);
      ctx.fillStyle = '#ff3ea5';
      ctx.fillRect(0, H - 12 * k, W * p, 12 * k);
    }

    if (opts.watermark) drawWatermark(ctx, k, W, H);

    if (opts.guides) {
      // Where YouTube's own buttons and caption sit on Shorts.
      ctx.save();
      ctx.fillStyle = 'rgba(255,62,165,.12)';
      ctx.fillRect(W * 0.86, H * 0.45, W * 0.14, H * 0.5);
      ctx.fillRect(0, H * 0.84, W * 0.86, H * 0.16);
      ctx.restore();
    }
  }

  const logo = new Image();
  logo.src = 'icon.svg';

  function drawWatermark(ctx, k, W, H) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    const s = 64 * k, x = W - 300 * k, y = H * 0.045;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    roundRect(ctx, x - 12 * k, y - 10 * k, 290 * k, s + 20 * k, 20 * k);
    ctx.fill();
    if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, x, y, s, s);
    ctx.font = `900 ${Math.round(34 * k)}px "Arial Black", Impact, system-ui, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText('Clip Heist', x + s + 12 * k, y + s / 2 + 2 * k);
    ctx.restore();
  }

  // Branded closing frame for free-plan exports.
  function drawEndCard(ctx, W, H, p) {
    const k = W / BASE_W;
    ctx.fillStyle = '#0b0b10';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.8);
    g.addColorStop(0, 'rgba(255,62,165,.35)'); g.addColorStop(1, 'rgba(255,62,165,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const e = Math.min(1, p * 3), sc = 0.7 + 0.3 * (1 - Math.pow(1 - e, 3));
    const s = 360 * k * sc;
    if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, W / 2 - s / 2, H * 0.3 - s / 2, s, s);
    ctx.save();
    ctx.globalAlpha = e;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(120 * k)}px "Arial Black", Impact, system-ui, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText('Clip Heist', W / 2, H * 0.47);
    ctx.font = `700 ${Math.round(44 * k)}px system-ui, sans-serif`;
    ctx.fillStyle = '#c9c9da';
    ctx.fillText('Made with Clip Heist', W / 2, H * 0.54);
    ctx.restore();
  }

  // Length of the finished short in seconds, accounting for speed and slow-mo.
  function outputDuration(clip) {
    let total = 0;
    const dt = 0.05;
    for (let t = clip.in; t < clip.out; t += dt) total += dt / speedAt(clip, t);
    return total;
  }

  function pickMime() {
    if (typeof MediaRecorder === 'undefined') return null;
    const opts = [
      'video/mp4;codecs=avc1.640028,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return opts.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  }

  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = AC ? new AC() : null;
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // Plays the clip in real time onto a canvas and records it. Call from a tap
  // (getAudioCtx needs a user gesture on phones).
  async function exportClip(clip, blob, settings, onProgress, signal) {
    if (typeof MediaRecorder === 'undefined') throw new Error('This browser can’t record video. Try Chrome or the latest Safari.');
    const H = settings.quality === '720' ? 1280 : 1920;
    const W = H === 1280 ? 720 : 1080;
    const fps = settings.fps || 30;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'auto';
    video.className = 'offscreen';
    document.body.appendChild(video);
    const ac = getAudioCtx();
    let srcNode = null;
    let rec = null;
    const cleanup = () => {
      if (rec && rec.state !== 'inactive') try { rec.stop(); } catch {}
      try { video.pause(); } catch {}
      if (srcNode) try { srcNode.disconnect(); } catch {}
      video.removeAttribute('src'); video.load(); video.remove();
      URL.revokeObjectURL(url);
    };
    try {
      video.src = url;
      await Analyzer.whenReady(video, clip.in);
      const tracks = [];
      const vStream = canvas.captureStream(fps);
      tracks.push(...vStream.getVideoTracks());
      if (ac && !settings.mute) {
        srcNode = ac.createMediaElementSource(video);
        const dest = ac.createMediaStreamDestination();
        const gain = ac.createGain();
        gain.gain.value = settings.volume ?? 1;
        srcNode.connect(gain).connect(dest);
        tracks.push(...dest.stream.getAudioTracks());
      } else {
        video.muted = true;
      }
      const mime = pickMime();
      rec = new MediaRecorder(new MediaStream(tracks), {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: H === 1920 ? 10_000_000 : 6_000_000,
        audioBitsPerSecond: 192_000,
      });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((res) => { rec.onstop = res; });

      await Analyzer.seek(video, clip.in);
      draw(ctx, W, H, video, clip, clip.in, { watermark: settings.watermark });
      video.playbackRate = speedAt(clip, clip.in);
      rec.start(500);
      await video.play();

      const total = outputDuration(clip) + (settings.endCard ? 1.2 : 0);
      const started = performance.now();
      await new Promise((resolve, reject) => {
        let finished = false;
        const tick = () => {
          if (finished) return;
          if (signal && signal.aborted) { finished = true; reject(new DOMException('Cancelled', 'AbortError')); return; }
          const t = video.currentTime;
          const r = speedAt(clip, t);
          if (Math.abs(video.playbackRate - r) > 0.001) video.playbackRate = r;
          draw(ctx, W, H, video, clip, t, { watermark: settings.watermark });
          onProgress(Math.min(0.99, (performance.now() - started) / 1000 / total));
          if (t >= clip.out || video.ended) { finished = true; resolve(); return; }
          schedule();
        };
        const schedule = () => (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick));
        // rVFC stops firing once the video ends, so also watch with a timer.
        const guard = setInterval(() => { if (finished) clearInterval(guard); else if (video.ended || video.currentTime >= clip.out) tick(); }, 250);
        schedule();
      });
      video.pause();
      if (settings.endCard) {
        const t0 = performance.now();
        await new Promise((resolve) => {
          const frame = () => {
            const p = (performance.now() - t0) / 1200;
            drawEndCard(ctx, W, H, Math.min(1, p));
            if (p >= 1) resolve(); else requestAnimationFrame(frame);
          };
          frame();
        });
      } else {
        draw(ctx, W, H, video, clip, clip.out, { watermark: settings.watermark });
      }
      await new Promise((r) => setTimeout(r, 120));
      rec.stop();
      await stopped;
      const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
      onProgress(1);
      return new Blob(chunks, { type });
    } finally {
      cleanup();
    }
  }

  return { draw, STYLES, speedAt, outputDuration, exportClip, getAudioCtx, pickMime };
})();
