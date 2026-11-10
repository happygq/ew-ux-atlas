/** Step narratives are presentation-only and never affect user build history. */
const CN={Add:'增加',Remove:'删除',Recolor:'改色'};
const COL={PAPER:'宣纸白',MIST:'雾青',SILK:'暖绢',MOUNTAIN:'远山灰'};
const specials={
 V02:{
  16:{title:'形成上下两层的开放天井空域',desc:'两个环形建筑分别围出一个内院空格，上下均为空气单元，三维空域直接贯通天空。'},
  17:{title:'试验性桥接覆盖天井中心',desc:'二层中心新增一个占用单元；下层中心不再向天空连通，属于被覆盖的三维空域。桥接仍是研究承托候选。'},
  18:{title:'移除中心覆盖，天井重新露天',desc:'二层中心退出占用后，连续的竖向空气通道恢复。'}
 },
 V04:{6:{title:'预期拒绝：不可拆除仍承托上层的单元',desc:'试图删除一层 (2,2)，但二层还需要它。拒绝 SUPPORT_DEPENDENCY，建筑保持原样。'},
      7:{title:'先删除二层，解除下方依赖',desc:'二层 (2,2) 删除后，一层不再承担该上层单元。'},
      8:{title:'再次尝试，允许拆除一层',desc:'一层 (2,2) 现在能够移除，同时删除它的旧 OPEN 边。'},
      9:{title:'重建旧位置，产生新的历史边界',desc:'在一层 (2,2) 以暖绢色重建；旁边已变为雾青，故新建 PARTITION，而非恢复旧 OPEN。'},
      10:{title:'预期拒绝：不能凭空新增二层',desc:'尝试 Add 二层 (8,8)，缺少合法承托。返回 UNSUPPORTED_ADD，网格不变。'}},
 V05:{
  1:{title:'建立一层中心柱位',desc:'一层 (4,4) 建造第一个单元。'},
  2:{title:'建立直托的二层单元',desc:'二层 (4,4) 正好坐在第一层 (4,4) 的承托上，关系为 DIRECT。'},
  3:{title:'添加一层左侧承托',desc:'一层 (3,4) 新增与中心相邻的支撑候选。'},
  4:{title:'补上右侧，形成备用两端承托',desc:'一层 (5,4) 新增，左右两端已具备候选桥接条件。'},
  5:{title:'核心测试：承托路径自动切换',desc:'删除一层中心 (4,4)。二层的单元 ID 保持不变，承托来源从 DIRECT 转为 ONE_BAY_BRIDGE_EW。桥接仅为语义候选。'},
  6:{title:'预期拒绝：删除剩余桥接端点',desc:'尝试移除一层左侧 (3,4)，将破坏二层的最后候选承托，系统拒绝，状态不变。'},
  7:{title:'重新加入中心承托，恢复直托',desc:'一层中心重建为雾青新单元，二层重新优先选择 DIRECT；此前被删除的单元身份不会复活。'}
 },
 V06:{
  8:{title:'上下 2×2 连通空间完整',desc:'形成两层相同位置的 2×2 连通房间，系统识别出“可以研究楼梯位置”的候选，但没有楼板孔洞、楼梯几何或实际通行。'},
  9:{title:'改色后仍保留楼梯候选',desc:'二层一角改色，但原有 OPEN 边持久保留，所以同层房间仍连通；楼梯候选不会仅因为外观色变化而消失。'},
  10:{title:'上层退掉一格，楼梯候选撤销',desc:'二层 2×2 完整连通空间被破坏，空间不再满足这一轮严格的候选规则。原本的候选被移除；这并不代表真实建筑绝不可能安装其他楼梯。'}
 },
 V07:{
  10:{title:'一层形成两个相连的内院空格',desc:'较长的环形建筑围成两格内院；上层尚未覆盖，两格都直接向天空开放。'},
  11:{title:'部分遮盖，但空气仍与天空连通',desc:'在二层 (3,3) 增加一格桥接覆盖，下面一格不能直望天空，但可沿旁边仍露天的内院与天空连通。属于 PARTIAL，不是 SEALED。'}
 }
};
export function explainStep(sceneId,scenario,step){
 if(!Number.isInteger(step)||step<0||step>scenario.steps.length)throw new RangeError('invalid step');
 if(step===0)return {title:'空场景',desc:'尚未执行建造操作；可通过滑块或“下一步”逐条观察占用与空域变化。',status:'initial',target:null};
 const op=scenario.steps[step-1],r=op.type==='ExpectReject',base=r?op.operation:op;
 const chosen=specials[sceneId]?.[step];
 return {
  title:chosen?.title||(r?'预期拒绝的测试操作':CN[base.type]+'单元'),
  desc:chosen?.desc||`在 ${base.level+1} 层 (${base.x},${base.z}) ${CN[base.type]||base.type}${base.color?' · '+(COL[base.color]||base.color):''}。${r?'这是预期失败的测试，原状态不变。':'按照现有的持久边与承托规则确定性更新。'}`,
  status:r?'rejected':'applied',
  target:{x:base.x,z:base.z,level:base.level,rejected:r},
  failureCode:r?op.code:null
 };
}
