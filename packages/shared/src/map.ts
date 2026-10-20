import { z } from 'zod';
export const mapPoint=z.object({x:z.number().finite().min(0).max(100),y:z.number().finite().min(0).max(100)}).strict();
export const anchorSchema=mapPoint.extend({worldX:z.number().finite().min(-1000000).max(1000000),worldZ:z.number().finite().min(-1000000).max(1000000)}).strict();
export const calibrationSchema=z.array(anchorSchema).length(3).refine(a=>a.length===3&&Math.abs(determinant(a))>0.000001,'Choose three non-collinear world locations.').refine(a=>a.length===3&&Math.abs((a[1].x-a[0].x)*(a[2].y-a[0].y)-(a[2].x-a[0].x)*(a[1].y-a[0].y))>0.001,'Choose three non-collinear image locations.');
export type MapPoint=z.infer<typeof mapPoint>;
export type Anchor=z.infer<typeof anchorSchema>;
function determinant(a:Anchor[]){return (a[1].worldX-a[0].worldX)*(a[2].worldZ-a[0].worldZ)-(a[2].worldX-a[0].worldX)*(a[1].worldZ-a[0].worldZ);}
export function projectWorld(anchors:Anchor[],worldX:number,worldZ:number):MapPoint|null{
 if(!Number.isFinite(worldX)||!Number.isFinite(worldZ)||!calibrationSchema.safeParse(anchors).success)return null;
 const [a,b,c]=anchors,d=determinant(anchors),dx=worldX-a.worldX,dz=worldZ-a.worldZ;
 const u=(dx*(c.worldZ-a.worldZ)-(c.worldX-a.worldX)*dz)/d,v=((b.worldX-a.worldX)*dz-dx*(b.worldZ-a.worldZ))/d;
 const x=a.x+u*(b.x-a.x)+v*(c.x-a.x),y=a.y+u*(b.y-a.y)+v*(c.y-a.y);
 return x>=0&&x<=100&&y>=0&&y<=100?{x,y}:null;
}
export function unprojectPoint(anchors:Anchor[],point:MapPoint):{worldX:number;worldZ:number}|null{
 if(!calibrationSchema.safeParse(anchors).success)return null;const [a,b,c]=anchors,dx=point.x-a.x,dy=point.y-a.y,d=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y),u=(dx*(c.y-a.y)-(c.x-a.x)*dy)/d,v=((b.x-a.x)*dy-dx*(b.y-a.y))/d;
 return {worldX:a.worldX+u*(b.worldX-a.worldX)+v*(c.worldX-a.worldX),worldZ:a.worldZ+u*(b.worldZ-a.worldZ)+v*(c.worldZ-a.worldZ)};
}
export const mapFeatureSchema=z.object({kind:z.enum(['station','postal','roadblock','patrol']),agency:z.enum(['police','sheriff','fire','ems','dot','dispatch']),label:z.string().trim().min(1).max(100),notes:z.string().trim().max(1000).default(''),points:z.array(mapPoint).min(1).max(40)}).strict().superRefine((value,ctx)=>{
 if(value.kind==='patrol'){if(value.points.length<3)ctx.addIssue({code:'custom',message:'A patrol boundary needs at least three points.'});else{const area=value.points.reduce((sum,p,i)=>{const q=value.points[(i+1)%value.points.length];return sum+p.x*q.y-q.x*p.y;},0);if(Math.abs(area)<0.01)ctx.addIssue({code:'custom',message:'Patrol boundary must enclose an area.'});}}
 else if(value.points.length!==1)ctx.addIssue({code:'custom',message:'Point features need exactly one location.'});
});
export const mapVariants=['fall_blank','fall_postals','snow_blank','snow_postals'] as const;
