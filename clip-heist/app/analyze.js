// Highlight finder: scores every moment of a gameplay video by how loud it gets,
// how suddenly it gets loud (gunfire, crashes, explosions), how much the picture moves,
// and sudden flashes. The peaks become suggested clips.
const Analyzer = (() => {
  const STEP = 0.5; // seconds per analysis cell

  const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // iPhone Safari only reads a video's metadata until something asks for a frame,
  // so "loadeddata" may never fire. Wait for metadata, then seek to force a frame.
  function whenReady(v, t = 0, timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (err) => {
        if (settled) return; settled = true;
        clearTimeout(timer);
        v.removeEventListener('loadedmetadata', onMeta);
        v.removeEventListener('error', onErr);
        err ? reject(err) : resolve(v);
      };
      const onErr = () => finish(new Error('This video format can’t be played on this device.'));
      const onMeta = () => {
        if (!(v.videoWidth > 0)) return finish(new Error('No video picture found in this file.'));
        seek(v, t).then(() => finish());
      };
      const timer = setTimeout(() => finish(new Error('The video took too long to open. Try a shorter recording.')), timeoutMs);
      v.addEventListener('error', onErr);
      if (v.readyState >= 2) { onMeta(); return; }
      if (v.readyState >= 1) onMeta(); else v.addEventListener('loadedmetadata', onMeta);
      try { v.load(); } catch {}
    });
  }

  function makeVideo(url, muted = true) {
    const v = document.createElement('video');
    v.muted = muted; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('playsinline', '');
    if (muted) v.setAttribute('muted', '');
    v.className = 'offscreen';
    document.body.appendChild(v);
    v.src = url;
    return v;
  }

  async function loadVideo(url) {
    const v = makeVideo(url);
    try { return await whenReady(v, 0.1); } catch (e) { v.remove(); throw e; }
  }

  function seek(v, t) {
    return new Promise((resolve) => {
      let finished = false;
      const end = () => { if (finished) return; finished = true; v.removeEventListener('seeked', end); clearTimeout(timer); resolve(); };
      const timer = setTimeout(end, 2500);
      v.addEventListener('seeked', end);
      v.currentTime = Math.min(t, Math.max(0, v.duration - 0.05));
    });
  }

  // Robust z-score (median / MAD) so one giant explosion doesn't flatten everything else.
  // minSpread stops near-constant signals (e.g. silence) from turning tiny blips into huge scores.
  function robustZ(arr, minSpread = 1e-6) {
    const vals = Array.from(arr).filter(Number.isFinite).sort((a, b) => a - b);
    if (!vals.length) return arr.map(() => 0);
    const med = vals[Math.floor(vals.length / 2)];
    const dev = vals.map((x) => Math.abs(x - med)).sort((a, b) => a - b);
    const mad = Math.max(dev[Math.floor(dev.length / 2)] * 1.4826, minSpread);
    return arr.map((x) => (Number.isFinite(x) ? Math.max(-3, Math.min(6, (x - med) / mad)) : 0));
  }

  function smooth(arr, radius) {
    const out = new Array(arr.length).fill(0);
    for (let i = 0; i < arr.length; i++) {
      let s = 0, n = 0;
      for (let j = Math.max(0, i - radius); j <= Math.min(arr.length - 1, i + radius); j++) { s += arr[j]; n++; }
      out[i] = s / n;
    }
    return out;
  }

  async function audioFeatures(blob, cells, opts) {
    // Decoding needs the whole file in memory, so skip it for very large files.
    if (opts.skipAudio) return null;
    if (blob.size > (IS_IOS ? 250 : 700) * 1024 * 1024) return null;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return null;
    try {
      const rate = 16000;
      const ctx = new OAC(1, rate, rate);
      const ab = await blob.arrayBuffer();
      const buf = await new Promise((res, rej) => {
        const p = ctx.decodeAudioData(ab, res, rej);
        if (p && p.then) p.then(res, rej);
      });
      const sr = buf.sampleRate;
      const chans = [];
      for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
      const hop = Math.round(sr * STEP);
      const loud = new Array(cells).fill(-100);
      for (let i = 0; i < cells; i++) {
        const a = i * hop, b = Math.min(a + hop, chans[0].length);
        if (a >= b) break;
        let sum = 0, peak = 0;
        for (const ch of chans) {
          for (let k = a; k < b; k += 2) { const x = ch[k]; sum += x * x; if (x > peak) peak = x; else if (-x > peak) peak = -x; }
        }
        const rms = Math.sqrt(sum / (((b - a) / 2) * chans.length));
        loud[i] = 20 * Math.log10(rms + 1e-6) * 0.7 + 20 * Math.log10(peak + 1e-6) * 0.3;
      }
      // Onset: how much louder than the previous ~3 seconds.
      const onset = loud.map((x, i) => {
        let s = 0, n = 0;
        for (let j = Math.max(0, i - 6); j < i; j++) { s += loud[j]; n++; }
        return n ? Math.max(0, x - s / n) : 0;
      });
      return { loud, onset };
    } catch (e) {
      console.warn('Audio analysis skipped:', e);
      return null;
    }
  }

  async function visualFeatures(v, duration, cells, onProgress) {
    // Each seek costs ~50–150 ms on a phone, so cap the number of samples.
    const interval = Math.max(0.5, Math.ceil((duration / 500) * 2) / 2);
    const W = 48, H = 27;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const motion = new Array(cells).fill(NaN);
    const flash = new Array(cells).fill(NaN);
    let prev = null, prevBright = null;
    const n = Math.max(1, Math.floor(duration / interval));
    for (let k = 0; k < n; k++) {
      const t = k * interval + interval / 2;
      await seek(v, t);
      ctx.drawImage(v, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      const luma = new Float32Array(W * H);
      let bright = 0;
      for (let p = 0, q = 0; p < d.length; p += 4, q++) { luma[q] = d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114; bright += luma[q]; }
      bright /= W * H;
      let diff = 0;
      if (prev) for (let q = 0; q < luma.length; q++) diff += Math.abs(luma[q] - prev[q]);
      const cell = Math.min(cells - 1, Math.floor(t / STEP));
      motion[cell] = prev ? diff / luma.length : NaN;
      flash[cell] = prevBright == null ? NaN : Math.max(0, bright - prevBright);
      prev = luma; prevBright = bright;
      if (k % 4 === 0) onProgress(k / n);
    }
    // Fill gaps between samples.
    for (const arr of [motion, flash]) {
      let last = 0;
      for (let i = 0; i < arr.length; i++) { if (Number.isFinite(arr[i])) last = arr[i]; else arr[i] = last; }
    }
    return { motion, flash };
  }

  async function thumbAt(v, t, w = 320) {
    await seek(v, t);
    const h = Math.round(w * (v.videoHeight / v.videoWidth || 9 / 16));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(v, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.7);
  }

  async function run(blob, opts, onProgress) {
    const url = URL.createObjectURL(blob);
    onProgress(0.01, 'Opening video…');
    const v = await loadVideo(url);
    try {
      const full = v.duration;
      if (!Number.isFinite(full) || full <= 0) throw new Error('Couldn’t read the video length.');
      const duration = Math.min(full, opts.maxDuration || Infinity); // part of the video to scan
      const cells = Math.max(1, Math.ceil(duration / STEP));
      onProgress(0.02, 'Listening for action…');
      const audio = await audioFeatures(blob, cells, opts);
      onProgress(0.25, 'Watching for action…');
      const vis = await visualFeatures(v, duration, cells, (p) => onProgress(0.25 + p * 0.65, 'Watching for action…'));

      const zLoud = audio ? robustZ(audio.loud, 2) : new Array(cells).fill(0);
      const zOnset = audio ? robustZ(audio.onset, 2) : new Array(cells).fill(0);
      const zMotion = robustZ(vis.motion, 1);
      const zFlash = robustZ(vis.flash, 1);
      const raw = new Array(cells).fill(0).map((_, i) => audio
        ? 0.3 * zLoud[i] + 0.35 * zOnset[i] + 0.25 * zMotion[i] + 0.1 * zFlash[i]
        : 0.7 * zMotion[i] + 0.3 * zFlash[i]);
      const score = smooth(raw, 2);

      // Pick peaks a few seconds apart (big moments often come in quick succession).
      const gap = Math.max(6, opts.postRoll + 3) / STEP;
      const order = score.map((s, i) => i).sort((a, b) => score[b] - score[a]);
      const maxCount = Math.min(20, Math.max(3, Math.round(duration / 45)));
      const picked = [];
      for (const i of order) {
        if (picked.length >= maxCount) break;
        if (picked.length >= 3 && score[i] < 0.6) break;
        if (picked.some((j) => Math.abs(j - i) < gap)) continue;
        picked.push(i);
      }

      const highlights = [];
      for (let i of picked) {
        // Snap to the moment it kicks off (biggest jump in sound/brightness just before the peak).
        const onsetZ = audio ? zOnset : zFlash;
        const lo = Math.max(0, i - 4), hi = Math.min(cells - 1, i + 1);
        let top = -Infinity;
        for (let j = lo; j <= hi; j++) top = Math.max(top, onsetZ[j]);
        if (top > 1) { for (let j = lo; j <= hi; j++) if (onsetZ[j] >= top * 0.8) { i = j; break; } }
        const t = i * STEP;
        const tags = [];
        if (audio && zOnset[i] > 1.5) tags.push('boom');
        if (audio && zLoud[i] > 1.5) tags.push('loud');
        if (zMotion[i] > 1.5) tags.push('chaos');
        if (zFlash[i] > 2) tags.push('flash');
        const start = Math.max(0, t - opts.preRoll);
        const end = Math.min(duration, t + opts.postRoll);
        highlights.push({ id: Math.random().toString(36).slice(2, 10), peak: t, start, end, score: score[i], tags, thumb: null });
      }
      highlights.sort((a, b) => b.score - a.score);
      onProgress(0.92, 'Grabbing thumbnails…');
      // Grab the thumbnail just after the hit, past any white flash.
      for (const h of highlights) h.thumb = await thumbAt(v, Math.min(duration - 0.1, h.peak + 0.7));

      // Downsampled energy curve for the timeline heat strip.
      const POINTS = 240;
      const curve = [];
      for (let p = 0; p < POINTS; p++) {
        const a = Math.floor((p / POINTS) * cells), b = Math.max(a + 1, Math.floor(((p + 1) / POINTS) * cells));
        let m = -Infinity;
        for (let i = a; i < b && i < cells; i++) m = Math.max(m, score[i]);
        curve.push(Number.isFinite(m) ? m : 0);
      }
      const thumb = await thumbAt(v, Math.min(duration * 0.3, highlights[0] ? highlights[0].peak : duration * 0.3));
      onProgress(1, 'Done');
      return {
        duration: full, scanned: duration, width: v.videoWidth, height: v.videoHeight,
        highlights, curve, thumb, audioAnalyzed: !!audio,
      };
    } finally {
      v.removeAttribute('src'); v.load(); v.remove();
      URL.revokeObjectURL(url);
    }
  }

  return { run, loadVideo, makeVideo, whenReady, seek, thumbAt, IS_IOS };
})();
