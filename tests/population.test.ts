import test from 'node:test';
import assert from 'node:assert/strict';
import { populationObservation } from '../packages/shared/src/population.js';
test('low population requires sustained fresh observations, alerts once and resets on recovery',()=>{
 let state=populationObservation(undefined,3,8,2,0).state;
 state=populationObservation(state,4,8,2,60000).state;
 const alert=populationObservation(state,4,8,2,120000);assert.equal(alert.alert,true);
 assert.equal(populationObservation(alert.state,4,8,2,180000).alert,false);
 const recovered=populationObservation(alert.state,10,8,2,180000);assert.equal(recovered.state?.alerted,false);
 const low=populationObservation(recovered.state,3,8,2,240000);assert.equal(low.alert,false);
 const continued=populationObservation(low.state,3,8,2,300000);assert.equal(continued.alert,false);assert.equal(populationObservation(continued.state,3,8,2,360000).alert,true);
});
test('missing observations and clock reversal restart the timer instead of inferring low population',()=>{
 const first=populationObservation(undefined,2,8,10,0).state;
 const gap=populationObservation(first,2,8,10,3600000);assert.equal(gap.alert,false);assert.equal(gap.state?.since,3600000);
 const reversed=populationObservation(gap.state,2,8,10,1000);assert.equal(reversed.alert,false);assert.equal(reversed.state?.since,1000);
 assert.equal(populationObservation(first,NaN,8,10,1000).alert,false);
});
