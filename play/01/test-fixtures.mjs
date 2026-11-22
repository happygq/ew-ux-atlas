// Compact U, its entrance bay, and a wider compound near the opposite shore.
export const u = [[9, 9], [10, 9], [11, 9], [9, 10], [11, 10], [9, 11], [11, 11]];
export const gate = [10, 11];
export const compound = [
  [23, 22], [24, 22], [25, 22], [26, 22], [27, 22],
  [23, 23], [27, 23], [23, 24], [27, 24],
  [23, 25], [24, 25], [25, 25], [26, 25], [27, 25],
];
export const apply = (edit, points, type = 'add', palette = 0) => points.map(([x, z]) => edit({ type, x, z, palette }));
