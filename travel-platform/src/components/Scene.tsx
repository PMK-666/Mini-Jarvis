import type { SceneKind } from "@/lib/domain/types";

/**
 * Flat, editorial illustrations used as the base layer behind photography.
 * They guarantee a calm, on-brand image even when a photo is missing or blocked.
 */
export function Scene({ kind, className = "" }: { kind: SceneKind; className?: string }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      {SCENES[kind]}
    </svg>
  );
}

const SCENES: Record<SceneKind, React.ReactNode> = {
  islands: (
    <>
      <rect width="400" height="300" fill="#EADBC8" />
      <circle cx="300" cy="92" r="34" fill="#F1B98C" />
      <path d="M0 170h400v130H0z" fill="#79A7A2" />
      <path d="M0 214h400v86H0z" fill="#5A8C8B" />
      <path d="M40 172c10-48 28-74 44-74s26 30 34 46c6-22 16-30 24-30 12 0 22 30 26 58z" fill="#2F4A45" />
      <path d="M232 172c6-30 18-52 30-52 9 0 15 14 19 26 5-16 13-28 22-28 14 0 24 30 30 54z" fill="#3A5853" />
      <path d="M60 240c40-8 90-8 130 0" stroke="#EADBC8" strokeOpacity=".5" strokeWidth="2" fill="none" />
      <path d="M220 262c40-8 90-8 130 0" stroke="#EADBC8" strokeOpacity=".4" strokeWidth="2" fill="none" />
    </>
  ),
  lagoon: (
    <>
      <rect width="400" height="300" fill="#E8E2D2" />
      <circle cx="96" cy="84" r="26" fill="#F3C9A0" />
      <path d="M0 160h400v140H0z" fill="#9FCBC3" />
      <path d="M0 226c80-14 160-14 240 0s120 14 160 4v70H0z" fill="#77B0A8" />
      <path d="M210 168c40-12 110-12 160 0z" fill="#E9D9BC" />
      <path d="M300 166c-2-30 2-52 10-70" stroke="#5B5244" strokeWidth="3" fill="none" />
      <path d="M310 96c-18-6-30 0-38 10M310 96c14-10 28-8 38 2M310 96c-6-12-18-16-28-14M310 96c10-4 20 2 24 12" stroke="#3E5B4E" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M40 200h40M120 214h60M60 250h70" stroke="#E8E2D2" strokeOpacity=".6" strokeWidth="2" />
    </>
  ),
  mountains: (
    <>
      <rect width="400" height="300" fill="#DFE4E5" />
      <path d="M0 210 90 90l60 70 70-110 90 120 90-60v190H0z" fill="#8E9EA8" />
      <path d="M220 50l26 34-14-4-12 12-10-14-12 8z" fill="#F6F4F0" />
      <path d="M0 250 120 170l80 50 80-40 120 70v50H0z" fill="#56656D" />
    </>
  ),
  snow: (
    <>
      <rect width="400" height="300" fill="#E3E7EA" />
      <path d="M150 210 230 40l40 70 30-20 70 120z" fill="#A9B6BF" />
      <path d="M230 40l18 40-12-6-8 12-10-10-12 6z" fill="#FFFFFF" />
      <path d="M0 230 90 150l70 60 60-30 80 50 100-40v110H0z" fill="#F7F7F5" />
      <path d="M0 260c100-20 200-10 400-30v70H0z" fill="#EEF0F0" />
      <path d="M60 236l10-24 10 24zM86 240l9-20 9 20zM330 228l10-24 10 24z" fill="#4E5C55" />
    </>
  ),
  coast: (
    <>
      <rect width="400" height="300" fill="#F0DFC9" />
      <circle cx="320" cy="78" r="28" fill="#F0B27F" />
      <path d="M0 180h400v120H0z" fill="#5F8EA9" />
      <path d="M0 230h400v70H0z" fill="#4A7690" />
      <path d="M0 120c40 0 60 20 90 26s50 34 60 54H0z" fill="#C9A27E" />
      <rect x="20" y="108" width="22" height="18" fill="#FBF7F0" />
      <rect x="46" y="116" width="18" height="14" fill="#F7EEE2" />
      <rect x="30" y="94" width="14" height="14" fill="#F7EEE2" />
      <path d="M220 214c20-6 40-6 60 0" stroke="#F0DFC9" strokeOpacity=".5" strokeWidth="2" fill="none" />
    </>
  ),
  city: (
    <>
      <rect width="400" height="300" fill="#ECE3D7" />
      <path d="M0 300V180h40v-40h30v60h30v-90h40v90h30v-50h40v70h30v-110h36v110h30v-60h30v40h44v120z" fill="#3F3D39" />
    </>
  ),
  temple: (
    <>
      <rect width="400" height="300" fill="#EDE0D2" />
      <circle cx="270" cy="110" r="44" fill="#CC6A47" />
      <path d="M0 230c60-30 120-40 200-30s140 0 200-20v120H0z" fill="#B9A58E" />
      <path d="M0 260c80-14 200-18 400-4v44H0z" fill="#8C7B67" />
      <path d="M120 236v-30h40v30M110 206h60l-8-10h-44zM118 196h44l-6-10h-32zM124 186h32l-6-10h-20zM130 176h20l-10-14z" fill="#3B3632" />
    </>
  ),
  fjord: (
    <>
      <rect width="400" height="300" fill="#DAE2E3" />
      <path d="M0 200 70 80l60 60 40-40 30 100z" fill="#5E7882" />
      <path d="M400 210 330 70l-50 50-40-30-40 120z" fill="#4C6670" />
      <path d="M0 200h400v100H0z" fill="#93ADB3" />
      <path d="M140 230c40-6 80-6 120 0" stroke="#DAE2E3" strokeOpacity=".6" strokeWidth="2" fill="none" />
      <path d="M200 222l12-6 12 6z" fill="#A3402E" />
    </>
  ),
};
