/*
  Reed field & a small boat, perspective view.
  Layered far/mid/near reeds rooted vertically with wind-bending tips.
  All blades sample a coherent wave field so neighbours bend together —
  bent blades pull their colour toward a pale silver-green, producing
  visible "wheat wave" bands drifting across the surface.
*/

// ---------- Canvas ----------
const BASE_W = 390;
const BASE_H = 844;

// ---------- Palette ----------
// Atmospheric perspective: hazy at the top, deep field at the bottom.
const SKY_TOP    = "#F5F7EE";
const SKY_MIST   = "#DDEBDD";
const SKY_TEAL   = "#A9D6BA";
const MID_GREEN  = "#4F9A68";
const DEEP_GREEN = "#1F5F46";
const SHADE_GRN  = "#163F34";

// Reed palette buckets (kept as hex; converted to rgb at build time).
const GRASS_DARK = ["#174633", "#1D5B42", "#246B4A", "#2F7A55"];
const GRASS_MID  = ["#4F9A68", "#68B17D", "#7FC493", "#91CFA3"];
const GRASS_LITE = ["#B9E0C4", "#D5EED8", "#E6F4E5", "#F2F7EC"];
const GRASS_COOL = ["#8ECDB2", "#A9DCC4", "#C8E8D8"];

// Colour the blade pulls toward when laid over by the wind — gives the
// silvery wave-crest sheen.
const BENT_R = 222;
const BENT_G = 236;
const BENT_B = 178;

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
let boat = { x: 0, y: 0, vx: 0 };
let t = 0;
let scaleFactor = 1;
let seed;

// Per-layer reed counts — much denser than the previous version.
const FAR_COUNT  = 5500;
const MID_COUNT  = 7000;
const NEAR_COUNT = 2000;
// Total ≈ 14,500.

// Coarse noise grid for the gust component (sampled once per frame).
const NF_COLS = 48;
const NF_ROWS = 100;
let noiseField;

// Clearing semi-axes.
const ELL_W = 58;   // → 116 wide
const ELL_H = 20;   // → 40 tall

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

  const stops = [
    { p: 0.00, c: color(SKY_TOP) },
    { p: 0.20, c: color(SKY_MIST) },
    { p: 0.42, c: color(SKY_TEAL) },
    { p: 0.66, c: color(MID_GREEN) },
    { p: 0.88, c: color(DEEP_GREEN) },
    { p: 1.00, c: color(SHADE_GRN) },
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

// ---------- Reeds ----------
function buildGrasses() {
  grasses = [];

  for (let i = 0; i < FAR_COUNT; i++) {
    const x = random(-20, BASE_W + 20);
    const y = random(BASE_H * 0.20, BASE_H * 0.62);
    grasses.push(makeGrass(x, y, 0));
  }
  for (let i = 0; i < MID_COUNT; i++) {
    const x = random(-30, BASE_W + 30);
    const y = random(BASE_H * 0.32, BASE_H * 0.96);
    grasses.push(makeGrass(x, y, 1));
  }
  for (let i = 0; i < NEAR_COUNT; i++) {
    const x = random(-40, BASE_W + 40);
    const y = random(BASE_H * 0.78, BASE_H + 30);
    grasses.push(makeGrass(x, y, 2));
  }

  grasses.sort((a, b) => (a.depth - b.depth) || (a.y - b.y));
}

function makeGrass(x, y, depth) {
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

  return {
    x, y,
    depth,
    len,
    width: random(wMin, wMax),
    // Store as raw rgb so the inner loop can lerp toward BENT without
    // constructing colour objects.
    baseR: red(c),
    baseG: green(c),
    baseB: blue(c),
    alpha: alphaVal,
    baseLean: random(-0.5, 0.5),
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

// Coherent wave field — adjacent reeds see nearly identical values, so
// gust patches read as visible bands.
function waveBend(x, y) {
  const w1 = sin(x * 0.020 + y * 0.012 - t * 0.85);
  const w2 = sin(x * 0.038 - y * 0.024 + t * 1.30) * 0.45;
  const n  = fieldNoise(x, y);
  const breath = sin(t * 0.45) * 0.18;
  let v = w1 * 0.55 + w2 + n * 1.35 + breath;
  if (v >  1.2) v =  1.2;
  if (v < -1.2) v = -1.2;
  return v;
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

    // Vertical clip: blades rooted below the clearing within its x range
    // get their length capped so the tip stops at the rim.
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

    // Tip excursion — proportional to length so longer blades whip
    // further. Dampened near the clearing rim so reeds don't blow into
    // the boat at peak gust.
    const len = effLen * (0.55 + 0.45 * edgeFade);
    const w   = g.width * (0.6 + 0.4 * edgeFade);
    const bendScale = 0.5 + 0.5 * edgeFade;
    const tipDx = W * len * 0.62 * bendScale + g.baseLean * 3;
    const droopY = bendMag * bendMag * len * 0.20;

    const tipX = x0 + tipDx;
    const tipY = y0 - len + droopY;
    const ctrlX = x0 + tipDx * 0.38;
    const ctrlY = y0 - len * 0.58 + droopY * 0.45;

    // Wave-band colour: lerp the blade's base colour toward the silver
    // BENT colour as bend magnitude grows. Same gust patch → same shift,
    // so coherent gust regions appear as bright streaks.
    const palePull = bendMag * 0.55;
    const r  = g.baseR + (BENT_R - g.baseR) * palePull;
    const gg = g.baseG + (BENT_G - g.baseG) * palePull;
    const b  = g.baseB + (BENT_B - g.baseB) * palePull;
    const a  = g.alpha * edgeFade;
    if (a < 3) continue;

    stroke(r, gg, b, a);
    strokeWeight(w);
    beginShape();
    vertex(x0, y0);
    quadraticVertex(ctrlX, ctrlY, tipX, tipY);
    endShape();

    // Tip taper on the thicker blades — finer overlay with a stronger
    // pale pull (the tip is where the sheen reads strongest).
    if (w > 0.50) {
      const sX = lerp(x0, ctrlX, 0.55);
      const sY = lerp(y0, ctrlY, 0.55);
      const tipPale = bendMag * 0.85;
      const tr  = g.baseR + (BENT_R - g.baseR) * tipPale;
      const tgg = g.baseG + (BENT_G - g.baseG) * tipPale;
      const tb  = g.baseB + (BENT_B - g.baseB) * tipPale;
      stroke(tr, tgg, tb, a * 0.80);
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
  }
}

// ---------- Boat ----------
function drawBoat(bx, by) {
  push();
  translate(bx, by);
  rotate(sin(t * 0.6) * 0.02);

  const bw = 17;
  const bh = 2.6;

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
  strokeWeight(0.7);
  noFill();
  beginShape();
  vertex(-bw * 0.82, 0.2);
  quadraticVertex(0, bh * 0.95, bw * 0.82, 0.2);
  endShape();

  stroke(BOAT_LITE);
  strokeWeight(0.35);
  beginShape();
  vertex(-bw * 0.78, -bh * 0.15);
  quadraticVertex(0, -bh * 0.4, bw * 0.78, -bh * 0.15);
  endShape();

  noStroke();
  fill(FIG_DARK);
  ellipse(-1.2, -bh * 0.9, 2.0, 3.4);
  fill(FIG_WARM);
  ellipse(-1.2, -bh * 1.25, 1.5, 1.5);

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
