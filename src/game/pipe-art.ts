/**
 * Smart pipe drawing. Shapes itself from a connection mask (1=up, 2=right, 4=down, 8=left).
 * Port ends get a flange. Lit pipes get a flowing highlight.
 */

const BODY = "#8794a6";
const LIGHT = "#c5d1df";
const DARK = "#566171";
const OUTLINE = "#141214";
const PORT = "#a9b6c7";
const FLOW = "#9fe8ff";

type Rect = [number, number, number, number]; // x,y,w,h relative

const ARMS: Rect[] = [
  [13, 0, 6, 16],   // up
  [16, 13, 16, 6],  // right
  [13, 16, 6, 16],  // down
  [0, 13, 16, 6],   // left
];

export function paintPipe(ctx: CanvasRenderingContext2D, x: number, y: number, mask: number, port: number, lit: boolean, clock: number) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const bits = [0, 1, 2, 3].filter((i) => mask & (1 << i));
  const straight = bits.length === 2 && ((mask & 5) === 5 || (mask & 10) === 10);
  const C = 16, HW = 3; // hub half-width

  // arms
  for (const i of bits) {
    const r: Rect = [...ARMS[i]] as Rect;
    if (!straight) {
      if (i === 0) r[3] = C - HW;
      else if (i === 2) { r[1] = C + HW; r[3] = 32 - r[1]; }
      else if (i === 1) { r[0] = C + HW; r[2] = 32 - r[0]; }
      else r[2] = C - HW;
    }
    // outline
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + r[0] - 1, y + r[1] - 1, r[2] + 2, r[3] + 2);
    // body
    ctx.fillStyle = BODY;
    ctx.fillRect(x + r[0], y + r[1], r[2], r[3]);
    // highlight
    ctx.fillStyle = LIGHT;
    if (i % 2 === 0) ctx.fillRect(x + r[0] + 1, y + r[1], 2, r[3]);
    else ctx.fillRect(x + r[0], y + r[1] + 1, r[2], 2);
    // shadow
    ctx.fillStyle = DARK;
    if (i % 2 === 0) ctx.fillRect(x + r[0] + r[2] - 3, y + r[1], 2, r[3]);
    else ctx.fillRect(x + r[0], y + r[1] + r[3] - 3, r[2], 2);
  }

  // hub
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x + 12, y + 12, 8, 8);
  ctx.fillStyle = BODY;
  ctx.fillRect(x + 13, y + 13, 6, 6);
  ctx.fillStyle = LIGHT;
  ctx.fillRect(x + 13, y + 13, 6, 2);

  // port flanges
  for (let i = 0; i < 4; i++) {
    if (!(port & (1 << i))) continue;
    const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][i];
    const fx = x + 16 + dx * 14 - 3, fy = y + 16 + dy * 14 - 3;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(fx - 1, fy - 1, 8, 8);
    ctx.fillStyle = PORT;
    ctx.fillRect(fx, fy, 6, 6);
  }

  // flow dots when lit
  if (lit && bits.length > 0) {
    const t = (clock * 2.4) % 1;
    ctx.fillStyle = FLOW;
    for (const i of bits) {
      const r = ARMS[i];
      const along = i % 2 === 0 ? r[3] : r[2];
      const pos = Math.floor(t * along);
      if (i === 0) ctx.fillRect(x + r[0] + 2, y + r[1] + pos, 2, 2);
      else if (i === 2) ctx.fillRect(x + r[0] + 2, y + r[1] + r[3] - pos - 2, 2, 2);
      else if (i === 1) ctx.fillRect(x + r[0] + r[2] - pos - 2, y + r[1] + 2, 2, 2);
      else ctx.fillRect(x + r[0] + pos, y + r[1] + 2, 2, 2);
    }
  }

  ctx.restore();
}
