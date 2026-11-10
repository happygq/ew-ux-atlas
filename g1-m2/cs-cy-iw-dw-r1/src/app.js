import {PALETTE,initialState,applyOperation,replay,derive,validate} from './semantics.js';
import {SCENARIOS} from './scenarios.js';
import {buildPlanSvg,renderIsometric} from './view.js';
const $=id=>document.getElementById(id);
let ops=[],cursor=0,state=initialState(),tool='Add',color='PAPER',construction=true,selected=null,playTimer=null;
const labelColor={PAPER:'宣纸白',MIST:'雾青',SILK:'暖绢',MOUNTAIN:'远山灰'};
const title={Add:'Add · 增建',Remove:'Remove · 拆除',Recolor:'Recolor · 改色'};
const showError=(s)=>{const el=$('status');el.hidden=!s;el.textContent=s||'';};
function snapshot(){state=replay(ops.slice(0,cursor));return derive(state);}
function refresh(){
 const model=snapshot(),v=validate(state,model);
 $('plan').innerHTML=buildPlanSvg(state,model,{construction,selected});
 renderIsometric($('iso'),state,model,{construction});
 $('unitMetric').textContent=model.metrics.units;
 $('roomMetric').textContent=model.metrics.rooms;
 $('courtMetric').textContent=model.metrics.courtyards;
 $('candidateMetric').textContent=model.metrics.courtyardCandidates;
 $('wallMetric').textContent=model.metrics.sharedPartitions;
 $('courtFacadeMetric').textContent=model.metrics.courtyardFacades;
 $('gate').textContent=v.ok?'TOPOLOGY PASS':'TOPOLOGY FAIL';$('gate').dataset.ok=String(v.ok);
 $('stepLabel').textContent=`${cursor} / ${ops.length} 步`;
 $('timeline').max=String(ops.length);$('timeline').value=String(cursor);
 $('undo').disabled=cursor===0;$('redo').disabled=cursor===ops.length;
 $('operationHint').textContent=cursor?`${ops[cursor-1].type} (${ops[cursor-1].x}, ${ops[cursor-1].z})${ops[cursor-1].color?' · '+labelColor[ops[cursor-1].color]:''}`:'起点：空白大地';
 $('connection').textContent=`${model.metrics.openConnections} 条连通边 · ${model.doorIntents.length} 个院内门位意图`;
 $('facades').textContent=model.metrics.courtyardFacades?`面院墙 ${model.metrics.courtyardFacades} 段：木格隔扇 / 木石脚 / 局部白墙（研究分配）`:'尚无面院墙；围合形成后自动识别。';
 $('courts').innerHTML=model.courtyards.length?model.courtyards.map(c=>`<span class="court-tag ${c.status==='ENCLOSED'?'stable':'candidate'}">${c.type==='MAIN_COURT'?'主庭院':c.type==='SKYWELL'?'小天井':'半开放院候选'} · ${c.area} 格</span>`).join(''):'<span class="empty">当前无院落；逐步围合可触发识别。</span>';
 $('viewConstruction').classList.toggle('active',construction);$('viewArchitecture').classList.toggle('active',!construction);
 for(const el of document.querySelectorAll('[data-tool]'))el.classList.toggle('active',el.dataset.tool===tool);
 for(const el of document.querySelectorAll('[data-color]'))el.classList.toggle('active',el.dataset.color===color);
 if(!v.ok)showError(v.issues.join(', '));
}
function stopPlay(){if(playTimer!==null){clearInterval(playTimer);playTimer=null;} $('play').textContent='播放建造过程';}
function loadScenario(name){stopPlay();if(!SCENARIOS[name])return;ops=SCENARIOS[name].steps.map(x=>({...x}));cursor=ops.length;selected=null;
 $('sceneTitle').textContent=SCENARIOS[name].label;$('sceneSubtitle').textContent=SCENARIOS[name].subtitle;
 $('scenario').value=name;showError('');refresh();}
function appendOperation(op){stopPlay();try{const base=replay(ops.slice(0,cursor));applyOperation(base,op);
 ops=ops.slice(0,cursor);ops.push(op);cursor=ops.length;showError('');refresh();
 }catch(e){showError(e.message)}}
$('plan').addEventListener('click',e=>{const t=e.target.closest('[data-x][data-z]');if(!t)return;
 const x=Number(t.dataset.x),z=Number(t.dataset.z);selected={x,z};appendOperation({type:tool,x,z,...(tool==='Remove'?{}:{color})});});
$('plan').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const t=e.target.closest('[data-x][data-z]');if(!t)return;e.preventDefault();t.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
for(const el of document.querySelectorAll('[data-tool]'))el.addEventListener('click',()=>{tool=el.dataset.tool;refresh()});
for(const el of document.querySelectorAll('[data-color]'))el.addEventListener('click',()=>{color=el.dataset.color;refresh()});
$('viewConstruction').onclick=()=>{construction=true;refresh()};
$('viewArchitecture').onclick=()=>{construction=false;refresh()};
$('scenario').onchange=e=>loadScenario(e.target.value);
$('empty').onclick=()=>{stopPlay();ops=[];cursor=0;selected=null;$('sceneTitle').textContent='自由建造';$('sceneSubtitle').textContent='点击左侧网格，使用 Add / Remove / Recolor';showError('');refresh()};
$('undo').onclick=()=>{stopPlay();cursor=Math.max(0,cursor-1);selected=null;showError('');refresh()};
$('redo').onclick=()=>{stopPlay();cursor=Math.min(ops.length,cursor+1);selected=null;showError('');refresh()};
$('timeline').oninput=e=>{stopPlay();cursor=Number(e.target.value);selected=null;showError('');refresh()};
$('play').onclick=()=>{if(playTimer!==null){stopPlay();return}cursor=0;refresh();$('play').textContent='停止播放';playTimer=setInterval(()=>{cursor=Math.min(ops.length,cursor+1);refresh();if(cursor===ops.length)stopPlay()},320)};
$('export').onclick=()=>{const data=JSON.stringify({contract:'ew/ux/cs-cy-iw-dw-r1/operation-log/v0.1',width:state.width,height:state.height,steps:ops.slice(0,cursor)},null,2),blob=new Blob([data],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ew-ux-cs-cy-r1-operations.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
window.addEventListener('resize',()=>{const model=derive(state);renderIsometric($('iso'),state,model,{construction});});
loadScenario('RING');
