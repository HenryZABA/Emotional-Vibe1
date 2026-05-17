/*
  Dense grass field with wind waves.
  ~12,000 short blades on a stratified grid all sample the same wave
  field. When a blade lays over, its colour shifts toward pale silver-
  green — so coherent gusts show up as visible light/dark bands
  drifting across the surface, just like wheat in wind. The boat sits
  in a small grass-free opening.
*/

// ---------- Canvas ----------
const BASE_W = 390;
const BASE_H = 844;

// ---------- Palette ----------
// Background vertical gradient — slightly hazy top, deep field bottom.
const BG_TOP    = "#C9D9B3";
const BG_UPPER  = "#88AD6E";
const BG_MID    = "#4E8E40";
const BG_LOW    = "#2D6428";
const BG_BOT    = "#163E14";

// Blade base colour (mid-field).
const GRASS_R = 70;
const GRASS_G = 130;
const GRASS_B = 55;

// Pale "back-of-leaf / laid-over" colour — gives the silvery sheen on
// wave crests.
const BENT_R = 218;
const BENT_G = 232;
const BENT_B = 170;

// Bottom-of-field darker grass.
const DARK_R = 30;
const DARK_G = 75;
const DARK_B = 28;

const BOAT_MAIN  = "#0E2520";
const BOAT_DARK  = "#06140F";
const BOAT_LITE  = "#345646";
const FIG_WARM   = "#6B3E2A";
const FIG_DARK   = "#3F2316";

// ---------- State ----------
let grasses = [];
let bgLayer;
let boat = { x: 0, y: 0, vx: 0 };
let t = 0;
let scaleFactor = 1;
let seed;

// Stratified placement — column × row blade count.
const COLS = 78;
const ROWS = 175;
// Total: ~13,650 blades.

// Coarse noise field for the wind gust component.
const NF_COLS = 48;
const NF_ROWS = 100;
let noiseField;

// Clearing semi-axes — just enough to seat the boat.
const ELL_W = 50;
const ELL_H = 19;

function setup() {
  const targetRatio = BASE_W / BASE_H;
  let w = windowWidth;
  let h = windowHeight;
  if (w / h > targetRatio) w = h * targetRatio;
  else h = w / targetRatio;

  const cnv = createCanvas(Math.floor(w), Math.floor(h));
  cnv.parent("sketch-holder");
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));

  scaleFactor = width / BASE_W;
  seed = floor(random(99999));
  randomSeed(seed);
  noiseSeed(seed);

  buildBackground();
  buildGrasses();
  noiseField = new Float32Array(NF_COLS * NF_ROWS);

  boat.x = -60;
  boat.y = BASE_H * 0.60;
  boat.vx = BASE_W / (60 * 42);   // ~42s left → right

  frameRate(60);
}

function windowResized() {
  const targetRatio = BASE_W / BASE_H;
  let w = windowWidth;
  let h = windowHeight;
  if (w / h > targetRatio) w = h * targetRatio;
  else h = w / targetRatio;
  resizeCanvas(Math.floor(w), Math.floor(h));
  scaleFactor = width / BASE_W;
  buildBackground();
}

// ---------- Background ----------
function buildBackground() {
  bgLayer = createGraphics(BASE_W, BASE_H);
  bgLayer.noStroke();

  const stops = [
    { p: 0.00, c: color(BG_TOP) },
    { p: 0.08, c: color(BG_UPPER) },
    { p: 0.40, c: color(BG_MID) },
    { p: 0.78, c: color(BG_LOW) },
    { p: 1.00, c: color(BG_BOT) },
  ];
  for (let y = 0; y < BASE_H; y++) {
    const p = y / (BASE_H - 1);
    let c1 = stops[0].c, c2 = stops[1].c, p1 = 0, p2 = 1;
    for (let i = 0; i < stops.length - 1; i++) {
      if (p >= stops[i].p && p <= stops[i + 1].p) {
        c1 = stops[i].c; c2 = stops[i + 1].c;
        p1 = stops[i].p; p2 = stops[i + 1].p;
        break;
      }
    }
    const local = (p - p1) / max(0.0001, (p2 - p1));
    bgLayer.stroke(lerpColor(c1, c2, local));
    bgLayer.line(0, y, BASE_W, y);
  }

  // Faint paper grain.
  bgLayer.noStroke();
  for (let i = 0; i < 1800; i++) {
    bgLayer.fill(random() < 0.5 ? 255 : 0, random(3, 9));
    bgLayer.rect(random(BASE_W), random(BASE_H), 1, 1);
  }
}

// ---------- Grass placement ----------
function buildGrasses() {
  grasses = [];
  const cellW = BASE_W / COLS;
  const cellH = BASE_H / ROWS;

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      // Stratified sample within each cell (with small overflow so
      // edges don't show a hard column boundary).
      const x = c * cellW + random(-0.15, 1.15) * cellW;
      const y = r * cellH + random(-0.15, 1.15) * cellH;

      // Keep a thin haze strip at the very top free of grass.
      if (y < BASE_H * 0.04) continue;

      // Slight per-blade vertical jitter from a rolling-ground noise so
      // the surface has gentle rolling rather than a flat carpet.
      const lift = (noise(x * 0.008, y * 0.005) - 0.5) * 14;

      const yNorm = constrain(y / BASE_H, 0, 1);

      // Length grows toward the bottom (perspective).
      const lenBase = lerp(6, 24, yNorm);
      const len = lenBase + random(-1.5, 2.5);

      // Width grows toward the bottom.
      const widthBase = lerp(0.45, 1.05, yNorm);
      const width = widthBase + random(-0.10, 0.18);

      // Per-blade colour tint so the field isn't flat.
      const tint = random(-22, 18);

      grasses.push({
        x, y: y + lift,
        len, width,
        tint,
        yNorm,
        baseLean: random(-1, 1),
        phase: random(TWO_PI),
      });
    }
  }
}

// ---------- Wind / wave field ----------
// Per-frame coarse noise sample so we don't call noise() per blade.
function sampleNoiseField() {
  for (let i = 0; i < NF_COLS; i++) {
    const xN = (i / (NF_COLS - 1)) * BASE_W * 0.0055;
    for (let j = 0; j < NF_ROWS; j++) {
      const yN = (j / (NF_ROWS - 1)) * BASE_H * 0.0055;
      noiseField[i * NF_ROWS + j] = noise(xN, yN, t * 0.30) - 0.5;
    }
  }
}

function fieldNoise(x, y) {
  const fc = (x / BASE_W) * (NF_COLS - 1);
  const fr = (y / BASE_H) * (NF_ROWS - 1);
  let ic = floor(fc); let ir = floor(fr);
  if (ic < 0) ic = 0; else if (ic > NF_COLS - 2) ic = NF_COLS - 2;
  if (ir < 0) ir = 0; else if (ir > NF_ROWS - 2) ir = NF_ROWS - 2;
  const dc = fc - ic;
  const dr = fr - ir;
  const a00 = noiseField[ic * NF_ROWS + ir];
  const a10 = noiseField[(ic + 1) * NF_ROWS + ir];
  const a01 = noiseField[ic * NF_ROWS + (ir + 1)];
  const a11 = noiseField[(ic + 1) * NF_ROWS + (ir + 1)];
  return (a00 * (1 - dc) + a10 * dc) * (1 - dr) +
         (a01 * (1 - dc) + a11 * dc) * dr;
}

// Returns the bend signal at (x, y) — drives both blade orientation AND
// the silvery colour shift, so coherent gust patches read as visible
// light/dark bands.
function waveBend(x, y) {
  // Two travelling sine bands at different wavelengths and directions.
  const w1 = sin(x * 0.020 + y * 0.012 - t * 0.85);
  const w2 = sin(x * 0.038 - y * 0.024 + t * 1.30) * 0.45;
  // Slow gust noise (precomputed).
  const n  = fieldNoise(x, y);
  let v = w1 * 0.55 + w2 + n * 1.4;
  // Soft clamp.
  if (v >  1.2) v =  1.2;
  if (v < -1.2) v = -1.2;
  return v;
}

// ---------- Draw ----------
function draw() {
  t = frameCount * 0.008;

  boat.x += boat.vx;
  if (boat.x > BASE_W + 80) boat.x = -80;
  boat.y = BASE_H * 0.60 + sin(t * 0.6) * 1.5;

  sampleNoiseField();

  push();
  scale(scaleFactor);

  image(bgLayer, 0, 0);
  drawGrass();
  drawBoat(boat.x, boat.y);
  drawHaze();

  pop();
}

function drawGrass() {
  const bx = boat.x;
  const by = boat.y;

  noFill();
  strokeJoin(ROUND);

  for (let i = 0; i < grasses.length; i++) {
    const g = grasses[i];
    const x0 = g.x;
    const y0 = g.y;

    // Off-canvas culling.
    if (x0 < -10 || x0 > BASE_W + 10) continue;
    if (y0 < -5 || y0 > BASE_H + 30) continue;

    // Clearing exclusion: root inside ellipse → skip.
    const dxc = (x0 - bx) / ELL_W;
    const dyc = (y0 - by) / ELL_H;
    if (dxc * dxc + dyc * dyc < 1) continue;

    // Vertical clip: if root is below clearing within its x range, cap
    // length so the tip stops at the clearing rim.
    let effLen = g.len;
    if (dxc > -1 && dxc < 1) {
      const yOff = ELL_H * sqrt(1 - dxc * dxc);
      const yLowRim = by + yOff;
      if (y0 > yLowRim) {
        effLen = min(g.len, y0 - yLowRim - 1);
      }
    }
    if (effLen < 3) continue;

    // Wave-driven bend.
    const W = waveBend(x0, y0);
    const bendMag = W < 0 ? -W : W;

    // Tip can swing up to ~70% of length sideways — strong gust nearly
    // lays the blade flat.
    const maxBend = effLen * 0.70;
    const tipDx = W * maxBend + g.baseLean * 2.2;
    // Squared droop so calm blades stay nearly upright; only strong
    // bends drop the tip much.
    const droopY = bendMag * bendMag * effLen * 0.32;

    const tipX = x0 + tipDx;
    const tipY = y0 - effLen + droopY;
    const ctrlX = x0 + tipDx * 0.40;
    const ctrlY = y0 - effLen * 0.60 + droopY * 0.45;

    // Base colour: blade green darkens toward the bottom of the canvas;
    // mid-field is brightest.
    const yN = g.yNorm;
    let baseR = lerp(GRASS_R + 28, DARK_R + 5,  yN) + g.tint * 0.55;
    let baseG = lerp(GRASS_G + 32, DARK_G + 10, yN) + g.tint;
    let baseB = lerp(GRASS_B + 18, DARK_B + 3,  yN) + g.tint * 0.40;

    // The wave-band effect: when the blade lays over (bendMag high), it
    // turns toward the pale "back-of-leaf" silver-green. Coherent gust
    // patches therefore show as visible bright streaks.
    const palePull = bendMag * 0.55;
    const r  = baseR + (BENT_R - baseR) * palePull;
    const gg = baseG + (BENT_G - baseG) * palePull;
    const b  = baseB + (BENT_B - baseB) * palePull;

    // Alpha: near grass slightly more opaque than far.
    const a = lerp(160, 215, yN);

    stroke(r, gg, b, a);
    strokeWeight(g.width);
    beginShape();
    vertex(x0, y0);
    quadraticVertex(ctrlX, ctrlY, tipX, tipY);
    endShape();
  }
}

// ---------- Boat ----------
function drawBoat(bx, by) {
  push();
  translate(bx, by);
  rotate(sin(t * 0.6) * 0.02);

  const bw = 16;
  const bh = 2.4;

  // Hull.
  noStroke();
  fill(BOAT_MAIN);
  beginShape();
  vertex(-bw, 0);
  quadraticVertex(-bw * 0.7, bh * 1.15, 0, bh * 1.2);
  quadraticVertex(bw * 0.7, bh * 1.15, bw, 0);
  quadraticVertex(bw * 0.6, -bh * 0.3, 0, -bh * 0.1);
  quadraticVertex(-bw * 0.6, -bh * 0.3, -bw, 0);
  endShape(CLOSE);

  // Inner shadow.
  stroke(BOAT_DARK);
  strokeWeight(0.6);
  noFill();
  beginShape();
  vertex(-bw * 0.82, 0.2);
  quadraticVertex(0, bh * 0.95, bw * 0.82, 0.2);
  endShape();

  // Gunwale highlight.
  stroke(BOAT_LITE);
  strokeWeight(0.3);
  beginShape();
  vertex(-bw * 0.78, -bh * 0.15);
  quadraticVertex(0, -bh * 0.4, bw * 0.78, -bh * 0.15);
  endShape();

  // Tiny figure.
  noStroke();
  fill(FIG_DARK);
  ellipse(-1, -bh * 0.9, 1.8, 3.2);
  fill(FIG_WARM);
  ellipse(-1, -bh * 1.25, 1.3, 1.3);

  pop();
}

// ---------- Final haze ----------
function drawHaze() {
  push();
  noStroke();
  // Top atmospheric haze.
  for (let i = 0; i < 4; i++) {
    fill(220, 232, 195, 5);
    rect(0, 0, BASE_W, BASE_H * 0.10);
  }
  // Bottom darken.
  for (let y = 0; y < 50; y++) {
    const a = map(y, 0, 50, 0, 22);
    stroke(8, 28, 14, a);
    line(0, BASE_H - y, BASE_W, BASE_H - y);
  }
  pop();
}
