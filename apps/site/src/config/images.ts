export interface ImageAsset {src:string;alt:string;position?:string;webp?:string}
const branded=(file:string,alt:string):ImageAsset=>({src:'/images/brand/'+file+'.png',webp:'/images/brand/'+file+'.webp',alt});
export const images={
 logo:{src:'/images/brand/nyc-logo.png',alt:'New York City Roleplay logo'},
 home:branded('nyc-general','New York City Roleplay — Your story, your city, your legacy'),
 departments:branded('nyc-general','New York City Roleplay departments'),
 applications:branded('nyc-general','New York City Roleplay applications'),
 sessions:branded('nyc-general','New York City Roleplay sessions'),
 community:branded('nyc-general','New York City Roleplay community'),
 cad:branded('nyc-general','New York City Roleplay CAD and MDT'),
 staff:branded('nyc-general','New York City Roleplay staff'),
 assistance:branded('nyc-assistance','New York City Roleplay assistance'),
 regulations:branded('nyc-rules','New York City Roleplay regulations'),
 footer:{src:'/images/brand/nyc-footer.png',alt:'New York City Roleplay'},
 fallback:{src:'/images/community/fallback.svg',alt:'New York City Roleplay branded placeholder'},
 nypd:branded('nyc-police','Supplied New York Police Department banner'),
 nycso:branded('nyc-sheriff','Supplied New York City Sheriff artwork; original image caption retained'),
 nyfd:branded('nyc-fire','New York Fire Department emblem'),
 nydot:branded('nyc-dot','New York Department of Transportation banner'),
 nysp:branded('nyc-general','New York State Police placeholder; department not activated'),
} satisfies Record<string,ImageAsset>;
export const departmentGalleries:Record<string,{label:string;asset:ImageAsset}[]>=Object.fromEntries(['nypd','nycso','nyfd','nydot','nysp'].map(slug=>[slug,['Fleet showcase','Uniform standards','Training in action'].map(label=>({label,asset:{...images[slug as 'nypd'|'nycso'|'nyfd'|'nydot'|'nysp'],alt:`${slug.toUpperCase()} branded placeholder for ${label.toLowerCase()}`}}))]));
export type LeadershipPortrait={displayName:string;title:string;image:ImageAsset};
