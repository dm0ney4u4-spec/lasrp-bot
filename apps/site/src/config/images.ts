export interface ImageAsset { src: string; alt: string; position?: string; webp?: string; }
const image = (src: string, alt: string, position = 'center'): ImageAsset => ({src,alt,position});
// Replace paths here as approved ER:LC artwork arrives. Add webp alongside src for picture fallback.
export const images = {
  logo: image('/images/brand/la-logo.png','LASRP Los Angeles monogram'),
  home: image('/images/homepage/hero.svg','Branded blueprint of a roleplay emergency response district'),
  departments: {...image('/images/brand/departments-banner.png','Los Angeles Roleplay departments banner'),webp:'/images/brand/departments-banner.webp'},
  applications: {...image('/images/brand/applications-banner.png','LASRP applications banner'),webp:'/images/brand/applications-banner.webp'},
  sessions: {...image('/images/brand/sessions-banner.png','LASRP sessions banner'),webp:'/images/brand/sessions-banner.webp'},
  community: {...image('/images/brand/server-header.png','Los Angeles State Roleplay community banner'),webp:'/images/brand/server-header.webp'},
  cad: image('/images/cad/hero.svg','LASRP operations blueprint illustration'),
  staff: image('/images/staff/hero.svg','LASRP staff insignia illustration'),
  fallback: image('/images/community/fallback.svg','LASRP branded image placeholder'),
  lapd: image('/images/lapd/hero.svg','LAPD branded patrol district illustration'),
  lasd: image('/images/lasd/hero.svg','LASD branded county operations illustration'),
  lafd: image('/images/lafd/hero.svg','LAFD branded emergency response illustration'),
  dot: image('/images/dot/hero.svg','DOT branded road network illustration'),
  chp: image('/images/community/fallback.svg','CHP navy branded placeholder; original department media not yet supplied'),
} satisfies Record<string,ImageAsset>;

// Replace any individual gallery slot here, without editing page components.
export const departmentGalleries: Record<string,{label:string;asset:ImageAsset}[]> = Object.fromEntries(
  ['lapd','lasd','lafd','dot','chp'].map(slug=>[slug,['Fleet showcase','Uniform standards','Training in action'].map(label=>({label,asset:{...images[slug as 'lapd'|'lasd'|'lafd'|'dot'|'chp'],alt:`${slug.toUpperCase()} branded placeholder for ${label.toLowerCase()}`}}))])
);
// Future verified leadership portraits can use this same ImageAsset shape.
export type LeadershipPortrait = { displayName:string; title:string; image:ImageAsset };
