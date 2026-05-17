/*
  Reed field & a small boat — clockwise vortex of reeds around the boat.
  Layered far / mid / near blades all run along a tangent direction
  centred on the boat, with subtle wind sway. No water layer: the boat
  sits in a small grass-free area and the background gradient shows
  through as the pale "pool".
*/

// ---------- Canvas ----------
const BASE_W = 390;
const BASE_H = 844;

// ---------- Palette ----------
// Atmospheric perspective: hazy cream sky → pale teal mid (this is what
// the boat clearing exposes) → deep emerald bottom.
const SKY_TOP    = "#F5F7EE";
const SKY_MIST   = "#DDEBDD";
const SKY_TEAL   = "#B6D6BD";
const MID_GREEN  = "#6DA773";
const DEEP_GREEN = "#2D6448";
const SHADE_GRN  = "#163F34";

// Reed palette buckets (hex; converted to rgb at build time).
const GRASS_DARK = ["#174633", "#1D5B42", "#246B4A", "#2F7A55"];
const GRASS_MID  = ["#4F9A68", "#68B17D", "#7FC493", "#91CFA3"];
const GRASS_LITE = ["#B9E0C4", "#D5EED8", "#E6F4E5", "#F2F7EC"];
const GRASS_COOL = ["#8ECDB2", "#A9DCC4", "#C8E8D8"];

// Cream highlight baked into ~12% of blades' tips.
const TIP_HL_R = 230;
const TIP_HL_G = 233;
const TIP_HL_B = 181;

// Boat.
const BOAT_MAIN  = "#102B25";
const BOAT_DARK  = "#06140F";
const BOAT_LITE  = "#345646";
const FIG_WARM   = "#6B3E2A";
const FIG_DARK   = "#3F2316";

// ---------- State ----------
let grasses = [];
let bgLayer;
let fogLayer;
let bgStops;            // shared between buildBackground & sampleBgColor
let boat = { x: 0, y: 0, vx: 0 };
let t = 0;
let scaleFactor = 1;
let seed;

// Per-layer reed counts.
const FAR_COUNT   = 7500;
const MID_COUNT   = 10500;
const NEAR_COUNT  = 2800;
// Background-tinted "ghost" blades that fade the top edge of the field.
const GHOST_COUNT = 6500;
// Total ≈ 27,300.

// Coarse noise grid for the gust component (sampled once per frame).
const NF_COLS = 48;
const NF_ROWS = 100;
let noiseField;

// Clearing semi-axes.
const ELL_W = 100;   // → 200 wide
const ELL_H = 45;    // → 90 tall

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

  bgStops = [
    { p: 0.00, c: color(SKY_TOP) },
    { p: 0.18, c: color(SKY_MIST) },
    { p: 0.45, c: color(SKY_TEAL) },
    { p: 0.65, c: color(MID_GREEN) },
    { p: 0.85, c: color(DEEP_GREEN) },
    { p: 1.00, c: color(SHADE_GRN) },
  ];

  buildBackground();
  buildFog();
  buildGrasses();
  noiseField = new Float32Array(NF_COLS * NF_ROWS);

  boat.x = -60;
  boat.y = BASE_H * 0.56;
  boat.vx = BASE_W / (60 * 45);

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
  buildFog();
}

// ---------- Background ----------
function buildBackground() {
  bgLayer = createGraphics(BASE_W, BASE_H);
  bgLayer.noStroke();

  for (let y = 0; y < BASE_H; y++) {
    const p = y / (BASE_H - 1);
    let c1 = bgStops[0].c, c2 = bgStops[1].c, p1 = 0, p2 = 1;
    for (let i = 0; i < bgStops.length - 1; i++) {
      if (p >= bgStops[i].p && p <= bgStops[i + 1].p) {
        c1 = bgStops[i].c; c2 = bgStops[i + 1].c;
        p1 = bgStops[i].p; p2 = bgStops[i + 1].p;
        break;
      }
    }
    const local = (p - p1) / max(0.0001, (p2 - p1));
    bgLayer.stroke(lerpColor(c1, c2, local));
    bgLayer.line(0, y, BASE_W, y);
  }

  bgLayer.noStroke();
  for (let i = 0; i < 2200; i++) {
    bgLayer.fill(random() < 0.5 ? 255 : 0, random(3, 9));
    bgLayer.rect(random(BASE_W), random(BASE_H), 1, 1);
  }
  for (let i = 0; i < 10; i++) {
    bgLayer.fill(255, random(3, 8));
    bgLayer.rect(0, random(BASE_H * 0.25, BASE_H), BASE_W, random(40, 160));
  }
}

function buildFog() {
  fogLayer = createGraphics(BASE_W, BASE_H);
  fogLayer.noStroke();
  for (let y = 0; y < BASE_H * 0.55; y++) {
    const a = map(y, 0, BASE_H * 0.55, 130, 0);
    fogLayer.stroke(255, 255, 255, a);
    fogLayer.line(0, y, BASE_W, y);
  }
  for (let i = 0; i < 600; i++) {
    fogLayer.fill(255, random(2, 6));
    fogLayer.ellipse(random(BASE_W), random(BASE_H * 0.6),
                     random(20, 80), random(20, 80));
  }
}

// Sample the background gradient at vertical position y. Used to colour
// the "ghost" reeds the same shade as the bg at their location so they
// blend in — only their fine line texture is visible, which softens the
// edge where the grass field meets the haze.
function sampleBgColor(y) {
  const p = constrain(y / BASE_H, 0, 1);
  for (let i = 0; i < bgStops.length - 1; i++) {
    if (p >= bgStops[i].p && p <= bgStops[i + 1].p) {
      const local = (p - bgStops[i].p) / (bgStops[i + 1].p - bgStops[i].p);
      return lerpColor(bgStops[i].c, bgStops[i + 1].c, local);
    }
  }
  return bgStops[bgStops.length - 1].c;
}

// ---------- Reeds ----------
function buildGrasses() {
  grasses = [];

  // Ghost reeds — bg-tinted blades biased toward the top so the field
  // fades into the haze instead of starting with a hard edge.
  for (let i = 0; i < GHOST_COUNT; i++) {
    // pow < 1 biases toward smaller fractions → density highest near
    // the top of the grass band.
    const yFrac = pow(random(), 1.8);
    const y = BASE_H * 0.08 + BASE_H * 0.55 * yFrac;
    const x = random(-20, BASE_W + 20);
    grasses.push(makeGrass(x, y, 0, true));
  }

  for (let i = 0; i < FAR_COUNT; i++) {
    const x = random(-20, BASE_W + 20);
    const y = random(BASE_H * 0.20, BASE_H * 0.62);
    grasses.push(makeGrass(x, y, 0, false));
  }
  for (let i = 0; i < MID_COUNT; i++) {
    const x = random(-30, BASE_W + 30);
    const y = random(BASE_H * 0.32, BASE_H * 0.96);
    grasses.push(makeGrass(x, y, 1, false));
  }
  for (let i = 0; i < NEAR_COUNT; i++) {
    const x = random(-40, BASE_W + 40);
    const y = random(BASE_H * 0.78, BASE_H + 30);
    grasses.push(makeGrass(x, y, 2, false));
  }

  grasses.sort((a, b) => (a.depth - b.depth) || (a.y - b.y));
}

function makeGrass(x, y, depth, bgTint) {
  let lenMin, lenMax, wMin, wMax, alphaVal;
  const yNorm = constrain(map(y, BASE_H * 0.2, BASE_H, 0, 1), 0, 1);

  if (depth === 0) {
    lenMin = 12;  lenMax = 32;
    wMin = 0.22;  wMax = 0.42;
    const yFactor = constrain(
      map(y, BASE_H * 0.20, BASE_H * 0.60, 0, 1), 0, 1);
    alphaVal = lerp(random(10, 28), random(45, 100), yFactor);
  } else if (depth === 1) {
    lenMin = 25;  lenMax = 62;
    wMin = 0.32;  wMax = 0.62;
    alphaVal = random(70, 150);
  } else {
    lenMin = 55;  lenMax = 105;
    wMin = 0.45;  wMax = 0.85;
    alphaVal = random(150, 215);
  }

  const len = lerp(lenMin, lenMax, pow(yNorm, 0.55) * random(0.8, 1.05));

  let baseR, baseG, baseB;
  if (bgTint) {
    // Ghost blade — colour matches the bg gradient at this y. Tiny
    // tint jitter so the texture has slight variation rather than
    // identical strokes.
    const bgC = sampleBgColor(y);
    baseR = constrain(red(bgC)   + random(-6, 6), 0, 255);
    baseG = constrain(green(bgC) + random(-6, 6), 0, 255);
    baseB = constrain(blue(bgC)  + random(-6, 6), 0, 255);
    // Ghost reeds visible mainly through their fine line texture —
    // moderate alpha so the strokes register but stay subtle.
    alphaVal = random(60, 130);
  } else {
    // Palette pick — bottom biased dark, upper biased light/cool.
    let palette;
    const r = random();
    if (y > BASE_H * 0.70 || depth === 2) {
      if (r < 0.55)      palette = GRASS_DARK;
      else if (r < 0.90) palette = GRASS_MID;
      else if (r < 0.98) palette = GRASS_COOL;
      else               palette = GRASS_LITE;
    } else if (depth === 0) {
      if (r < 0.50)      palette = GRASS_LITE;
      else if (r < 0.80) palette = GRASS_COOL;
      else               palette = GRASS_MID;
    } else {
      if (r < 0.55)      palette = GRASS_MID;
      else if (r < 0.78) palette = GRASS_DARK;
      else if (r < 0.93) palette = GRASS_MID;
      else if (r < 0.99) palette = GRASS_COOL;
      else               palette = GRASS_LITE;
    }
    const c = color(palette[floor(random(palette.length))]);
    baseR = red(c);
    baseG = green(c);
    baseB = blue(c);
  }

  return {
    x, y,
    depth,
    len,
    width: random(wMin, wMax),
    baseR, baseG, baseB,
    alpha: alphaVal,
    swirlJitter: random(-0.10, 0.10),
    bendCurl: random(0.12, 0.22),
    flip: random() < 0.5 ? -1 : 1,
    phase: random(TWO_PI),
    // Cream tip highlights only on real blades, not ghosts.
    hasTipHighlight: !bgTint && random() < 0.12,
  };
}

// ---------- Wind / wave field ----------
function sampleNoiseField() {
  for (let i = 0; i < NF_COLS; i++) {
    const xN = (i / (NF_COLS - 1)) * BASE_W * 0.0040;
    for (let j = 0; j < NF_ROWS; j++) {
      const yN = (j / (NF_ROWS - 1)) * BASE_H * 0.0040;
      noiseField[i * NF_ROWS + j] = noise(xN, yN, t * 0.32) - 0.5;
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

// Small wind sway in radians — animates the tangent direction subtly.
// No bright wave bands; just gentle breath through the field.
function windSway(x, y, phase) {
  const wind = fieldNoise(x, y);
  const wave = sin(x * 0.015 + y * 0.010 + t * 1.5 + phase) * 0.5;
  return wind * 1.2 + wave;
}

// ---------- Draw ----------
function draw() {
  t = frameCount * 0.008;

  boat.x += boat.vx;
  if (boat.x > BASE_W + 80) boat.x = -80;
  boat.y = BASE_H * 0.56 + sin(t * 0.6) * 1.6 + sin(t * 1.3 + 1.2) * 0.5;

  sampleNoiseField();

  push();
  scale(scaleFactor);

  image(bgLayer, 0, 0);
  drawGrassLayer(0);          // far
  image(fogLayer, 0, 0);      // top fog
  drawGrassLayer(1);          // mid
  drawBoat(boat.x, boat.y);
  drawGrassLayer(2);          // near
  drawHaze();

  pop();
}

// ---------- Grass rendering ----------
function drawGrassLayer(depth) {
  noFill();
  strokeJoin(ROUND);

  const bx = boat.x;
  const by = boat.y;

  for (let i = 0; i < grasses.length; i++) {
    const g = grasses[i];
    if (g.depth !== depth) continue;

    const x0 = g.x;
    const y0 = g.y;

    if (x0 < -10 || x0 > BASE_W + 10) continue;

    // Ellipse exclusion for the clearing.
    const dxc = (x0 - bx) / ELL_W;
    const dyc = (y0 - by) / ELL_H;
    const ed  = sqrt(dxc * dxc + dyc * dyc);

    // Near layer keeps a slightly wider exclusion than far/mid.
    const inner = depth === 2 ? 1.18 : 1.0;
    const outer = depth === 2 ? 1.60 : 1.40;

    if (ed < inner) continue;
    let edgeFade = 1;
    if (ed < outer) {
      edgeFade = (ed - inner) / (outer - inner);
      edgeFade = edgeFade * edgeFade * (3 - 2 * edgeFade);  // smoothstep
    }

    let effLen = g.len;

    // Uniform direction: every blade grows toward the upper-right.
    // Small per-blade jitter (g.swirlJitter, ±0.10 rad) + a wind sway
    // angle keep it from being mechanical.
    let swayMax;
    if (depth === 0)      swayMax = 0.06;
    else if (depth === 1) swayMax = 0.11;
    else                  swayMax = 0.16;
    const baseAngle = PI * 0.22 + g.swirlJitter
                    + windSway(x0, y0, g.phase) * swayMax;
    let dirX = sin(baseAngle);
    let dirY = -cos(baseAngle);

    // Ray-vs-ellipse intersection: clip length so the tip stops at the
    // clearing rim instead of poking into it.
    const aQ = (dirX * dirX) / (ELL_W * ELL_W) + (dirY * dirY) / (ELL_H * ELL_H);
    const bQ = 2 * ((x0 - bx) * dirX / (ELL_W * ELL_W) +
                    (y0 - by) * dirY / (ELL_H * ELL_H));
    const cQ = dxc * dxc + dyc * dyc - 1;
    const disc = bQ * bQ - 4 * aQ * cQ;
    if (disc > 0) {
      const sqrtD = sqrt(disc);
      const t1 = (-bQ - sqrtD) / (2 * aQ);
      if (t1 > 0 && t1 < effLen) {
        effLen = max(t1 - 1, 0);
      }
    }
    if (effLen < 3) continue;

    // Length & width fade near the clearing rim.
    const len = effLen * (0.55 + 0.45 * edgeFade);
    const w   = g.width * (0.6 + 0.4 * edgeFade);

    // Tip at (root + dir * len). Comma curl: control point offset along
    // the perpendicular.
    const tipX = x0 + dirX * len;
    const tipY = y0 + dirY * len;
    const pX = -dirY;
    const pY =  dirX;
    const curlAmt = len * g.bendCurl * g.flip;
    const ctrlX = x0 + dirX * len * 0.5 + pX * curlAmt;
    const ctrlY = y0 + dirY * len * 0.5 + pY * curlAmt;

    const a = g.alpha * edgeFade;
    if (a < 3) continue;

    // Main blade stroke — no colour modulation, just the baked palette.
    stroke(g.baseR, g.baseG, g.baseB, a);
    strokeWeight(w);
    beginShape();
    vertex(x0, y0);
    quadraticVertex(ctrlX, ctrlY, tipX, tipY);
    endShape();

    // Tip taper for thicker blades — finer overlay covering the upper
    // half of the curve, same colour at slightly lower alpha.
    if (w > 0.50) {
      const sX = lerp(x0, ctrlX, 0.55);
      const sY = lerp(y0, ctrlY, 0.55);
      stroke(g.baseR, g.baseG, g.baseB, a * 0.80);
      strokeWeight(w * 0.45);
      beginShape();
      vertex(sX, sY);
      quadraticVertex(
        lerp(ctrlX, tipX, 0.45),
        lerp(ctrlY, tipY, 0.45),
        tipX, tipY
      );
      endShape();
    }

    // Baked-in cream tip highlight on a small fraction of blades —
    // gives the reference's "occasional yellow tip" look without any
    // animated sheen.
    if (g.hasTipHighlight && edgeFade > 0.4) {
      const hX = lerp(ctrlX, tipX, 0.4);
      const hY = lerp(ctrlY, tipY, 0.4);
      stroke(TIP_HL_R, TIP_HL_G, TIP_HL_B, a * 0.55);
      strokeWeight(w * 0.55);
      beginShape();
      vertex(hX, hY);
      quadraticVertex(
        lerp(ctrlX, tipX, 0.75),
        lerp(ctrlY, tipY, 0.75),
        tipX, tipY
      );
      endShape();
    }
  }
}

// ---------- Boat ----------
function drawBoat(bx, by) {
  push();
  translate(bx, by);
  rotate(sin(t * 0.6) * 0.02);

  const bw = 34;     // 2x size
  const bh = 5.2;

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

  stroke(BOAT_DARK);
  strokeWeight(1.4);
  noFill();
  beginShape();
  vertex(-bw * 0.82, 0.4);
  quadraticVertex(0, bh * 0.95, bw * 0.82, 0.4);
  endShape();

  stroke(BOAT_LITE);
  strokeWeight(0.7);
  beginShape();
  vertex(-bw * 0.78, -bh * 0.15);
  quadraticVertex(0, -bh * 0.4, bw * 0.78, -bh * 0.15);
  endShape();

  noStroke();
  fill(FIG_DARK);
  ellipse(-2.4, -bh * 0.9, 4.0, 6.8);
  fill(FIG_WARM);
  ellipse(-2.4, -bh * 1.25, 3.0, 3.0);

  pop();
}

// ---------- Final haze ----------
function drawHaze() {
  push();
  noStroke();
  for (let i = 0; i < 5; i++) {
    fill(255, 255, 245, 4);
    rect(0, 0, BASE_W, BASE_H * 0.22);
  }
  for (let y = 0; y < 60; y++) {
    const a = map(y, 0, 60, 0, 18);
    stroke(10, 30, 24, a);
    line(0, BASE_H - y, BASE_W, BASE_H - y);
  }
  pop();
}
