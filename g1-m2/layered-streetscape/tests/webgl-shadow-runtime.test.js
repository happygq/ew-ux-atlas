import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Renderer} from '../src/webgl.js';
import {Mesh} from '../src/mesh.js';

function rendererFixture() {
  const r=Object.create(Renderer.prototype);
  r.gl={COLOR_BUFFER_BIT:1,DEPTH_BUFFER_BIT:2,viewport(){},clearColor(){},clear(){},
    useProgram(){},uniformMatrix4fv(){},uniform1f(){},depthMask(){},bindVertexArray(){}};
  r.canvas={width:800,height:600};r.p={};r.uniforms={uVP:0,uExplode:0};
  r.target=[0,1,0];r.distance=9;r.yaw=.5;r.pitch=.3;r.explode=0;
  r.shared={base:new Mesh('floor','floor'),top:new Mesh('top','platformTop'),
    platform:new Mesh('platform','platform'),
    shadows:Array.from({length:10},(_,i)=>new Mesh('shadow-'+i,'shadow'))};
  const wall=new Mesh('wall','plaster');wall.box(0,1,0,1,2,1);
  r.items=[{module:{parts:[wall]},pos:[0,0,0],plinth:false}];
  r.drawCallsTest=[];
  r.drawMesh=function(mesh){assert.ok(mesh&&Array.isArray(mesh.positions),'undefined mesh');this.drawCallsTest.push(mesh.id)};
  return r;
}

test('reproduces reported Safari crash when shared shadow array is discarded',()=>{
  const r=rendererFixture();r.shared.shadows=[];
  assert.throws(()=>r.render(),/undefined mesh/);
});

test('empty shadow geometry preserves render slots and does not crash',()=>{
  const r=rendererFixture();
  r.shared.shadows.forEach(m=>{m.positions.length=0;m.normals.length=0;m.count=0});
  assert.doesNotThrow(()=>r.render());
  assert.equal(r.drawCallsTest.filter(id=>id.startsWith('shadow-')).length,10);
  assert.ok(r.drawCallsTest.includes('wall'));
});

test('site initialization does not discard shadow slots and has an error fallback',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/renderer\.shared\.shadows\s*=\s*\[\s*\]/);
  assert.match(html,/renderer\.shared\.shadows\.forEach/);
  assert.match(html,/classList\.remove\('running'\)/);
});
