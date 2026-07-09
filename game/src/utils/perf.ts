// Lightweight low-power-device heuristic (the "adaptive loading" pattern —
// see web.dev/adaptive-loading): fewer logical cores or less device memory
// correlates strongly with weaker GPUs too, even though neither number
// measures the GPU directly. Used to trim purely-decorative overdraw
// (continuous ambient particles, hit-effect burst counts) on devices where
// every extra ADD-blended draw call costs real frame time. Core
// physics/gameplay is untouched so difficulty/feel never changes — only
// how much extra visual dressing gets layered on top.
export const isLowPowerDevice: boolean =
  (navigator.hardwareConcurrency || 8) <= 4 ||
  ((navigator as any).deviceMemory || 8) <= 4;
