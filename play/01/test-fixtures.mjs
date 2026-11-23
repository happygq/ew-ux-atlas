// Compact U, its entrance bay, and a wider compound near the opposite shore.
export const u = [[9, 9], [10, 9], [11, 9], [9, 10], [11, 10], [9, 11], [11, 11]];
export const gate = [10, 11];
export const compound = [
  [18, 18], [19, 18], [20, 18], [21, 18], [22, 18],
  [18, 19], [22, 19], [18, 20], [22, 20],
  [18, 21], [19, 21], [20, 21], [21, 21], [22, 21],
];
export const apply = (edit, points, type = 'add', palette = 0) => points.map(([x, z]) => edit({ type, x, z, palette }));
