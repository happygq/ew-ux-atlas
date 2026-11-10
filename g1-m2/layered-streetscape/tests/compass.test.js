import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compassAtYaw,normalizedAzimuth,WORLD_NORTH,WORLD_EAST} from '../src/compass.js';
const near=(a,b,epsilon=1e-3)=>assert.ok(Math.abs(a-b)<epsilon, String(a)+' != '+String(b));
const label=(c,key)=>c.labels.find(q=>q.key===key);

test('world coordinate convention: +Z North, +X East',()=>{
  assert.deepEqual(WORLD_NORTH,[0,0,1]);assert.deepEqual(WORLD_EAST,[1,0,0]);
});
test('default planning azimuth is South (坐北朝南)',()=>{
  const c=compassAtYaw(0);assert.equal(c.preferred.bearing,180);
  near(c.preferred.x,0);near(c.preferred.y,-35);
});
test('looking South from +Z: North at screen bottom and East at right',()=>{
  const c=compassAtYaw(0);
  near(c.heading,180);near(label(c,'N').x,0);near(label(c,'N').y,35);
  near(label(c,'E').x,35);near(label(c,'E').y,0);
});
test('looking North from -Z: North at screen top',()=>{
  const c=compassAtYaw(Math.PI);
  near(c.heading,0);near(label(c,'N').x,0);near(label(c,'N').y,-35);
});
test('looking West from +X: North at left and East at bottom',()=>{
  const c=compassAtYaw(Math.PI/2);
  near(c.heading,270);near(label(c,'N').x,-35);near(label(c,'N').y,0);
  near(label(c,'E').x,0);near(label(c,'E').y,35);
});
test('preferred SE and SW are independent of camera heading',()=>{
  const a=compassAtYaw(0,135),b=compassAtYaw(0,225);
  near(a.preferred.x,35*Math.SQRT1_2);
  near(b.preferred.x,-35*Math.SQRT1_2);
  near(a.heading,b.heading);
});
test('free bearings support full circle, wrap correctly, reject NaN',()=>{
  assert.equal(normalizedAzimuth(-45),315);
  assert.equal(normalizedAzimuth(720+135),135);
  assert.throws(()=>normalizedAzimuth(Number.NaN),RangeError);
});
test('UI defaults to geographic south, retains flexible directions and camera-linked updates',()=>{
  const h=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(h,/id="worldCompass"/);
  assert.match(h,/坐北朝南/);
  for(const v of ['180','135','225','custom'])assert.match(h,new RegExp('value="'+v+'"'));
  assert.match(h,/function loop\(ms\)\{paintCompass\(\)/);
  assert.match(h,/compassAtYaw\(yaw,chosenFacing,37\)/);
  assert.match(h,/此控件不改变建筑几何、Add \/ Remove 结果/);
});
