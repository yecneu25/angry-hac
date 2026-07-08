// Central asset manifest.
// Assets are imported so Vite fingerprints and bundles them — string paths
// like 'src/assets/x.png' only resolve in dev, never in a production build.
import logo from './assets/LOGO.png';
import coverMain from './assets/MAIN/COVER 2.png';
import bgCover1 from './assets/BACKGROUND/COVER 1.png';
import bgCover2 from './assets/BACKGROUND/COVER 2.png';
import bgCover3 from './assets/BACKGROUND/COVER 3.png';
import structGrass from './assets/ELEMENTS-structure/CỎ.png';
import structDirtL from './assets/ELEMENTS-structure/ĐẤT TRÁI.png';
import structSling from './assets/ELEMENTS-structure/NỎ.png';
import fxCrystal from './assets/ELEMENTS-fx/PHA LÊ.png';
import fxSmoke from './assets/ELEMENTS-fx/SMOKE.png';
import txtJourney from './assets/TEXT/HÀNH TRÌNH KINH DOANH.png';
import txtTitle from './assets/TEXT/ANGRY HẠC.png';
import txtTagFrame from './assets/TEXT/KHUNG TAGLINE.png';
import fxLightH from './assets/TEXT/LIGHT NGANG.png';

/** texture key → bundled URL. Only assets actually used by the game. */
export const IMAGES: Record<string, string> = {
  logo,
  cover_main: coverMain,
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
};
