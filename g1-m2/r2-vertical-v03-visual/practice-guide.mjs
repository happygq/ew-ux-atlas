const edit = (type, x, z, level, title, details, extra = {}) =>
  ({ action: { type, x, z, level }, title, details, ...extra });

export const guides = {
  stair: {
    title: '南侧楼梯 · 拆除与恢复', sourceStep: 42, buildingId: 'south', buildingName: '南侧建筑',
    summary: '拆除楼梯平台会使旧通行意图失效。重建平台后，亲自确认新的楼梯提案。',
    tasks: [
      edit('Remove', 5, 4, 1, '拆除南侧上层平台', '拆除后观察南侧虚线消失，东侧路线仍保留。'),
      edit('Add', 5, 4, 1, '在原位重建平台', '选择普通单元。重建后先观察新的楼梯提案。', { role: 'BEARING_ASSEMBLY' }),
      { decision: 'STAIR', title: '批准新楼梯', details: '确认新提案后，南侧抽象路线才会重新出现。' },
    ],
  },
  support: {
    title: '承托 · 建柱与切换', sourceStep: 19, buildingId: 'support', buildingName: '承托组',
    summary: '在“添加”内选择柱，建立两组承托，再亲自移除一根柱并观察来源切换。',
    tasks: [
      edit('Add', 8, 3, 0, '添加南柱', '在“添加类型”中选择“柱”。', { role: 'COLUMN' }),
      edit('Add', 8, 5, 0, '添加北柱', '在“添加类型”中选择“柱”。', { role: 'COLUMN' }),
      edit('Add', 8, 4, 1, '添加上层混合承托房间', '该房间需要中央承载体和两根柱。', { role: 'MIXED_ROOM' }),
      edit('Add', 7, 4, 0, '添加西柱', '在“添加类型”中选择“柱”。', { role: 'COLUMN' }),
      edit('Add', 9, 4, 0, '添加东柱', '东西向方案齐备时，当前有效的南北向承托仍会保留。', { role: 'COLUMN' }),
      edit('Remove', 8, 3, 0, '移除南柱', '观察承托切换到东西向，上层房间的单元 ID 保持不变。'),
      edit('Remove', 7, 4, 0, '试着再移除西柱', '观察缺少完整替代方案时的拒绝和场景状态。', { reject: 'REJECT_SUPPORT_UNRESOLVED' }),
    ],
  },
  court: {
    title: '庭院 · 封闭与重开', sourceStep: 31, buildingId: 'court', buildingName: '庭院围合',
    summary: '添加最后一格围墙，确认屋盖方案，再移除该格并观察天空连通。',
    tasks: [
      edit('Add', 2, 3, 1, '添加上层最后一格围墙', '请求会暂存。请选择“通高空间 · 不透光屋盖”完成封闭。',
        { role: 'BEARING_ASSEMBLY', roofClosure: 'COVERED_OPAQUE', spaceIntent: 'DOUBLE_HEIGHT' }),
      edit('Remove', 2, 3, 1, '移除刚添加的围墙', '观察屋盖退出场景，庭院重新与天空连通。'),
    ],
  },
};
