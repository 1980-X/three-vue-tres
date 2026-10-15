/**
 * Behavioral port of EngineV1's public home.js (version 4d98a15d4e17).
 * String tables decoded statically; numerical behavior retained.
 * Source and boundaries: docs/algorithm-notes.md.
 * No login, analytics, marketing, or page bootstrap code is included.
 */
function kmhToMps(M) {
  return M / 3.6;
}
function clamp(M, r, A) {
  return M < r ? r : M > A ? A : M;
}
function lerp(M, r, A) {
  return M + (r - M) * A;
}
function smoothingAlpha(M, r) {
  return r <= 0 ? 1 : 1 - Math.exp(-Math.max(0, M) / r);
}
var DEFAULT_VEHICLE = Object.freeze({
  'powerKw': 300,
  'massKg': 1800,
  'topSpeedKmh': 250
});
var vt = 0.12;
var se = 5.8;
var ie = 0.85;
var At = 0.5;
var Et = 9;
var VehicleModel = class {
  constructor(M = {}) {
    let r = {
      ...DEFAULT_VEHICLE,
      ...M
    };
    this.massKg = r.massKg, this.wheelPowerW = r.powerKw * 1000 * ie, this.topSpeedMps = r.topSpeedKmh / 3.6;
    let A = this.wheelPowerW / (this.massKg * this.topSpeedMps);
    this.aeroCoeff = Math.max(0.00001, (A - vt) / this.topSpeedMps ** 2);
  }
  resistance(M) {
    return M > 0.05 ? vt + this.aeroCoeff * M * M : 0;
  }
  maxDrive(M) {
    return Math.min(se, this.wheelPowerW / (this.massKg * Math.max(M, 2)));
  }
  engineBraking(M, r) {
    return r < 0.03 && M > 1 ? At * Math.min(1, M / 5) : 0;
  }
  acceleration(M, r, A, d = 1) {
    let Z = r * this.maxDrive(M) * d - this.resistance(M) - this.engineBraking(M, r) - (M > 0 ? A * Et : 0);
    return M <= 0 && Z < 0 && (Z = 0), Z;
  }
  estimatePedals(M, r) {
    if (M < 0.5 && Math.abs(r) < 0.3) return {
      'throttle': 0,
      'brake': 0
    };
    let A = this.resistance(M),
      d = clamp((r + A) / this.maxDrive(M), 0, 1);
    M >= 0.5 && r > -0.1 && (d = Math.max(d, 0.06));
    let Z = A + At * Math.min(1, M / 5),
      l = clamp((-r - Z) / (Et * 0.7), 0, 1);
    return {
      'throttle': d > 0.04 ? d : 0,
      'brake': l
    };
  }
};
var PowertrainModel = class {
  constructor(M) {
    let {
      engine: r,
      gearbox: A
    } = M;
    this.idleRpm = r.idleRpm, this.redlineRpm = r.redlineRpm, this.limiterRpm = r.limiterRpm ?? r.redlineRpm, this.ratios = A.ratios, this.finalDrive = A.finalDrive, this.tire = A.tireCircumferenceM, this.wotUpshiftRpm = Math.min(A.upshiftRpm, this.limiterRpm), this.coastDownshiftRpm = A.downshiftRpm, this.cruiseUpshiftRpm = clamp(A.cruiseUpshiftRpm ?? Math.max(this.coastDownshiftRpm * 1.5, this.idleRpm * 2.4), this.coastDownshiftRpm * 1.25, this.wotUpshiftRpm * 0.8), this.coastShiftRpm = lerp(this.coastDownshiftRpm, this.cruiseUpshiftRpm, 0.6), this.shiftTimeS = Math.max(0.08, (A.shiftTimeMs ?? 250) / 1000), this.launchRpm = A.launchRpm ?? Math.min(this.idleRpm * 2.5, this.wotUpshiftRpm * 0.5), this.vehicle = new VehicleModel(M.vehicle), this.maxRpmRisePerS = 9000, this.maxRpmFallPerS = 16000, this.reset();
  }
  reset() {
    this.gear = 0, this.rpm = this.idleRpm, this.throttle = 0, this.brake = 0, this.liftHold = 0, this.pressing = !1, this.load = 0, this.shift = null, this.sinceShift = 1 / 0, this.time = 0;
  }
  adopt(M, A = 0, d = 0) {
    this.reset();
    let Z = Math.max(0, M);
    this.throttle = clamp(A, 0, 1), this.brake = clamp(d, 0, 1);
    let T = this.ratios.length - 1;
    if (Z >= 0.5 && T > 0) {
      let H = this.coastDownshiftRpm * 1.2,
        S = this.upshiftPoint(this.throttle) * 0.97,
        G = [];
      for (let y = 0; y <= T; y++) {
        let g = this.rpmInGear(Z, y);
        g >= H && g <= S && G.push(y);
      }
      if (G.length) this.gear = this.throttle > 0.5 ? G[0] : G[G.length - 1];else {
        let E = 0;
        for (; E < T && this.rpmInGear(Z, E) > this.wotUpshiftRpm;) E++;
        this.gear = E;
      }
    }
    this.rpm = clamp(Math.max(this.rpmInGear(Z, this.gear), this.idleRpm), this.idleRpm, this.limiterRpm), this.sinceShift = 0;
  }
  rpmInGear(M, r) {
    return M / this.tire * 60 * this.ratios[r] * this.finalDrive;
  }
  speedAtRpm(M, r) {
    return M / 60 / (this.ratios[r] * this.finalDrive) * this.tire;
  }
  upshiftPoint(M) {
    return lerp(this.cruiseUpshiftRpm, this.wotUpshiftRpm, Math.pow(clamp(M, 0, 1), 1.3));
  }
  _startShift(M, r) {
    let A = Math.abs(M - this.gear);
    return this.shift = {
      'dir': r,
      'from': this.rpm,
      't': 0,
      'dur': (r === "down" ? Math.max(0.35, this.shiftTimeS * 1.2) : Math.max(0.3, this.shiftTimeS)) * (A > 1 ? 1.25 : 1)
    }, this.gear = M, this.sinceShift = 0, r;
  }
  _selectGear(M) {
    let A = this.ratios.length - 1;
    if (A === 0) return null;
    if (M < 0.5) return this.gear = 0, null;
    let d = this.gear,
      Z = this.throttle,
      T = this.brake,
      H = this.rpmInGear(M, d);
    if (Z >= 0.6 && d > 0 && this.sinceShift >= 0.8) {
      let S = lerp(0.5, 0.7, (Z - 0.6) / 0.4) * this.wotUpshiftRpm;
      if (H < S) {
        let G = 0.8 * this.wotUpshiftRpm,
          y = d,
          g = E => this.speedAtRpm(this.wotUpshiftRpm, E) - M >= 8;
        for (let E = d - 1; E >= 0 && this.rpmInGear(M, E) <= G && g(E); E--) y = E;
        if (y < d) return this._startShift(y, "down");
      }
    }
    if (d < A && this.sinceShift >= (Z > 0.6 ? 0.9 : 1.5) && (Z > 0.03 && this.liftHold <= 0 && (!this.pressing || H >= 0.97 * this.wotUpshiftRpm) || H >= 0.99 * this.limiterRpm) && H >= this.upshiftPoint(Z) && this.rpmInGear(M, d + 1) >= this.coastDownshiftRpm * 1.2) return this._startShift(d + 1, 'up');
    if (d > 0 && this.sinceShift >= lerp(1.2, 1, T)) {
      let u = this.rpmInGear(M, d - 1);
      if (Z < 0.05) {
        let v = this.coastShiftRpm + T * 0.25 * (this.wotUpshiftRpm - this.coastShiftRpm);
        if (H < v && u <= 0.86 * this.redlineRpm) return this._startShift(d - 1, "down");
      } else {
        if (H < this.coastDownshiftRpm * 0.95 && u < this.upshiftPoint(Z) * 0.9) return this._startShift(d - 1, "down");
      }
    }
    return null;
  }
  update(A, d, Z, T = null) {
    let H = clamp(Z, 0, 0.5),
      G = Math.max(0, A);
    this.time += H, this.sinceShift += H;
    let E = T ?? this.vehicle.estimatePedals(G, d),
      K = T ? 0.06 : this.gpsPedalTau ?? 0.35;
    this.liftHold = clamp(E.throttle, 0, 1) < this.throttle - 0.05 ? 0.6 : Math.max(0, this.liftHold - H), this.pressing = !!T && clamp(E.throttle, 0, 1) > this.throttle + 0.05, this.throttle += smoothingAlpha(H, K) * (clamp(E.throttle, 0, 1) - this.throttle), this.brake += smoothingAlpha(H, K) * (clamp(E.brake, 0, 1) - this.brake), this.throttle < 0.005 && (this.throttle = 0);
    let D = this.shift ? null : this._selectGear(G),
      w = this.gear === 0 && this.throttle < 0.03 && G < 4.2 && (this.brake > 0.05 || d < -0.3),
      L = w ? 0 : this.rpmInGear(G, this.gear),
      F = 0;
    if (this.gear === 0 && !w) {
      let f4 = G > 0.3 ? this.idleRpm * (1 + 0.45 * clamp(G / 4, 0, 1)) : this.idleRpm,
        f5 = clamp(1 - G / 14, 0, 1);
      F = f4 + (this.launchRpm - this.idleRpm) * Math.pow(this.throttle, 0.5) * f5;
    }
    let I = Math.min(Math.max(L, F, this.idleRpm), this.limiterRpm),
      f0 = 0;
    this.throttle > 0.03 ? f0 = this.throttle : G > 1 && this.rpm > this.idleRpm * 1.2 && (f0 = -(0.45 + 0.55 * this.brake));
    let f1 = !1,
      f2 = null,
      f3 = 0.07;
    if (this.shift) {
      let f6 = this.shift;
      f6.t += H;
      let f7 = clamp(f6.t / f6.dur, 0, 1);
      if (f2 = f6.dir, f6.dir === 'up') {
        let f8 = clamp((f7 - 0.3) / 0.7, 0, 1);
        this.rpm = lerp(f6.from, I, f8 * f8 * (3 - 2 * f8)), this.throttle > 0.03 && (f0 = f7 < 0.75 ? -0.35 : lerp(-0.35, f0, (f7 - 0.75) / 0.25));
      } else {
        let f9 = Math.min(I * 1.04, this.limiterRpm),
          ff = 1 - Math.pow(1 - Math.min(1, f7 / 0.85), 3);
        this.rpm = f7 < 0.85 ? lerp(f6.from, f9, ff) : lerp(f9, I, (f7 - 0.85) / 0.15), f7 < 0.6 && (f0 = Math.max(f0, 0.55), f3 = 0.025);
      }
      f7 >= 1 && (this.shift = null);
    } else {
      let fN = smoothingAlpha(H, 0.06) * (I - this.rpm);
      if (this.rpm += clamp(fN, -this.maxRpmFallPerS * H, this.maxRpmRisePerS * H), I >= this.limiterRpm - 1 && this.throttle > 0.03) {
        f1 = !0;
        let fo = Math.sin(this.time * 2 * Math.PI * 11) > 0;
        this.rpm = this.limiterRpm - (fo ? 220 : 40), fo && (f0 = -0.4);
      }
    }
    return this.rpm = clamp(this.rpm, this.idleRpm * 0.95, this.limiterRpm), this.load += smoothingAlpha(H, f3) * (f0 - this.load), {
      'rpm': this.rpm,
      'gear': this.gear + 1,
      'gearLabel': G < 0.3 && this.throttle < 0.03 ? 'N' : String(this.gear + 1),
      'load': clamp(this.load, -1, 1),
      'throttle': this.throttle,
      'brake': this.brake,
      'shifting': !!this.shift,
      'shiftDir': f2,
      'shiftEvent': D,
      'limiter': f1
    };
  }
};
var ne = 0.9;
var ae = 0.18;
var oe = 1.1;
var re = 0.15;
var DEMO_PHASES = [{
  'kind': "hold",
  'seconds': 3,
  'label': "Leerlauf"
}, {
  'kind': "accelerate",
  'throttle': 1,
  'toKmh': 150,
  'label': "Vollgas auf 150 km/h – Hochschalten"
}, {
  'kind': "decelerate",
  'brake': 0.25,
  'toKmh': 80,
  'label': "Locker bremsen auf 80 km/h – Rückschalten"
}, {
  'kind': 'accelerate',
  'throttle': 1,
  'toKmh': 160,
  'label': "Kickdown – Vollgas auf 160 km/h"
}, {
  'kind': 'decelerate',
  'brake': 0.25,
  'toKmh': 50,
  'label': "Locker bremsen auf 50 km/h – Rückschalten"
}];
var he = 1;
var DemoInput = class a extends EventTarget {
  constructor() {
    super(), this.vehicle = new VehicleModel(), this.mode = "manual", this.gasHeld = !1, this.brakeHeld = !1, this.throttle = 0, this.brake = 0, this.speed = 0, this.accel = 0, this.phaseIndex = 0, this.phaseTime = 0, this.status = "off", this.holdThrottle = 0, this.cruiseMps = null;
  }
  setHoldThrottle(M) {
    this.holdThrottle = clamp(Number(M) || 0, 0, 1), this.cruiseMps = null;
  }
  setCruise(M) {
    this.cruiseMps = M > 0 ? kmhToMps(M) : null, this.holdThrottle = 0;
  }
  _cruiseThrottle(M) {
    let r = this.vehicle.resistance(this.speed) / this.vehicle.maxDrive(this.speed);
    return clamp(r + (M - this.speed) * 0.12, 0, 0.6);
  }
  configure(M) {
    this.vehicle = new VehicleModel(M?.["vehicle"]);
  }
  start() {
    this.speed = 0, this.accel = 0, this.throttle = 0, this.brake = 0, this.gasHeld = !1, this.brakeHeld = !1, this.phaseIndex = 0, this.phaseTime = 0, this.status = 'active';
  }
  stop() {
    this.status = 'off', this.gasHeld = !1, this.brakeHeld = !1;
  }
  setMode(M) {
    this.mode = M === "auto" ? 'auto' : "manual", this.phaseIndex = 0, this.phaseTime = 0, this.gasHeld = !1, this.brakeHeld = !1;
  }
  setGas(M) {
    this.gasHeld = !!M;
  }
  setBrake(M) {
    this.brakeHeld = !!M;
  }
  get phaseLabel() {
    return this.mode === "auto" ? DEMO_PHASES[this.phaseIndex].label : null;
  }
  static _approach(M, A, d, Z, l) {
    let T = (A > M ? 1 / d : 1 / Z) * l;
    return A > M ? Math.min(A, M + T) : Math.max(A, M - T);
  }
  _runCycle(M) {
    let A = DEMO_PHASES[this.phaseIndex];
    this.phaseTime += M;
    let d = 0,
      Z = 0,
      l = !1;
    switch (A.kind) {
      case "hold":
        Z = this.speed > 0 ? 0.3 : 0, l = this.phaseTime >= A.seconds;
        break;
      case "accelerate":
        d = A.throttle, l = this.speed >= kmhToMps(A.toKmh);
        break;
      case "cruise":
        {
          let T = kmhToMps(A.kmh) - this.speed,
            H = this.vehicle.resistance(this.speed) / this.vehicle.maxDrive(this.speed);
          d = clamp(H + T * 0.08, 0.05, 0.5), l = this.phaseTime >= A.seconds;
          break;
        }
      case "coast":
        l = this.phaseTime >= A.seconds;
        break;
      case "decelerate":
        Z = A.brake, l = this.speed <= kmhToMps(A.toKmh) + 0.05;
        break;
      default:
        l = !0;
    }
    return l && (this.phaseIndex = this.phaseIndex + 1 < DEMO_PHASES.length ? this.phaseIndex + 1 : he, this.phaseTime = 0, this.dispatchEvent(new CustomEvent("phase", {
      'detail': {
        'label': DEMO_PHASES[this.phaseIndex].label
      }
    }))), {
      'thr': d,
      'brk': Z
    };
  }
  tick(M, A = null) {
    if (this.status !== "active") return;
    let d = clamp(M, 0, 0.25),
      Z,
      l;
    if (this.mode === "auto") {
      let {
        thr: S,
        brk: G
      } = this._runCycle(d);
      Z = S, l = G;
    } else l = this.brakeHeld ? 1 : 0, this.brakeHeld ? Z = 0 : this.gasHeld ? Z = 1 : this.cruiseMps ? Z = this._cruiseThrottle(this.cruiseMps) : Z = this.holdThrottle;
    this.throttle = a._approach(this.throttle, Z, ne, ae, d), this.brake = a._approach(this.brake, l, oe, re, d);
    let T = A?.['shifting'] && A.shiftDir === 'up' ? 0.15 : 1,
      H = this.vehicle.acceleration(this.speed, this.throttle, this.brake, T);
    this.speed = Math.max(0, this.speed + H * d), this.accel += (1 - Math.exp(-d / 0.15)) * (H - this.accel), this.speed === 0 && this.throttle === 0 && (this.accel = 0);
  }
  snapshot() {
    return {
      'speedMps': this.speed,
      'accelMps2': this.accel,
      'rawSpeedMps': this.speed,
      'throttle': this.throttle,
      'brake': this.brake,
      'source': "demo",
      'quality': this.status === 'active' ? "demo" : "none",
      'ageS': 0,
      'accuracyM': null
    };
  }
};

export { PowertrainModel, VehicleModel, DemoInput, DEMO_PHASES };
