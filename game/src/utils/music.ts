// Shared background-music controller — every scene calls ensureBgMusic() +
// armMusicWatchdog() from create() instead of each rolling its own loader/
// play logic (MainMenuScene used to be the only owner, which meant the
// track could silently stay paused if the browser suspended it while the
// player was on a different scene, with nothing left to resume it).
//
// Design goal (user: "tôi muốn nó dừng chỉ khi tôi bấm nút dừng"): the
// track should NEVER go silent except by the player's own mute action.
// Browsers pause/suspend audio for reasons outside our control — tab
// backgrounded, phone locked, a missed autoplay-unlock gesture, iOS
// Safari's aggressive background audio suspension — so instead of trying to
// prevent every possible interruption, this treats `sound_enabled` as the
// single source of truth and self-heals: a document visibilitychange
// listener (armed once, module-level) checks "should be playing but isn't"
// every time the tab regains focus and resumes it. Explicit mute always
// wins — the watchdog only ever resumes, never overrides a user pause.
import Phaser from 'phaser';
import { AUDIO } from '../assetManifest';

const KEY = 'themesong';

function isEnabled(): boolean {
  return localStorage.getItem('sound_enabled') !== 'false';
}

/** Phaser's own `locked` flag only reflects whether the FIRST autoplay
 *  unlock has ever happened — it stays `false` forever after that, even
 *  though mobile browsers routinely SUSPEND the underlying AudioContext
 *  again later (tab backgrounded, screen locked, a phone call, iOS's
 *  'interrupted' state, etc). When that happens Phaser still reports the
 *  track's `isPlaying` as true (it was never explicitly stopped), so the
 *  `!music.isPlaying` guard below never fires and playback stays silently
 *  dead — exactly the "toggle mute off/on still no sound" bug reported.
 *  Explicitly resuming the context (a no-op if it's already running) fixes
 *  this regardless of what isPlaying claims. */
function resumeContext(scene: Phaser.Scene) {
  const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager).context;
  if (ctx && ctx.state !== 'running' && typeof ctx.resume === 'function') {
    ctx.resume();
  }
}

function tryResume(scene: Phaser.Scene) {
  if (!isEnabled() || scene.sound.locked) return;
  resumeContext(scene);
  const music = scene.sound.get(KEY);
  if (music && !music.isPlaying) music.play();
}

// Guards against every scene's create() independently queuing its own
// `load.audio('themesong', …)` before the first one finishes — Phaser's
// loader would otherwise run N duplicate loads (and N duplicate `sound.add`
// races) if the player e.g. bounces MainMenu → LevelSelect → MainMenu
// faster than the first decode completes.
let loadInFlight = false;

/** Ensures the theme track is loaded and playing (unless muted). Safe to
 *  call from every scene's create() — no-ops instantly once loaded, and
 *  loading itself is deferred to a non-blocking queue (see PreloadScene: a
 *  stuck decodeAudioData must never block the game from being playable). */
export function ensureBgMusic(scene: Phaser.Scene) {
  scene.sound.mute = !isEnabled();

  if (scene.cache.audio.has(KEY)) {
    if (!scene.sound.get(KEY)) scene.sound.add(KEY, { loop: true, volume: 0.45 });
    if (scene.sound.locked) {
      scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => tryResume(scene));
    } else {
      tryResume(scene);
    }
    return;
  }

  if (loadInFlight) return;
  loadInFlight = true;
  scene.load.audio(KEY, AUDIO.themesong);
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    loadInFlight = false;
    if (!scene.sound.get(KEY)) scene.sound.add(KEY, { loop: true, volume: 0.45 });
    if (scene.sound.locked) {
      scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => tryResume(scene));
    } else {
      tryResume(scene);
    }
  });
  scene.load.start();
}

let watchdogArmed = false;

/** Arms a ONE-TIME, module-level watchdog that resumes playback whenever the
 *  tab/app regains focus, as long as the player hasn't muted it themselves.
 *  `scene.sound` is the single game-wide SoundManager (not per-scene), so
 *  the closure stays valid even after this particular scene is destroyed. */
export function armMusicWatchdog(scene: Phaser.Scene) {
  if (watchdogArmed) return;
  watchdogArmed = true;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tryResume(scene);
  });
  // Belt-and-suspenders: also catch it on every tap. visibilitychange isn't
  // fired reliably in every mobile browser/embedded webview, and the
  // AudioContext can end up suspended without any focus event at all (seen
  // in the wild: music silent on load, toggling the mute button doesn't
  // bring it back either — because that only calls tryResume() too, so if
  // the context is wedged, every other call site was already exhausting the
  // same fix). A tap is the one thing every interaction path shares.
  document.addEventListener('pointerdown', () => tryResume(scene), { passive: true });
}

/** Toggle mute from any scene's sound button; keeps localStorage, the
 *  SoundManager's global mute flag, and the track's play state in sync. */
export function toggleMute(scene: Phaser.Scene): boolean {
  const nextMuted = !scene.sound.mute;
  scene.sound.mute = nextMuted;
  localStorage.setItem('sound_enabled', nextMuted ? 'false' : 'true');
  if (!nextMuted) tryResume(scene);
  return nextMuted;
}

export function isMuted(scene: Phaser.Scene): boolean {
  return scene.sound.mute;
}
