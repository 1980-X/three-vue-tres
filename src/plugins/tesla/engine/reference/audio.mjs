/**
 * Behavioral port of EngineV1's public home.js (version 4d98a15d4e17).
 * String tables decoded statically; numerical behavior retained.
 * Source and boundaries: docs/algorithm-notes.md.
 * No login, analytics, marketing, or page bootstrap code is included.
 */
function seededRandom(M) {
  let r = M >>> 0;
  return () => {
    r = r + 1831565813 >>> 0;
    let A = r;
    return A = Math.imul(A ^ A >>> 15, A | 1), A ^= A + Math.imul(A ^ A >>> 7, A | 61), ((A ^ A >>> 14) >>> 0) / 4294967296;
  };
}
function hashString(M) {
  let r = 2166136261;
  for (let A = 0; A < M.length; A++) r ^= M.charCodeAt(A), r = Math.imul(r, 16777619);
  return r >>> 0;
}
function biquadCoefficients(M, A, d, Z) {
  let T = 2 * Math.PI * Math.min(A, Z * 0.45) / Z,
    H = Math.cos(T),
    S = Math.sin(T) / (2 * d),
    G,
    y,
    g;
  M === "lowpass" ? (G = (1 - H) / 2, y = 1 - H, g = (1 - H) / 2) : M === "highpass" ? (G = (1 + H) / 2, y = -(1 + H), g = (1 + H) / 2) : (G = S, y = 0, g = -S);
  let E = 1 + S;
  return {
    'b0': G / E,
    'b1': y / E,
    'b2': g / E,
    'a1': -2 * H / E,
    'a2': (1 - S) / E
  };
}
function filterSignal(A, d, Z, T, H) {
  let {
      b0: S,
      b1: G,
      b2: y,
      a1: g,
      a2: E
    } = biquadCoefficients(d, Z, T, H),
    K = new Float32Array(A.length),
    D = 0,
    w = 0,
    L = 0,
    F = 0;
  for (let I = 0; I < 2; I++) for (let f0 = 0; f0 < A.length; f0++) {
    let f1 = A[f0],
      f2 = S * f1 + G * D + y * w - g * L - E * F;
    w = D, D = f1, F = L, L = f2, I === 1 && (K[f0] = f2);
  }
  return K;
}
function rms(M) {
  let r = 0;
  for (let A = 0; A < M.length; A++) r += M[A] * M[A];
  return Math.sqrt(r / M.length);
}
function normalizeSignal(M, r = 0.2, A = 0.95) {
  let d = rms(M) || 1,
    Z = r / d;
  for (let l = 0; l < M.length; l++) M[l] = A * Math.tanh(M[l] * Z / A);
  return M;
}
var yt = M => Math.min(1, Math.max(0, M));
var bt = {
  'idle': {
    'amp': 0.85,
    'rasp': 0.45,
    'noise': 0.45,
    'cutoff': 3200,
    'rms': 0.17
  },
  'on': {
    'amp': 1,
    'rasp': 1,
    'noise': 1,
    'cutoff': 6500,
    'rms': 0.22
  },
  'off': {
    'amp': 0.55,
    'rasp': 0.3,
    'noise': 0.65,
    'cutoff': 2600,
    'rms': 0.14
  }
};
function qt(M, A, d) {
  let Z = [];
  if (M === "crossplane-v8") {
    let l = "ABAABBBA";
    for (let T = 0; T < A; T++) {
      let H = l[T % l.length],
        h = l[(T + l.length - 1) % l.length],
        S = H === h ? 1.18 : 1;
      Z.push({
        'amp': (H === 'A' ? 1 : 0.8) * S * (0.95 + d() * 0.1),
        'offset': (d() - 0.5) * 0.12,
        'tone': H === 'A' ? 0.2 : 0.6
      });
    }
  } else {
    if (M === "flatplane") {
      for (let G = 0; G < A; G++) Z.push({
        'amp': (G % 2 ? 0.92 : 1) * (0.97 + d() * 0.06),
        'offset': (d() - 0.5) * 0.04,
        'tone': G % 2 ? 0.7 : 0.4
      });
    } else {
      for (let y = 0; y < A; y++) Z.push({
        'amp': 0.95 + d() * 0.1,
        'offset': (d() - 0.5) * 0.035,
        'tone': d()
      });
    }
  }
  return Z;
}
function zt({
  sampleRate: f0,
  config: f1,
  layer: f2,
  rng: f3
}) {
  let {
      engine: f4,
      synth: f5
    } = f1,
    f6 = Math.max(1, f4.cylinders),
    f7 = f2.rpm,
    f8 = bt[f2.load],
    f9 = yt((f7 - f4.idleRpm) / (f4.redlineRpm - f4.idleRpm)),
    ff = f5.roughness ?? 0.3,
    fN = f5.exhaustHz ?? 150,
    fo = 120 / f7,
    fq = Math.max(6, Math.round(1.6 / fo)),
    fM = Math.round(fq * fo * f0),
    fz = fq * f6,
    fV = fM / fz,
    fk = f0 / fV,
    fJ = qt(f5.style, f6, f3),
    fr = new Float32Array(fM),
    fA = new Float32Array(fM),
    fd = new Float32Array(fM),
    fW = 0.0004 * f0,
    fZ = Math.min(fV * 0.4, 0.0045 * f0),
    fa = 0.0022 * f0,
    fl = Math.min(Math.round(fV * 2.5), Math.round(0.03 * f0));
  for (let fU = 0; fU < fz; fU++) {
    let fb = fJ[fU % f6],
      fD = f2.load === "idle" ? 1.6 : f2.load === 'off' ? 1.2 : 0.7,
      fB = fb.amp * f8.amp * (1 + (f3() - 0.5) * ff * 0.5 * fD),
      fP = (fU + fb.offset + (f3() - 0.5) * ff * 0.04) * fV,
      fC = fN * (2.4 + fb.tone * 1.2) * (1 + f9 * 0.4),
      fw = f3() * Math.PI * 2;
    for (let fL = 0; fL < fl; fL++) {
      let fm = (Math.floor(fP) + fL + fM) % fM,
        fF = (1 - Math.exp(-fL / fW)) * Math.exp(-fL / fZ);
      fr[fm] += fB * fF, fd[fm] += fF, fA[fm] += fB * Math.exp(-fL / fa) * Math.sin(2 * Math.PI * fC * fL / f0 + fw);
    }
  }
  let fn = new Float32Array(fM);
  for (let fx = 0; fx < fM; fx++) fn[fx] = (f3() * 2 - 1) * (0.25 + Math.min(1.5, fd[fx]));
  let fT = filterSignal(fr, "lowpass", Math.min(900, Math.max(120, fk * 2.5)), 0.9, f0),
    fH = new Float32Array(fM);
  for (let fX = 0; fX < fM; fX++) fH[fX] = fr[fX] + 0.5 * fA[fX];
  let fc = filterSignal(fH, "bandpass", fN * (1 + f9 * 0.6), 2.2, f0),
    fh = filterSignal(fH, 'bandpass', fN * 2.7 * (1 + f9 * 0.3), 3.5, f0),
    fS = 2 + (f5.rasp ?? 0.3) * 6,
    fG = new Float32Array(fM);
  for (let fI = 0; fI < fM; fI++) fG[fI] = Math.tanh(fS * (fA[fI] + fr[fI] * 0.3));
  let fy = filterSignal(fG, "highpass", 650 + f9 * 600, 0.7, f0),
    fg = filterSignal(fn, "bandpass", 1600 + f9 * 1800, 0.8, f0),
    fE = fM / f0,
    fu = Math.round(f7 / 60 * 9 * fE) / fE,
    fO = (f5.whine ?? 0) * 0.12 * (0.3 + f9),
    fv = new Float32Array(fM),
    fs = (f5.body ?? 0.7) * 1.4,
    fi = (f5.rasp ?? 0.3) * f8.rasp * (0.5 + f9),
    fR = (f5.noise ?? 0.2) * f8.noise * 0.6;
  for (let fQ = 0; fQ < fM; fQ++) fv[fQ] = fs * fT[fQ] + 1.3 * fc[fQ] + 0.5 * fh[fQ] + fi * 0.35 * fy[fQ] + fR * fg[fQ] + fO * Math.sin(2 * Math.PI * fu * fQ / f0);
  let fK = f5.crackle ?? 0;
  if (f2.load === "off" && fK > 0) {
    let fj = Math.round(fK * fE * 3);
    for (let fp = 0; fp < fj; fp++) {
      let N0 = Math.floor(f3() * fM),
        N1 = 0.4 + f3() * 0.8,
        N2 = (0.003 + f3() * 0.004) * f0;
      for (let N3 = 0; N3 < N2 * 5; N3++) fv[(N0 + N3) % fM] += N1 * (f3() * 2 - 1) * Math.exp(-N3 / N2);
    }
  }
  let fY = f8.cutoff * (1 + f9 * 0.6);
  return normalizeSignal(filterSignal(filterSignal(fv, "lowpass", fY, 0.7, f0), 'highpass', 28, 0.7, f0), f8.rms);
}
function ot(M) {
  return M.source !== "samples" && (M.synth?.['style'] === 'turbine' || M.engine.cylinders === 0);
}
function q(M) {
  return 55 + M * 0.0135;
}
function jt({
  sampleRate: d,
  config: K,
  layer: D,
  rng: F
}) {
  let {
      engine: I,
      synth: f0
    } = K,
    f1 = D.rpm,
    f2 = bt[D.load],
    f3 = yt((f1 - I.idleRpm) / (I.redlineRpm - I.idleRpm)),
    f4 = 2,
    f5 = Math.round(f4 * d),
    f6 = fr => Math.max(1, Math.round(fr * f4)) / f4,
    f7 = new Float32Array(f5),
    f8 = q(f1),
    f9 = [{
      'f': f8,
      'a': 1
    }, {
      'f': f8 * 1.0045,
      'a': 0.7
    }, {
      'f': f8 * 1.5,
      'a': 0.45
    }, {
      'f': f8 * 2.012,
      'a': 0.35
    }],
    ff = D.load === 'on' ? 9 : D.load === "off" ? 4 : 6;
  for (let fr of f9) for (let fA = 1; fA <= ff; fA++) {
    let fd = f6(fr.f * fA);
    if (fd > d * 0.4) break;
    let fW = fr.a / Math.pow(fA, 1.25) * 0.25,
      fZ = F() * Math.PI * 2,
      fa = 2 * Math.PI * fd / d;
    for (let fl = 0; fl < f5; fl++) f7[fl] += fW * Math.sin(fa * fl + fZ);
  }
  let fN = (f0.whine ?? 0.5) * (0.12 + f3 * 0.25) * (D.load === "off" ? 0.6 : 1),
    fo = f6(f8 * 5.5),
    fq = f6(5.5);
  for (let fn = 0; fn < f5; fn++) {
    let fT = fn / d,
      fH = 1 + 0.0025 * Math.sin(2 * Math.PI * fq * fT);
    f7[fn] += fN * (Math.sin(2 * Math.PI * fo * fT * fH) + 0.3 * Math.sin(4 * Math.PI * fo * fT * fH));
  }
  let fM = new Float32Array(f5);
  for (let fc = 0; fc < f5; fc++) fM[fc] = F() * 2 - 1;
  let fz = filterSignal(fM, "bandpass", 1100 + f3 * 3200, 0.7, d),
    fV = (f0.noise ?? 0.2) * (D.load === "off" ? 1.3 : D.load === 'on' ? 1 : 0.5) * 0.9,
    fk = f6(3);
  for (let fh = 0; fh < f5; fh++) f7[fh] = (f7[fh] + fV * fz[fh]) * (1 + 0.03 * Math.sin(2 * Math.PI * fk * fh / d));
  let fJ = f2.cutoff * (1 + f3 * 0.5);
  return normalizeSignal(filterSignal(filterSignal(f7, 'lowpass', fJ, 0.7, d), "highpass", 35, 0.7, d), f2.rms);
}
function synthesizeLayer({
  sampleRate: M,
  profileKey: r,
  config: A,
  layer: d
}) {
  let Z = seededRandom(hashString(r + ':' + d.id + ':' + d.rpm)),
    l = {
      'sampleRate': M,
      'config': A,
      'layer': d,
      'rng': Z
    };
  return ot(A) ? jt(l) : zt(l);
}
function rt(M, A, d) {
  let Z = 0;
  for (let H = 0; H < M.length; H++) Z = Math.max(Z, Math.abs(M[H]));
  let l = Z > 0 ? d / Z : 0,
    T = Math.min(M.length, Math.round(0.006 * A));
  for (let c = 0; c < M.length; c++) {
    let h = M.length - 1 - c;
    M[c] *= l * (h < T ? h / T : 1);
  }
  return M;
}
function Wt(M, A) {
  let d = Math.round(0.04 * M),
    Z = new Float32Array(d),
    T = 2 + Math.floor(A() * 4),
    H = 0;
  for (let y = 0; y < T; y++) {
    let g = Math.round(H * M),
      E = y === 0 ? 1 : 0.35 + A() * 0.65,
      u = (0.0004 + A() * 0.0011) * M;
    for (let v = 0; g + v < d && v < u * 6; v++) Z[g + v] += E * (A() * 2 - 1) * Math.exp(-v / u);
    H += 0.0007 + A() * 0.0035;
  }
  let S = filterSignal(Z, "highpass", 1100 + A() * 900, 0.7, M),
    G = filterSignal(Z, 'bandpass', 2600 + A() * 2400, 1.2, M);
  for (let R = 0; R < d; R++) Z[R] = Math.tanh(2.2 * (S[R] + 0.8 * G[R]));
  return rt(filterSignal(Z, "lowpass", 9000, 0.7, M), M, 0.6);
}
function Jt(M, A, d) {
  let Z = Math.round(0.11 * M),
    T = new Float32Array(Z),
    H = Math.min(700, Math.max(160, d * (1.6 + A() * 1))),
    S = 0.01 + A() * 0.008,
    G = new Float32Array(Z);
  for (let E = 0; E < Z; E++) G[E] = (A() * 2 - 1) * Math.exp(-E / (0.022 * M));
  let y = filterSignal(G, "bandpass", 1300 + A() * 900, 0.8, M),
    g = A() * 0.3;
  for (let u = 0; u < Z; u++) {
    let v = u / M;
    g += 2 * Math.PI * H * (1 + 0.25 * Math.exp(-v / 0.006)) / M;
    let R = (A() * 2 - 1) * Math.exp(-v / 0.0005),
      K = Math.sin(g) * Math.exp(-v / S) * (1 - Math.exp(-v / 0.0003));
    T[u] = 0.9 * R + 1.1 * K + 0.9 * y[u];
  }
  for (let b = 0; b < Z; b++) T[b] = Math.tanh(2.5 * T[b]);
  return rt(filterSignal(T, 'highpass', 70, 0.7, M), M, 0.85);
}
function Xt(M, A, d) {
  let Z = Math.round(0.32 * M),
    T = new Float32Array(Z),
    H = (48 + A() * 26) * Math.pow(d / 110, 0.25),
    S = (0.05 + A() * 0.03) * M,
    G = new Float32Array(Z);
  for (let v = 0; v < Z; v++) G[v] = (A() * 2 - 1) * Math.exp(-v / S);
  let y = filterSignal(G, 'lowpass', 1800 + A() * 800, 0.7, M),
    g = filterSignal(G, "bandpass", Math.min(600, d * 2), 2, M),
    E = 0;
  for (let R = 0; R < Z; R++) {
    let K = R / M;
    E += 2 * Math.PI * H * (1 + 0.6 * Math.exp(-K / 0.014)) / M;
    let b = Math.sin(E) * Math.exp(-K / 0.07) * (1 - Math.exp(-K / 0.0008)),
      D = (A() * 2 - 1) * Math.exp(-K / 0.0012);
    T[R] = 1.3 * b + 0.9 * D + 1 * y[R] + 0.6 * g[R];
  }
  for (let w = 0; w < Z; w++) T[w] = Math.tanh(3 * T[w]);
  return rt(filterSignal(T, "highpass", 32, 0.7, M), M, 0.95);
}
function createAfterfireBank(M, r, A = '') {
  let d = seededRandom(hashString("afterfire:" + A + ':' + r.engine.cylinders + ':' + (r.synth?.["exhaustHz"] ?? ''))),
    Z = r.synth?.["exhaustHz"] ?? 150,
    l = {
      'crackle': [],
      'pop': [],
      'bang': []
    };
  for (let T = 0; T < 8; T++) l.crackle.push(Wt(M, d));
  for (let H = 0; H < 6; H++) l.pop.push(Jt(M, d, Z));
  for (let c = 0; c < 4; c++) l.bang.push(Xt(M, d, Z));
  return l;
}
function synthesizeShift(M, A) {
  let d = M,
    Z = Math.round(0.16 * d),
    T = seededRandom(hashString('shift:' + A.engine.cylinders)),
    H = new Float32Array(Z),
    S = A.synth?.["style"] === "turbine" || A.engine.cylinders === 0;
  for (let g = 0; g < Z; g++) {
    let E = g / d,
      u = Math.sin(2 * Math.PI * (S ? 90 : 62) * E) * Math.exp(-E / 0.035),
      v = g < 0.012 * d ? (T() * 2 - 1) * Math.exp(-E / 0.003) : 0;
    H[g] = 0.7 * u + 0.35 * v;
  }
  let G = filterSignal(H, 'lowpass', 2400, 0.7, d),
    y = Math.round(0.004 * d);
  for (let R = 0; R < y; R++) G[R] *= R / y, G[Z - 1 - R] *= R / y;
  return G;
}
var z = (M, r, A) => M < r ? r : M > A ? A : M;
var _t = (M, r, A) => {
  let d = z((A - M) / (r - M), 0, 1);
  return d * d * (3 - 2 * d);
};
var Yt = {
  'crackle': 0.006,
  'pop': 0.035,
  'bang': 0.13
};
function Tt(M) {
  let r = M?.['afterfire'];
  return !r || r.enabled === !1 || !(M.engine?.["cylinders"] > 0) || M.synth?.["style"] === 'turbine' ? !1 : (r.crackle ?? 0) + (r.pops ?? 0) + (r.bangs ?? 0) + (r.downshift ?? 0) + (r.limiter ?? 0) > 0;
}
var AfterfireScheduler = class {
  constructor(M, r = Math.random) {
    let {
      engine: A,
      afterfire: d = {}
    } = M;
    this.rng = r, this.cylinders = A.cylinders, this.idleRpm = A.idleRpm, this.redlineRpm = A.redlineRpm, this.cfg = {
      'crackle': d.crackle ?? 0,
      'pops': d.pops ?? 0,
      'bangs': d.bangs ?? 0,
      'downshift': d.downshift ?? 0,
      'limiter': d.limiter ?? 0,
      'minRpm': d.minRpm ?? Math.max(A.idleRpm * 2, 2000),
      'windowS': d.windowS ?? 2
    }, this.reset();
  }
  reset() {
    this.energy = 0, this.overrunS = 0, this.burstS = 0, this.peakThrottle = 0, this.wasOverrun = !1, this.wasBlipping = !1, this.rpm = this.idleRpm, this.intensity = 0, this.burst = 0, this.pending = [], this.next = 0, this.blockedUntil = 0, this.streak = 0;
  }
  update(M, A) {
    let d = this.cfg,
      Z = M.throttle ?? Math.max(0, M.load);
    this.rpm = M.rpm, this.peakThrottle = Math.max(Z, this.peakThrottle - A * 1.6);
    let T = _t(d.minRpm * 0.85, d.minRpm, M.rpm),
      H = 0.45 + 0.55 * z((M.rpm - d.minRpm) / Math.max(1, this.redlineRpm - d.minRpm), 0, 1),
      S = Z < 0.03 && M.load < -0.05;
    S && !this.wasOverrun && (this.overrunS = 0, this.energy = Math.max(this.energy, z(0.35 + 0.65 * Math.pow(this.peakThrottle, 0.7), 0, 1) * H)), this.wasOverrun = S;
    let G = M.shiftDir === "down" && M.load > 0.3;
    if (this.wasBlipping && !G && Z < 0.05 && d.downshift > 0 && M.rpm > d.minRpm * 0.85 && (this.burstS = 0.35 + 0.25 * d.downshift, this.overrunS = 0, this.energy = Math.max(this.energy, (0.6 + 0.4 * d.downshift) * H)), this.wasBlipping = G, M.shiftEvent === 'up' && Z > 0.7 && M.rpm > d.minRpm && d.pops + d.bangs > 0) {
      let E = this.rng() < d.bangs / (d.pops + d.bangs);
      this.rng() < 0.4 + 0.6 * Math.max(d.pops, d.bangs) && this.pending.push({
        'kind': E ? "bang" : "pop",
        'delay': 0.03,
        'strength': 0.9
      });
    }
    M.limiter && d.limiter > 0 && this.rng() < d.limiter * 8 * A && this.pending.push({
      'kind': this.rng() < d.bangs ? "bang" : 'pop',
      'delay': this.rng() * 0.04,
      'strength': 0.7 + 0.3 * d.limiter
    }), S && (this.overrunS += A), Z > 0.05 && (this.energy = 0, this.burstS = 0), this.burstS = Math.max(0, this.burstS - A), this.energy *= Math.exp(-A / 1.6);
    let y = 1 - _t(d.windowS * 0.45, d.windowS, this.overrunS),
      g = S || this.burstS > 0;
    return this.burst = this.burstS > 0 ? 1 : 0, this.intensity = g ? z(this.energy * y * T, 0, 1) : 0, {
      'intensity': this.intensity,
      'burst': this.burst > 0
    };
  }
  _pickKind(M) {
    let r = this.cfg,
      A = this.rng(),
      d = r.bangs * M * M * (this.burst ? 0.06 : 0.16),
      Z = r.pops * M * (this.burst ? 0.3 : 0.45);
    return A < d ? "bang" : A < d + Z ? "pop" : "crackle";
  }
  _event(M, r, A) {
    let d = M === "bang" ? 0.85 : M === 'pop' ? 0.6 : 0.35,
      Z = M === "crackle" ? 0.45 : 0.25;
    return this.blockedUntil = r + Yt[M], {
      'kind': M,
      'time': r,
      'gain': (d + this.rng() * Z) * (0.55 + 0.45 * A),
      'rate': 0.92 + this.rng() * 0.16,
      'variant': this.rng()
    };
  }
  schedule(M, r) {
    let A = [];
    for (let S of this.pending) {
      let G = Math.max(M + S.delay, this.blockedUntil);
      A.push(this._event(S.kind, G, S.strength));
    }
    this.pending.length = 0, this.next < M && (this.next = M + 0.005);
    let d = this.intensity;
    if (d <= 0.01) return this.next = Math.max(this.next, r), this.streak = 0, A;
    let Z = this.cfg,
      T = 120 / (Math.max(this.rpm, 300) * this.cylinders),
      H = 60 * (this.burst ? 0.55 + 0.45 * Z.downshift : Z.crackle) * d;
    for (; this.next < r;) {
      let y = this.next;
      if (this.next += T, y < this.blockedUntil) continue;
      let g = this.streak > 0 ? 2.6 : 1;
      if (this.rng() < Math.min(0.9, H * T * g)) {
        let E = this._pickKind(d);
        A.push(this._event(E, y + (this.rng() - 0.5) * T * 0.25, d)), this.streak = E === "crackle" ? 3 : 0;
      } else this.streak > 0 && this.streak--;
    }
    return A;
  }
};
var Qt = 0.12;
var Zt = 14;
var _ = (M, r, A) => M < r ? r : M > A ? A : M;
var te = (M, r, A) => {
  let d = _((A - M) / (r - M), 0, 1);
  return d * d * (3 - 2 * d);
};
var W = new Map();
var ht = new Map();
function ct(M, r) {
  let A = r + '@' + M.sampleRate,
    d = ht.get(A);
  return d || (d = fetch(r, {
    'credentials': "same-origin"
  }).then(Z => {
    if (!Z.ok) throw new Error("Sounddatei " + r + " konnte nicht geladen werden (" + Z.status + ').');
    return Z.arrayBuffer();
  }).then(Z => M.decodeAudioData(Z)), d.catch(() => ht.delete(A)), ht.set(A, d)), d;
}
function lt() {
  return window.AudioContext || window.webkitAudioContext || null;
}
var AudioEngine = class a extends EventTarget {
  constructor() {
    super(), this.ctx = null, this.nodes = null, this.layers = [], this.state = "idle", this.volume = 0.6, this.intensity = 0.6, this.shiftSounds = !0, this.config = null, this._onCtxState = () => this._emit("contextstate", {
      'state': this.ctx?.['state']
    });
  }
  _emit(M, r = {}) {
    this.dispatchEvent(new CustomEvent(M, {
      'detail': r
    }));
  }
  get contextState() {
    return this.ctx ? this.ctx.state : "none";
  }
  async start(M, r, { allowSuspended = false } = {}) {
    (this.state === 'running' || this.state === 'loading') && (await this.stop({
      'fadeS': 0.05
    }));
    let A = lt();
    if (!A) throw new Error("Web Audio wird von diesem Browser nicht unterstützt.");
    this.state = 'loading';
    let d = this._startToken = {};
    this.ctx = new A({
      'latencyHint': 'playback'
    }), this.ctx.addEventListener('statechange', this._onCtxState);
    let Z = this.ctx.resume().catch(() => {});
    this.config = M.config, this.applySettings(r, {
      'immediate': !0
    }), this._emit("contextstate", {
      'state': this.ctx.state
    });
    try {
      let l = await this._loadBuffers(M);
      if (d !== this._startToken || this.state !== "loading") return;
      this._buildGraph(l);
      // Display mode can keep GPS/model updates alive while the browser awaits a gesture.
      // The DSP graph and all numerical sound parameters are unchanged.
      if (!allowSuspended) await Z;
      if (d !== this._startToken || this.state !== "loading") return;
      this.state = "running", this._emit("running");
    } catch (T) {
      if (d !== this._startToken) return;
      throw this.state = "error", await this._teardown(), T;
    }
  }
  async _loadBuffers(M) {
    let {
        config: A
      } = M,
      d = this.ctx,
      Z = d.sampleRate,
      T = [],
      H = A.layers.length;
    if (A.source === "samples") {
      let S = 0,
        G = await Promise.all(A.layers.map(y => ct(d, y.file).then(g => (this._emit('progress', {
          'loaded': ++S,
          'total': H
        }), g))));
      A.layers.forEach((y, g) => T.push({
        'layer': y,
        'buffer': G[g]
      }));
    }
    for (let y = 0; A.source !== "samples" && y < H; y++) {
      let g = A.layers[y],
        E;
      {
        let u = M.slug + ':' + (M.updatedAt ?? '') + ':' + g.id + ':' + g.rpm + ':' + Z + ':' + JSON.stringify(A.synth),
          v = W.get(u);
        v || (await new Promise(R => setTimeout(R, 0)), v = synthesizeLayer({
          'sampleRate': Z,
          'profileKey': M.slug,
          'config': A,
          'layer': g
        }), W.set(u, v)), E = d.createBuffer(1, v.length, Z), E.copyToChannel(v, 0);
      }
      T.push({
        'layer': g,
        'buffer': E
      }), this._emit("progress", {
        'loaded': y + 1,
        'total': H
      });
    }
    return {
      'layers': T,
      'shiftBuffer': await this._loadShift(A),
      'afterfireBank': await this._loadAfterfire(M)
    };
  }
  async _loadShift(M) {
    let r = this.ctx;
    if (M.shiftSound?.["file"]) return ct(r, M.shiftSound.file);
    let A = synthesizeShift(r.sampleRate, M),
      d = r.createBuffer(1, A.length, r.sampleRate);
    return d.copyToChannel(A, 0), d;
  }
  async _loadAfterfire(M) {
    if (!Tt(M.config)) return null;
    let A = this.ctx,
      d = M.config.afterfire.files ?? {},
      Z = {};
    for (let T of ["crackle", "pop", "bang"]) d[T]?.["length"] && (Z[T] = await Promise.all(d[T].map(H => ct(A, H))));
    let l = ['crackle', "pop", "bang"].filter(H => !Z[H]);
    if (l.length) {
      let H = "afterfire:" + M.slug + ':' + (M.updatedAt ?? '') + ':' + A.sampleRate + ':' + JSON.stringify(M.config.afterfire) + ':' + JSON.stringify(M.config.synth ?? null) + ':' + M.config.engine.cylinders,
        h = W.get(H);
      h || (h = createAfterfireBank(A.sampleRate, M.config, M.slug), W.set(H, h));
      for (let S of l) Z[S] = h[S].map(G => {
        let y = A.createBuffer(1, G.length, A.sampleRate);
        return y.copyToChannel(G, 0), y;
      });
    }
    return Z;
  }
  _setupAfterfire(M) {
    this.nodes.afterfireBank = M, this.afterfire = M ? new AfterfireScheduler(this.config) : null, this._afLastT = null, this._afLastVariant = {};
  }
  _buildGraph({
    layers: A,
    shiftBuffer: d,
    afterfireBank: Z
  }) {
    let T = this.ctx,
      H = T.currentTime,
      S = this.config.mix || {},
      G = T.createGain(),
      y = T.createBiquadFilter();
    y.type = 'lowpass', y.Q.value = 0.6, y.frequency.value = S.lowpassMinHz ?? 1500;
    let g = T.createDynamicsCompressor();
    g.threshold.value = -16, g.knee.value = 10, g.ratio.value = 5, g.attack.value = 0.005, g.release.value = 0.25;
    let E = T.createDynamicsCompressor();
    E.threshold.value = -3, E.knee.value = 0, E.ratio.value = 20, E.attack.value = 0.001, E.release.value = 0.1;
    let v = T.createGain();
    v.gain.setValueAtTime(0, H);
    let K = T.createGain();
    K.gain.value = 0.5;
    let b = T.createGain();
    b.gain.value = this.config.afterfire?.["level"] ?? 0.8;
    let D = T.createGain(),
      w = T.createAnalyser();
    w.fftSize = 512, G.connect(y).connect(D).connect(g).connect(E).connect(v), K.connect(g), b.connect(g), v.connect(w), v.connect(T.destination);
    let L = H + 0.05;
    this.layers = this._createLayers(A, G, L, this.config.engine.idleRpm, !0), this.nodes = {
      'bus': G,
      'tone': y,
      'duck': D,
      'comp': g,
      'limiter': E,
      'master': v,
      'fx': K,
      'afterfire': b,
      'analyser': w,
      'shiftBuffer': d
    }, this._afVoices = 0, this._setupAfterfire(Z), this._groups = this._buildGroups(), v.gain.setValueAtTime(0, L), v.gain.linearRampToValueAtTime(this._masterTarget(), L + 1.2);
  }
  _createLayers(M, r, A, d, Z) {
    let l = this.ctx;
    return M.map(({
      layer: T,
      buffer: H
    }) => {
      let S = l.createGain();
      S.gain.value = Z && T.load === "idle" ? 0.8 : 0, S.connect(r);
      let G = _(d / T.rpm, 0.3, 3),
        y = H.duration * (T.rpm * 7 % 13) / 13,
        g = {
          'layer': T,
          'buffer': H,
          'gain': S,
          'voices': [],
          'rate': G,
          'pos': y,
          'posAt': A,
          'nextGrain': A + 0.4 + Math.random() * 0.7
        };
      return g.cycleS = 120 / T.rpm, g.voices.push(this._startVoice(g, A, y, G, 0)), g;
    });
  }
  _startVoice(M, A, d, Z, l) {
    let T = this.ctx,
      H = T.createBufferSource();
    H.buffer = M.buffer, H.loop = !0, H.playbackRate.value = Z;
    let S = T.createGain();
    S.gain.setValueAtTime(l ? 0 : 1, A), l && S.gain.linearRampToValueAtTime(1, A + l), H.connect(S).connect(M.gain), H.start(A, d);
    let G = {
      'src': H,
      'xfade': S
    };
    return H.onended = () => {
      H.disconnect(), S.disconnect();
      let y = M.voices.indexOf(G);
      y >= 0 && M.voices.splice(y, 1);
    }, G;
  }
  _regrain(M, A) {
    let d = A + 0.02,
      Z = 0.08,
      l = M.buffer.duration,
      T = (M.pos + (d - M.posAt) * M.rate) % l,
      H = Math.max(1, Math.floor(l / M.cycleS)),
      S = (Math.floor(Math.random() * H) * M.cycleS + T % M.cycleS) % l;
    for (let G of M.voices) {
      G.xfade.gain.cancelScheduledValues(d), G.xfade.gain.setValueAtTime(G.xfade.gain.value, d), G.xfade.gain.linearRampToValueAtTime(0, d + Z);
      try {
        G.src.stop(d + Z + 0.02);
      } catch {}
    }
    M.voices.push(this._startVoice(M, d, S, M.rate, Z)), M.pos = S, M.posAt = d, M.nextGrain = d + 0.4 + Math.random() * 0.7;
  }
  static _stopLayer(M) {
    for (let {
      src: r,
      xfade: A
    } of [...M.voices]) {
      try {
        r.stop();
      } catch {}
      r.disconnect(), A.disconnect();
    }
    M.voices = [], M.gain.disconnect();
  }
  async switchProfile(M) {
    if (this.state !== "running" || !this.nodes) throw new Error("Audio läuft nicht.");
    let A = this._switchToken = {},
      d = await this._loadBuffers(M);
    if (A !== this._switchToken || this.state !== "running" || !this.nodes) return !1;
    let Z = this.ctx,
      l = Z.currentTime,
      T = {
        'layers': this.layers,
        'bus': this.nodes.bus
      },
      H = Z.createGain();
    H.gain.value = 0, H.connect(this.nodes.tone);
    let S = this._lastState?.['rpm'] ?? M.config.engine.idleRpm,
      G = this._createLayers(d.layers, H, l + 0.02, S, !1);
    return this.config = M.config, this.layers = G, this.nodes.bus = H, this.nodes.shiftBuffer = d.shiftBuffer, this.nodes.afterfire.gain.setTargetAtTime(M.config.afterfire?.["level"] ?? 0.8, l, 0.1), this._setupAfterfire(d.afterfireBank), this._groups = this._buildGroups(), this._lastState && this.update({
      ...this._lastState,
      'shiftEvent': null
    }), T.bus.gain.cancelScheduledValues(l), T.bus.gain.setValueAtTime(T.bus.gain.value, l), T.bus.gain.setTargetAtTime(0, l, 0.18), H.gain.setTargetAtTime(1, l + 0.05, 0.18), this.nodes.master.gain.setTargetAtTime(this._masterTarget(), l, 0.25), setTimeout(() => {
      for (let y of T.layers) a._stopLayer(y);
      T.bus.disconnect();
    }, 1500), !0;
  }
  _buildGroups() {
    let M = this.layers.find(Z => Z.layer.load === 'idle'),
      r = Z => this.layers.filter(l => l.layer.load === Z).sort((l, T) => l.layer.rpm - T.layer.rpm),
      A = r('on'),
      d = r('off');
    return {
      'idle': M,
      'on': [M, ...A],
      'off': d.length ? [M, ...d] : [M, ...A]
    };
  }
  static rpmWeights(M, A) {
    let d = new Map();
    if (A <= M[0].layer.rpm) return d.set(M[0], 1), d;
    for (let Z = 1; Z < M.length; Z++) {
      let l = M[Z - 1],
        T = M[Z];
      if (A <= T.layer.rpm) {
        let H = Math.log(A / l.layer.rpm) / Math.log(T.layer.rpm / l.layer.rpm);
        return d.set(l, Math.cos(H * Math.PI / 2)), d.set(T, Math.sin(H * Math.PI / 2)), d;
      }
    }
    return d.set(M[M.length - 1], 1), d;
  }
  _masterTarget() {
    let M = this.config?.["mix"]?.["masterGain"] ?? 0.8;
    return _(Math.pow(this.volume, 1.6) * M, 0, 1);
  }
  applySettings({
    volume: M,
    intensity: r,
    shiftSounds: A
  } = {}, {
    immediate: d = !1
  } = {}) {
    Number.isFinite(M) && (this.volume = _(M / 100, 0, 1)), Number.isFinite(r) && (this.intensity = _(r / 100, 0, 1)), typeof A == "boolean" && (this.shiftSounds = A), !d && this.nodes && this.state === 'running' && this.nodes.master.gain.setTargetAtTime(this._masterTarget(), this.ctx.currentTime, 0.15);
  }
  update(d) {
    if (this.state !== "running" || !this.nodes) return;
    this._lastState = d;
    let Z = this.ctx.currentTime,
      {
        engine: H,
        mix: G = {}
      } = this.config,
      K = _(d.rpm, H.idleRpm * 0.9, (H.limiterRpm ?? H.redlineRpm) * 1.02),
      D = _(d.load, -1, 1),
      F = this.intensity,
      I = Math.max(0, D),
      f0 = _((K - H.idleRpm) / (H.redlineRpm - H.idleRpm), 0, 1),
      f1 = te(-0.3, 0.4, D),
      f2 = Math.sin(f1 * Math.PI / 2),
      f3 = Math.cos(f1 * Math.PI / 2) * (G.overrunGain ?? 0.75),
      f4 = 0.2 + 0.55 * F,
      f5 = (1 - f4 + f4 * Math.pow(I, 0.7)) * (0.78 + 0.22 * f0),
      f6 = new Map();
    for (let [fN, fo] of a.rpmWeights(this._groups.on, K)) f6.set(fN, (f6.get(fN) || 0) + fo * f2);
    for (let [fq, fM] of a.rpmWeights(this._groups.off, K)) f6.set(fq, (f6.get(fq) || 0) + fM * f3);
    this._drift = _((this._drift ?? 0) * 0.96 + (Math.random() - 0.5) * 0.0012, -0.003, 0.003);
    let f7 = ot(this.config);
    for (let fz of this.layers) {
      let fV = _(f6.get(fz) || 0, 0, 1.2),
        fk = _(fV * f5 * (fz.layer.gain ?? 1), 0, 1.5);
      fz.gain.gain.setTargetAtTime(fk, Z, 0.06);
      let fJ = f7 ? q(K) / q(fz.layer.rpm) : K / fz.layer.rpm,
        fr = _(fJ * (1 + this._drift), 0.3, 3);
      fz.pos = (fz.pos + (Z - fz.posAt) * fz.rate) % fz.buffer.duration, fz.posAt = Z, fz.rate = fr;
      for (let fA of fz.voices) fA.src.playbackRate.setTargetAtTime(fr, Z, 0.04);
      fk > 0.005 && Z >= fz.nextGrain && this._regrain(fz, Z);
    }
    let f8 = G.lowpassMinHz ?? 1200,
      f9 = G.lowpassMaxHz ?? 7000,
      ff = _(0.2 + 0.35 * f0 + 0.45 * I * (0.4 + 0.6 * F), 0, 1);
    this.nodes.tone.frequency.setTargetAtTime(f8 * Math.pow(f9 / f8, ff), Z, 0.08), d.shiftEvent && this.shiftSounds && this._playShift(d.shiftEvent), this.afterfire && this._updateAfterfire(d, Z);
  }
  _updateAfterfire(M, r) {
    let A = this._afLastT == null ? 0.05 : _(r - this._afLastT, 0, 0.5);
    this._afLastT = r, this.afterfire.update(M, A);
    for (let d of this.afterfire.schedule(r + 0.01, r + Qt)) this._playAfterfire(d);
  }
  _playAfterfire(M) {
    if (this._afVoices >= Zt && M.kind === 'crackle') return;
    let A = this.nodes.afterfireBank?.[M.kind];
    if (!A?.["length"]) return;
    let d = this.ctx,
      Z = Math.max(M.time, d.currentTime),
      l = d.createBufferSource(),
      T = Math.floor(M.variant * A.length) % A.length;
    A.length > 1 && T === this._afLastVariant[M.kind] && (T = (T + 1) % A.length), this._afLastVariant[M.kind] = T, l.buffer = A[T], l.playbackRate.value = M.rate;
    let H = d.createGain();
    if (H.gain.value = M.gain * (0.45 + 0.75 * this.intensity), l.connect(H).connect(this.nodes.afterfire), this._afVoices++, l.onended = () => {
      this._afVoices--, l.disconnect(), H.disconnect();
    }, l.start(Z), M.kind !== "crackle") {
      let h = this.nodes.duck.gain;
      h.cancelScheduledValues(Z), h.setValueAtTime(1, Z), h.linearRampToValueAtTime(M.kind === 'bang' ? 0.6 : 0.82, Z + 0.004), h.setTargetAtTime(1, Z + 0.03, 0.05);
    }
  }
  _playShift(M) {
    let r = this.ctx,
      A = r.createBufferSource();
    A.buffer = this.nodes.shiftBuffer;
    let d = this.config?.["shiftSound"];
    A.playbackRate.value = d || M === 'up' ? 1 : 1.15;
    let Z = r.createGain();
    Z.gain.value = d ? (d.gain ?? 1) * (0.5 + 0.5 * this.intensity) : 0.35 + 0.4 * this.intensity, A.connect(Z).connect(this.nodes.fx), A.onended = () => {
      A.disconnect(), Z.disconnect();
    }, A.start();
  }
  level() {
    if (!this.nodes) return 0;
    let M = new Uint8Array(this.nodes.analyser.fftSize);
    this.nodes.analyser.getByteTimeDomainData(M);
    let r = 0;
    for (let A = 0; A < M.length; A++) r = Math.max(r, Math.abs(M[A] - 128));
    return r / 128;
  }
  async resume() {
    if (!this.ctx || this.ctx.state === "closed") return !1;
    try {
      await this.ctx.resume();
    } catch {
      return !1;
    }
    return this.ctx.state === "running";
  }
  async stop({
    fadeS: M = 0.6
  } = {}) {
    if (this._startToken = null, this._switchToken = null, this._lastState = null, !this.ctx) return;
    let r = this.state === 'running',
      A = this._detach();
    if (this.state = 'idle', this._emit('contextstate', {
      'state': "none"
    }), r && A.nodes && A.ctx.state === "running") {
      let d = A.nodes.master.gain,
        Z = A.ctx.currentTime;
      d.cancelScheduledValues(Z), d.setValueAtTime(d.value, Z), d.linearRampToValueAtTime(0, Z + M), await new Promise(l => setTimeout(l, M * 1000 + 60));
    }
    await a._release(A), this._emit('stopped');
  }
  _detach() {
    let M = {
      'ctx': this.ctx,
      'nodes': this.nodes,
      'layers': this.layers
    };
    return this.ctx && this.ctx.removeEventListener("statechange", this._onCtxState), this.ctx = null, this.nodes = null, this.layers = [], this.afterfire = null, M;
  }
  async _teardown() {
    await a._release(this._detach()), this._emit("contextstate", {
      'state': 'none'
    });
  }
  static async _release({
    ctx: M,
    nodes: r,
    layers: A
  }) {
    for (let d of A) a._stopLayer(d);
    if (r) {
      for (let Z of Object.values(r)) Z?.['disconnect'] && Z.disconnect();
    }
    M && M.state !== 'closed' && (await M.close().catch(() => {}));
  }
};

export { AudioEngine, synthesizeLayer, synthesizeShift };
