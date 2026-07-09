// Shared background-music controller — every scene calls ensureBgMusic() +
// armMusicWatchdog() from create().
//
// REWRITTEN to play through a plain HTMLAudioElement instead of Phaser's
// WebAudio sound manager. Root cause of the "no music on phone, but YouTube
// plays fine" report: iOS mutes ALL Web Audio API output while the hardware
// silent/ringer switch is on, but media elements (<audio>/<video> — what
// YouTube uses) are treated as deliberate media playback and keep playing
// once user-initiated. Since this game's only sound IS the theme track (no
// Phaser SFX anywhere), routing it through a media element makes it behave
// exactly like YouTube on every device. Side benefits on weak phones: no
// decodeAudioData of the whole 1.4MB mp3 into ~26MB of PCM up front
// (streams progressively instead — also starts faster), and the element is
// completely independent of any scene/loader lifecycle, so scene restarts
// (e.g. the orientation-change restart) can never kill or re-trigger it.
//
// Design goal (user: "tôi muốn nó dừng chỉ khi tôi bấm nút dừng"): the
// track should NEVER go silent except by the player's own mute action.
// `sound_enabled` in localStorage is the single source of truth; a
// visibilitychange + pointerdown watchdog re-calls play() whenever the
// browser paused us behind our back. play() inside a pointerdown handler
// always satisfies the autoplay policy, so the first tap anywhere in the
// game is guaranteed to start the music even if the initial autoplay
// attempt was blocked.
import type Phaser from 'phaser';
import { AUDIO } from '../assetManifest';

let el: HTMLAudioElement | null = null;

function isEnabled(): boolean {
  return localStorage.getItem('sound_enabled') !== 'false';
}

function ensureElement(): HTMLAudioElement {
  if (el) return el;
  el = new Audio(AUDIO.themesong);
  el.loop = true;
  el.volume = 0.45;
  el.preload = 'auto';
  // iOS: without this, some webviews route the element into a fullscreen
  // native player the moment it starts.
  (el as unknown as { playsInline: boolean }).playsInline = true;
  if (import.meta.env.DEV) (window as any).__BG_MUSIC__ = el;
  return el;
}

/** Attempt playback (no-op if already playing or muted by the player).
 *  A rejected play() (autoplay policy, transient OS interruption) is
 *  swallowed — the watchdog retries on the next tap/focus, and a play()
 *  issued from inside a real gesture handler cannot be rejected. */
function tryPlay() {
  if (!isEnabled()) return;
  const a = ensureElement();
  if (a.paused) a.play().catch(() => { /* retried by watchdog on next gesture */ });
}

/** Ensures the theme track exists and is playing (unless muted). Safe to
 *  call from every scene's create() — the element is a module singleton, so
 *  repeat calls and scene restarts are free. The scene param is kept only
 *  for call-site compatibility. */
export function ensureBgMusic(_scene: Phaser.Scene) {
  tryPlay();
}

let watchdogArmed = false;

/** Arms ONE-TIME, module-level listeners that resume playback whenever the
 *  tab regains focus or the player taps anywhere — unless they muted it. */
export function armMusicWatchdog(_scene: Phaser.Scene) {
  if (watchdogArmed) return;
  watchdogArmed = true;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tryPlay();
  });
  // The first tap is also what satisfies the autoplay policy — play() called
  // synchronously inside this handler is always allowed to start.
  document.addEventListener('pointerdown', tryPlay, { passive: true });
}

/** Toggle mute from any scene's sound button. Mute pauses outright (the
 *  player asked for silence — keeping a muted stream running just burns
 *  battery); unmute resumes from where it stopped. Returns the NEW muted
 *  state, same contract the scenes' speaker buttons were built against. */
export function toggleMute(_scene: Phaser.Scene): boolean {
  const nextMuted = isEnabled(); // currently enabled -> we're muting now
  localStorage.setItem('sound_enabled', nextMuted ? 'false' : 'true');
  if (nextMuted) {
    el?.pause();
  } else {
    tryPlay();
  }
  return nextMuted;
}

export function isMuted(_scene: Phaser.Scene): boolean {
  return !isEnabled();
}
