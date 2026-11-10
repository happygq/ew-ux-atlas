/**
 * EW-UX R2-V v0.1 — reader-facing explanations only; does not mutate the
 * authoritative experiment operation logs or alter semantic outcomes.
 */
const palette={PAPER:'宣纸白',MIST:'雾青',SILK:'暖绢',MOUNTAIN:'远山灰'};
const v04=Object.freeze([
  null,
  {title:'建立一层的第一个单元',meaning:'在一层 (2,2) 放入宣纸白单元。',outcome:'一层出现编号 1 的建筑单元，直接由地面承托。',principle:'先建立可供上层依赖的基础。'},
  {title:'相邻同色单元形成连通',meaning:'一层 (3,2) 再增加宣纸白单元。',outcome:'它与 (2,2) 相邻且建造时同色，因此记录一条 OPEN 内部连接。',principle:'OPEN 是建造时形成的持久空间事实。'},
  {title:'二层叠放，但不自动连通',meaning:'在二层 (2,2) 增加宣纸白单元，正好压在一层 (2,2) 上方。',outcome:'它获得直接承托；但两层仍是独立房间，系统没有自动创建楼梯。',principle:'垂直接触和楼层之间可以通行，是两件不同的事。'},
  {title:'改色不追溯修改旧连接',meaning:'把一层 (3,2) 从宣纸白改为雾青。',outcome:'步骤 2 已经建立的 OPEN 连通边仍保留，不会因为颜色不同而被改成隔墙。',principle:'Recolor 改变未来建造匹配条件，不抹除过去的边界事实。'},
  {title:'新连接按当前颜色建立',meaning:'在一层 (4,2) 增加雾青单元。',outcome:'它与一层 (3,2) 的当前颜色相同，因此两者之间新增 OPEN 边。',principle:'现在一层三个单元虽然有两种颜色，但仍能经已记录的 OPEN 边连成一个房间。'},
  {title:'尝试拆除承托点：被系统拒绝',meaning:'尝试 Remove 一层 (2,2)，但二层 (2,2) 还依赖它承托。',outcome:'返回 SUPPORT_DEPENDENCY：拒绝拆除。网格与单元编号均不改变，只有拒绝计数增加。',principle:'这是一项故意失败的负向测试，验证删除不能静默留下悬空上层。'},
  {title:'先删除二层，解除依赖',meaning:'Remove 二层 (2,2) 的上层单元。',outcome:'二层该位置清空；一层仍保持原样，原先的直接承托依赖也随之消失。',principle:'为安全拆除被依赖的一层单元先创造条件。'},
  {title:'这一次允许删除一层承托点',meaning:'再次 Remove 一层 (2,2)。此时上方已没有依赖它的单元。',outcome:'删除成功；编号 1 消失，它与一层 (3,2) 的原 OPEN 边一起清除。一层 (3,2) 与 (4,2) 仍连通。',principle:'第 6 步失败、第 8 步成功，差异来自承托依赖已经解除。'},
  {title:'重新占用旧位置，但不恢复旧连接',meaning:'在空出的一层 (2,2) 添加全新的暖绢色单元。',outcome:'产生新的单元编号 5；相邻的一层 (3,2) 目前是雾青，因此两者之间生成 PARTITION 隔墙。',principle:'Remove 后重新 Add 不会继承旧单元的 ID 或已删除的 OPEN 边。'},
  {title:'尝试凭空添加二层：被系统拒绝',meaning:'尝试在二层 (8,8) Add 宣纸白单元，但它下方及周围没有可接受的承托候选。',outcome:'返回 UNSUPPORTED_ADD：拒绝新增。所有楼层的实际建筑布局保持不变，拒绝计数再增加一次。',principle:'这同样是故意失败的负向测试，不是新增加的用户操作类型。'}
]);
export function stepGuide(sceneId,scenario,step){
 if(!Number.isInteger(step)||step<0||step>scenario.steps.length)throw new RangeError('invalid step');
 if(step===0)return {title:'从空场景开始',meaning:'还没有执行建造操作；按“下一步”逐项观察模型变化。',outcome:'占用单元为零，所有楼层为空。',principle:'每个操作都在上一步的真实状态上应用。',status:'initial',target:null};
 const op=scenario.steps[step-1],attempt=op.type==='ExpectReject'?op.operation:op;
 const isRejected=op.type==='ExpectReject';
 const target={x:attempt.x,z:attempt.z,level:attempt.level,rejected:isRejected};
 if(sceneId==='V04'){
  const d=v04[step];
  if(!d)throw new Error('missing V04 explanation for step '+step);
  return {...d,status:isRejected?'rejected':'applied',target,errorCode:isRejected?op.code:null};
 }
 const action=attempt.type,level=attempt.level+1;
 const loc=`${level} 层 (${attempt.x},${attempt.z})`;
 const actionDesc=action==='Add'?`增加${palette[attempt.color]||attempt.color}单元`:action==='Remove'?'删除单元':`改成${palette[attempt.color]||attempt.color}`;
 const error=isRejected?{'UNSUPPORTED_ADD':'没有合法承托，新增被拒绝','SUPPORT_DEPENDENCY':'存在上层承托依赖，删除被拒绝'}[op.code]||op.code:null;
 const general=isRejected?
 {title:'预期拒绝：'+actionDesc,meaning:`尝试在${loc}${actionDesc}。`,outcome:`${error}。建筑状态保持不变；这只是负向测试。`,principle:'异常操作不会悄悄改写原有建筑。'}:
 {title:actionDesc,meaning:`在${loc}${actionDesc}。`,outcome:'按已存的楼层占用、颜色和承托约束更新模型；高亮方格表示这一步的目标位置。',principle:'该页仅验证多层占用语义，不表示真实楼梯、梁或屋顶已建成。'};
 return {...general,status:isRejected?'rejected':'applied',target,errorCode:isRejected?op.code:null};
}
