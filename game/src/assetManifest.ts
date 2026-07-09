// Central asset manifest.
import themesong from './assets/themesong.mp3';
// Assets are imported so Vite fingerprints and bundles them — string paths
// like 'src/assets/x.png' only resolve in dev, never in a production build.
import logo from './assets/LOGO.png';
// The 3 background covers were originally 5106×1890 opaque PNGs at 11-16MB
// EACH (~42MB total) — decoding/uploading textures that size was a real
// source of lag, especially on phones (user: "game đang hơi lag, khá
// giật"). Re-exported as 2400×888 JPEG @ q82 (alpha was uniformly 255 — pure
// waste, PNG had nothing to preserve there): same look, ~0.4MB each. Source
// PNGs are untouched on disk / in git history if a re-export is ever needed.
// MAIN/COVER 2.png was a byte-identical duplicate of BACKGROUND/COVER 2.png
// (verified by hash) — dropped entirely; MainMenuScene now reuses bg_cover2.
import bgCover1 from './assets/BACKGROUND/COVER 1.jpg';
import bgCover2 from './assets/BACKGROUND/COVER 2.jpg';
import bgCover3 from './assets/BACKGROUND/COVER 3.jpg';
import structGrass from './assets/ELEMENTS-structure/CỎ.png';
import structDirtL from './assets/ELEMENTS-structure/ĐẤT TRÁI.png';
import structSling from './assets/ELEMENTS-structure/NỎ.png';
import fxCrystal from './assets/ELEMENTS-fx/PHA LÊ.png';
import fxSmoke from './assets/ELEMENTS-fx/SMOKE.png';
// One-line version (HÀNH TRÌNH + KINH DOANH sliced from the original two-line
// art and set side by side — identical pixels, so same font/effect).
import txtJourney from './assets/TEXT/HÀNH TRÌNH KINH DOANH 1 DÒNG.png';
import txtTitle from './assets/TEXT/ANGRY HẠC.png';
import txtTagFrame from './assets/TEXT/KHUNG TAGLINE.png';
import fxLightH from './assets/TEXT/LIGHT NGANG.png';
import uiFrameBright from './assets/UI/FRAME SÁNG.png';
// FRAME_TOI_CUT = FRAME TỐI with its opaque near-black background keyed out to
// transparent (luminance key), so only the glowing crystal line composites —
// no black rectangle around the panel. Same 1672×941 dims → FRAME_ART.dark
// line fractions stay valid.
import uiFrameDark from './assets/UI/FRAME_TOI_CUT.png';
// Level-select art — sliced from the user's MapLevel.png reference (crystal
// orbs + icy numbers + diamonds, the gold/empty star glyphs, and the crystal
// font labels), keyed off its baked checkerboard into transparent sprites.
import mapOrb1 from './assets/UI/MAP_ORB1.png';
import mapOrb2 from './assets/UI/MAP_ORB2.png';
import mapOrb3 from './assets/UI/MAP_ORB3.png';
import mapStarFull from './assets/UI/MAP_STAR_FULL.png';
import mapStarEmpty from './assets/UI/MAP_STAR_EMPTY.png';
import mapLabel1 from './assets/UI/MAP_LABEL1.png';
import mapLabel2 from './assets/UI/MAP_LABEL2.png';
import mapLabel3 from './assets/UI/MAP_LABEL3.png';

/** Loaded in BootScene — the PreloadScene loading dialog itself is framed
 *  with these, so they must exist before the main manifest loads. */
export const BOOT_IMAGES: Record<string, string> = {
  ui_frame_bright: uiFrameBright, // FRAME SÁNG — for dark backgrounds
  ui_frame_dark:   uiFrameDark,   // FRAME TỐI — for bright backgrounds
};

/** texture key → bundled URL. Only assets actually used by the game. */
export const IMAGES: Record<string, string> = {
  logo,
  bg_cover1: bgCover1,
  bg_cover2: bgCover2,
  bg_cover3: bgCover3,
  struct_grass: structGrass,
  struct_dirt_l: structDirtL,
  struct_sling: structSling,
  fx_crystal: fxCrystal,
  fx_smoke: fxSmoke,
  txt_journey: txtJourney,
  txt_title: txtTitle,
  txt_tag_frame: txtTagFrame,
  fx_light_h: fxLightH,
  map_orb1: mapOrb1,
  map_orb2: mapOrb2,
  map_orb3: mapOrb3,
  map_star_full: mapStarFull,
  map_star_empty: mapStarEmpty,
  map_label1: mapLabel1,
  map_label2: mapLabel2,
  map_label3: mapLabel3,
};

/** Audio assets: key → bundled URL */
export const AUDIO: Record<string, string> = {
  themesong,
};
