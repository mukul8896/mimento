// Builds the original Lottie illustrations in apps/web/public/lottie (shapes only: no text
// layers, so the player never loads fonts or injects styles). Run: node scripts/build-lottie.mjs
import { writeFileSync } from 'node:fs';

const FR = 30;
const val = (k) => ({ a: 0, k });
const anim = (keys) => ({
  a: 1,
  k: keys.map(([t, s], i) =>
    i === keys.length - 1 ? { t, s } : { t, s, i: { x: [0.3], y: [1] }, o: { x: [0.6], y: [0] } },
  ),
});
const tr = (extra = {}) => ({
  ty: 'tr',
  p: val([0, 0]),
  a: val([0, 0]),
  s: val([100, 100]),
  r: val(0),
  o: val(100),
  sk: val(0),
  sa: val(0),
  ...extra,
});
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};
const fill = (hex) => ({ ty: 'fl', c: val(rgb(hex)), o: val(100), r: 1 });
const stroke = (hex, w) => ({ ty: 'st', c: val(rgb(hex)), o: val(100), w: val(w), lc: 2, lj: 2 });
const path = (v, i = v.map(() => [0, 0]), o = v.map(() => [0, 0])) => ({
  ty: 'sh',
  ks: val({ c: true, v, i, o }),
});
const layer = (ind, nm, shapes, ks, op) => ({
  ddd: 0,
  ind,
  ty: 4,
  nm,
  sr: 1,
  ks: {
    o: val(100),
    r: val(0),
    p: val([100, 100, 0]),
    a: val([0, 0, 0]),
    s: val([100, 100, 100]),
    ...ks,
  },
  ao: 0,
  shapes,
  ip: 0,
  op,
  st: 0,
  bm: 0,
});
const file = (nm, op, layers) => ({
  v: '5.7.0',
  fr: FR,
  ip: 0,
  op,
  w: 200,
  h: 200,
  nm,
  ddd: 0,
  assets: [],
  layers,
});

// A four-point sparkle, centred on (x, y).
const sparkle = (x, y, r) =>
  path([
    [x, y - r],
    [x + r * 0.28, y - r * 0.28],
    [x + r, y],
    [x + r * 0.28, y + r * 0.28],
    [x, y + r],
    [x - r * 0.28, y + r * 0.28],
    [x - r, y],
    [x - r * 0.28, y - r * 0.28],
  ]);

// Heart: two cubic segments, bottom point to the dip between the lobes and back.
const HEART = path(
  [
    [0, 40],
    [0, -18],
  ],
  [
    [60, -40],
    [-40, -27],
  ],
  [
    [-60, -40],
    [40, -27],
  ],
);

// ---- Ring: grows in, settles, the stone catches the light, sparkles twinkle. 3 s, loops.
const RING_OP = 90;
const ring = file('ring', RING_OP, [
  layer(
    1,
    'sparkles',
    [
      {
        ty: 'gr',
        it: [
          sparkle(46, -70, 11),
          fill('#FFFFFF'),
          tr({
            o: anim([
              [18, 0],
              [26, 100],
              [40, 0],
              [62, 0],
              [70, 100],
              [84, 0],
            ]),
          }),
        ],
      },
      {
        ty: 'gr',
        it: [
          sparkle(-44, -52, 8),
          fill('#FFF3C4'),
          tr({
            o: anim([
              [28, 0],
              [36, 100],
              [50, 0],
              [74, 0],
              [80, 100],
              [89, 0],
            ]),
          }),
        ],
      },
    ],
    {},
    RING_OP,
  ),
  layer(
    2,
    'stone',
    [
      {
        ty: 'gr',
        it: [
          path([
            [0, -86],
            [20, -66],
            [0, -44],
            [-20, -66],
          ]),
          fill('#CFE8FF'),
          stroke('#FFFFFF', 3),
          tr(),
        ],
      },
      {
        ty: 'gr',
        it: [
          path([
            [0, -80],
            [9, -66],
            [0, -54],
            [-9, -66],
          ]),
          fill('#FFFFFF'),
          tr({
            o: anim([
              [20, 20],
              [30, 95],
              [45, 30],
              [66, 30],
              [74, 95],
              [88, 20],
            ]),
          }),
        ],
      },
    ],
    {
      // The stone sits on the band (band top = 116 − 48).
      p: val([100, 112, 0]),
      s: anim([
        [0, [0, 0, 100]],
        [14, [0, 0, 100]],
        [26, [112, 112, 100]],
        [34, [100, 100, 100]],
      ]),
    },
    RING_OP,
  ),
  layer(
    3,
    'band',
    [
      {
        ty: 'gr',
        it: [{ ty: 'el', p: val([0, 0]), s: val([96, 96]) }, stroke('#E3AF45', 13), tr()],
      },
      {
        ty: 'gr',
        it: [
          { ty: 'el', p: val([0, -2]), s: val([84, 84]) },
          stroke('#F8DC8C', 3),
          tr({ o: val(80) }),
        ],
      },
    ],
    {
      p: val([100, 116, 0]),
      s: anim([
        [0, [0, 0, 100]],
        [16, [108, 108, 100]],
        [24, [100, 100, 100]],
      ]),
      r: anim([
        [24, -4],
        [57, 4],
        [89, -4],
      ]),
    },
    RING_OP,
  ),
]);

// ---- Heart: a soft double beat (lub-dub), then rest. 1.2 s, loops.
const HEART_OP = 36;
const heart = file('heart', HEART_OP, [
  layer(
    1,
    'glow',
    [{ ty: 'gr', it: [HEART, fill('#FF8FB1'), tr({ o: val(35) })] }],
    {
      s: anim([
        [0, [120, 120, 100]],
        [6, [150, 150, 100]],
        [14, [132, 132, 100]],
        [20, [150, 150, 100]],
        [35, [120, 120, 100]],
      ]),
    },
    HEART_OP,
  ),
  layer(
    2,
    'heart',
    [
      { ty: 'gr', it: [HEART, fill('#E23D6D'), tr()] },
      {
        ty: 'gr',
        it: [
          path([
            [-22, -14],
            [-10, -26],
            [-4, -20],
            [-16, -8],
          ]),
          fill('#FFFFFF'),
          tr({ o: val(45) }),
        ],
      },
    ],
    {
      s: anim([
        [0, [100, 100, 100]],
        [5, [116, 116, 100]],
        [10, [102, 102, 100]],
        [15, [112, 112, 100]],
        [24, [100, 100, 100]],
      ]),
    },
    HEART_OP,
  ),
]);

const out = new URL('../apps/web/public/lottie/', import.meta.url);
writeFileSync(new URL('ring.json', out), JSON.stringify(ring));
writeFileSync(new URL('heart.json', out), JSON.stringify(heart));
console.log('wrote ring.json and heart.json');
