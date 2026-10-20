import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrationSchema,mapFeatureSchema,projectWorld,unprojectPoint,type Anchor } from '../packages/shared/src/map.js';
const anchors:Anchor[]=[{worldX:0,worldZ:0,x:50,y:50},{worldX:1000,worldZ:0,x:70,y:50},{worldX:0,worldZ:1000,x:50,y:70}];
test('map calibration projects positive X right, positive Z down and round-trips fractional positions',()=>{
 assert.deepEqual(projectWorld(anchors,0,0),{x:50,y:50});assert.deepEqual(projectWorld(anchors,500,-250),{x:60,y:45});
 const world=unprojectPoint(anchors,{x:61.25,y:42.5})!;assert.ok(Math.abs(world.worldX-562.5)<1e-8);assert.ok(Math.abs(world.worldZ+375)<1e-8);
 assert.equal(projectWorld(anchors,100000,0),null);assert.equal(projectWorld([],0,0),null);assert.equal(projectWorld(anchors,NaN,0),null);
});
test('three-point affine calibration supports rotated artwork and rejects collinear world/image anchors',()=>{
 const rotated=[anchors[0],{worldX:1000,worldZ:0,x:50,y:70},{worldX:0,worldZ:1000,x:30,y:50}];assert.deepEqual(projectWorld(rotated,500,500),{x:40,y:60});
 assert.equal(calibrationSchema.safeParse([anchors[0],anchors[1],{worldX:2000,worldZ:0,x:90,y:50}]).success,false);
 assert.equal(calibrationSchema.safeParse([anchors[0],anchors[1],{worldX:0,worldZ:1000,x:90,y:50}]).success,false);
});
test('map features reject off-map pins, degenerate patrol boundaries and multiple station locations',()=>{
 const base={kind:'patrol',agency:'police',label:'Training district',notes:''};assert.equal(mapFeatureSchema.safeParse({...base,points:[{x:10,y:10},{x:20,y:20},{x:30,y:30}]}).success,false);
 assert.equal(mapFeatureSchema.safeParse({...base,points:[{x:10,y:10},{x:20,y:10},{x:20,y:20}]}).success,true);
 assert.equal(mapFeatureSchema.safeParse({...base,kind:'station',points:[{x:101,y:20}]}).success,false);
 assert.equal(mapFeatureSchema.safeParse({...base,kind:'station',points:[{x:10,y:10},{x:20,y:20}]}).success,false);
});
