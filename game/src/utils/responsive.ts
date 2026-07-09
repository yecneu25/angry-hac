/**
 * responsive.ts — Shared layout helper for Angry Hạc.
 *
 * Strategy: Desktop / tablet / portrait (height ≥ 500 px) is NEVER touched —
 * `getLayout` returns the original desktop constants there, so that experience
 * stays pixel-identical. Only short landscape phones (height < 500 AND
 * width > height) get adapted values, and those values now scale CONTINUOUSLY
 * with the real viewport instead of snapping to a single hard-coded set — so
 * the UI fits every phone size (small, medium, tall, notched) rather than only
 * one assumed ~390 px design height.
 */

/** Clamp without pulling in Phaser (keeps this module dependency-free). */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Linear interpolate. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export interface SafeInsets {
  top: number; right: number; bottom: number; left: number;
}

// Reading env(safe-area-inset-*) forces a style reflow, so cache it keyed by
// the viewport size and only recompute when the viewport actually changes
// (orientation flip, browser-chrome show/hide).
let insetCache: { key: string; insets: SafeInsets } | null = null;

/**
 * The device safe-area insets (notch / home indicator), read from the CSS
 * env() values that `viewport-fit=cover` exposes. Returns zeros on browsers /
 * devices without a cutout. Falls back gracefully when the DOM isn't ready.
 */
export function getSafeInsets(): SafeInsets {
  const key = `${window.innerWidth}x${window.innerHeight}`;
  if (insetCache && insetCache.key === key) return insetCache.insets;

  const zero: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof document === 'undefined' || !document.body) return zero;

  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
    'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets: SafeInsets = {
    top:    parseFloat(cs.paddingTop)    || 0,
    right:  parseFloat(cs.paddingRight)  || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left:   parseFloat(cs.paddingLeft)   || 0,
  };
  probe.remove();
  insetCache = { key, insets };
  return insets;
}

export interface LayoutMode {
  /** True when we're in a short landscape viewport (phone sideways). */
  mobile: boolean;
  /**
   * Continuous UI element size multiplier.
   * 1.0 on desktop; on mobile it scales with the viewport height around a
   * 390 px reference, clamped to [0.6, 1.0] so tiny heights still fit and we
   * never blow past the desktop size.
   */
  uiScale: number;
  /** Height of the top HUD bar in px (64 desktop, 34–46 scaled on mobile). */
  hudH: number;
  /** First usable y BELOW the top HUD bar (accounts for a top notch). */
  safeTop: number;
  /** Last usable y ABOVE the bottom edge (accounts for the home indicator). */
  safeBottom: number;
  /** Left inset in px (landscape notch); 0 on desktop. */
  safeLeft: number;
  /** Right inset in px (landscape notch); 0 on desktop. */
  safeRight: number;
  /** Convenience — the viewport these values were computed for. */
  width: number;
  height: number;
}

/**
 * Returns layout constants appropriate for the current viewport.
 * Call once at the top of each scene's `create()`.
 */
export function getLayout(width: number, height: number): LayoutMode {
  const mobile = height < 500 && width > height;

  if (!mobile) {
    // Desktop / tablet / portrait — original constants, untouched.
    return {
      mobile: false,
      uiScale: 1,
      hudH: 64,
      safeTop: 64,
      safeBottom: height - 8,
      safeLeft: 0,
      safeRight: 0,
      width, height,
    };
  }

  // ── Mobile landscape: continuous scaling ────────────────────────────────
  const insets  = getSafeInsets();
  const uiScale = clamp(height / 390, 0.6, 1);
  const hudH    = Math.round(clamp(height * 0.11, 34, 46));

  return {
    mobile: true,
    uiScale,
    hudH,
    safeTop:    hudH + insets.top,
    safeBottom: height - Math.max(8, insets.bottom),
    safeLeft:   insets.left,
    safeRight:  insets.right,
    width, height,
  };
}
