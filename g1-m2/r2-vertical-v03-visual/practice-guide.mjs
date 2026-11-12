const edit = (type, x, z, level, title, details, extra = {}) =>
  ({ action: { type, x, z, level }, title, details, ...extra });

export const guides = {
  stair: {
    title: '南侧楼梯 · 拆除与恢复', sourceStep: 42, buildingId: 'south', buildingName: '南侧建筑',
    summary: '拆除楼梯平台会使旧通行意图失效。重建平台后，亲自确认新的楼梯提案。',
    tasks: [
      edit('Remove', 5, 4, 1, '拆除南侧上层平台', '拆除后观察南侧虚线消失，东侧路线仍保留。'),
      edit('Add', 5, 4, 1, '在原位重建平台', '重建后先观察新的楼梯提案。'),
      { decision: 'STAIR', title: '批准新楼梯', details: '确认新提案后，南侧抽象路线才会重新出现。' },
    ],
  },
  support: {
    title: '承托 · 先搭建再拆除', buildingId: 'support', buildingName: '承托练习',
    summary: '用普通单元搭建三层，再拆除下层。上方仍需要承托时，系统会在原格自动生成支柱。',
    tasks: [
      edit('Add', 5, 3, 0, '添加底层单元', '左键点击橙色目标格。'),
      edit('Add', 5, 3, 1, '添加中层单元', '切到第 1 层，在同一位置继续添加。'),
      edit('Add', 5, 3, 2, '添加顶层单元', '切到第 2 层，完成三层叠建。'),
      edit('Remove', 5, 3, 0, '拆除底层单元', '底层体量消失，原格自动生成支柱，上方单元保留。', { column: true }),
      edit('Remove', 5, 3, 1, '拆除中层单元', '中层也留下支柱，与底层支柱形成连续承托。', { column: true }),
      edit('Remove', 5, 3, 0, '尝试移除底层支柱', '顶层仍依赖这组支柱，观察系统拒绝拆除。', { reject: 'REJECT_SUPPORT_UNRESOLVED' }),
    ],
  },
  court: {
    title: '庭院 · 封闭与重开', sourceStep: 31, buildingId: 'court', buildingName: '庭院围合',
    summary: '添加最后一格围墙，确认屋盖方案，再移除该格并观察天空连通。',
    tasks: [
      edit('Add', 2, 3, 1, '添加上层最后一格围墙', '请求会暂存。请选择“通高空间 · 不透光屋盖”完成封闭。',
        { roofClosure: 'COVERED_OPAQUE', spaceIntent: 'DOUBLE_HEIGHT' }),
      edit('Remove', 2, 3, 1, '移除刚添加的围墙', '观察屋盖退出场景，庭院重新与天空连通。'),
    ],
  },
};
