// Free vs Pro. For now the Pro flag is a local test switch; once payments are
// connected it comes from the signed-in account instead.
const Plan = (() => {
  const KEY = 'clip-heist-plan';
  const WEEK = 7 * 24 * 3600 * 1000;
  const LIMITS = {
    exportsPerWeek: 3,
    maxSourceSeconds: 600,   // free scans the first 10 minutes
    maxShortSeconds: 30,
    unlockedHighlights: 3,
    freeStyles: ['classic'],
    freeLayouts: ['fill', 'blur', 'fit'],
  };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));

  function recentExports() {
    const now = Date.now();
    return (load().exports || []).filter((t) => now - t < WEEK);
  }

  return {
    LIMITS,
    isPro: () => !!load().pro,
    setPro(on) { const s = load(); s.pro = !!on; save(s); },
    exportsLeft() { return this.isPro() ? Infinity : Math.max(0, LIMITS.exportsPerWeek - recentExports().length); },
    nextExportAt() { const r = recentExports().sort((a, b) => a - b); return r.length ? r[0] + WEEK : null; },
    recordExport() { const s = load(); s.exports = [...recentExports(), Date.now()]; save(s); },
    resetExports() { const s = load(); s.exports = []; save(s); },
  };
})();
