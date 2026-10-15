/**
 * Behavioral port of EngineV1's public diagnostics.js (version 4d98a15d4e17).
 * String tables decoded statically; numerical behavior retained.
 * Source and boundaries: docs/algorithm-notes.md.
 * No login, analytics, marketing, or page bootstrap code is included.
 */
function clamp(M, r, W) {
  return M < r ? r : M > W ? W : M;
}
function smoothingAlpha(M, r) {
  return r <= 0 ? 1 : 1 - Math.exp(-Math.max(0, M) / r);
}
var ot = 6371008.8;
var B = M => M * Math.PI / 180;
function haversineDistance(M, r, W, l) {
  let u = B(W - M),
    j = B(l - r),
    p = Math.sin(u / 2) ** 2 + Math.cos(B(M)) * Math.cos(B(W)) * Math.sin(j / 2) ** 2;
  return 2 * ot * Math.asin(Math.min(1, Math.sqrt(p)));
}
var MOTION_DEFAULTS = Object.freeze({
  'maxAccuracyM': 50,
  'maxSpeedMps': 85,
  'maxAccelMps2': 10,
  'speedTauS': 1,
  'accelTauS': 1.2,
  'minMoveM': 3,
  'stationaryAfterS': 4,
  'restartAfterS': 10,
  'staleAfterS': 3.5,
  'lostAfterS': 8,
  'maxConsecutiveRejects': 3,
  'mode': "smooth",
  'snapK': 3,
  'sigmaFloor': 0.12,
  'sigmaStart': 0.6,
  'sigmaTauS': 4,
  'calmTauS': 0.8,
  'onsetBoost': 1.8,
  'lagS': 0.3,
  'predictMaxS': 1.3,
  'pendingMaxAccel': 4,
  'confirmRatio': 0.3,
  'cautious': Object.freeze({
    'speedTrust': 0.5,
    'predict': 0.35
  }),
  'trusted': Object.freeze({
    'speedTrust': 1,
    'predict': 0.8
  }),
  'trustAfterConfirmed': 2
});
var MotionEstimator = class {
  constructor(M = {}) {
    this.defaults = {
      ...MOTION_DEFAULTS,
      ...M
    }, this.opts = {
      ...this.defaults
    }, this.reset();
  }
  reset() {
    this.speed = null, this.accel = 0, this.rawSpeed = null, this.source = null, this.lastSpeedT = null, this.lastSpeedReceivedAt = null, this.lastFixT = null, this.lastAccuracy = null, this.anchor = null, this.consecutiveRejects = 0, this.prevFix = null, this.sigma = null, this.pending = null, this.lastRaw = null, this.confirmedJumps = 0, this.spikes = 0, this.lastT = null, this.stats = {
      'received': 0,
      'accepted': 0,
      'rejected': 0,
      'withSpeed': 0,
      'retimed': 0,
      'reasons': {}
    };
  }
  _reject(M) {
    return this.stats.rejected += 1, this.stats.reasons[M] = (this.stats.reasons[M] || 0) + 1, {
      'accepted': !1,
      'reason': M
    };
  }
  addFix(M) {
    this.stats.received += 1;
    let {
      latitude: W,
      longitude: j,
      receivedAt: f0
    } = M;
    if (!Number.isFinite(W) || !Number.isFinite(j) || Math.abs(W) > 90 || Math.abs(j) > 180) return this._reject("invalid-position");
    if (!Number.isFinite(f0)) return this._reject("invalid-time");
    let f1 = this.prevFix;
    this.prevFix = {
      'latitude': W,
      'longitude': j,
      'speed': M.speed ?? null,
      'receivedAt': f0
    };
    let f2 = (Number.isFinite(M.timestamp) ? M.timestamp : f0) / 1000,
      f3 = !1;
    if (this.lastT !== null && f2 <= this.lastT) {
      let f5 = f1 && f1.latitude === W && f1.longitude === j && f1.speed === (M.speed ?? null),
        f6 = f1 ? (f0 - f1.receivedAt) / 1000 : 0;
      if (f5 || f6 < 0.2) return this._reject(f5 ? "duplicate" : "out-of-order");
      f2 = this.lastT + f6, f3 = !0, this.stats.retimed += 1;
    }
    this.lastT = f2;
    let f4 = this._addFix(M, f2);
    return f3 && f4.accepted ? {
      ...f4,
      'retimed': !0
    } : f4;
  }
  _addFix(f0, f1) {
    let f2 = this.opts,
      {
        latitude: f3,
        longitude: f4,
        receivedAt: f5
      } = f0,
      f6 = Number.isFinite(f0.accuracy) && f0.accuracy >= 0 ? f0.accuracy : null,
      f7 = typeof f0.speed == 'number' && Number.isFinite(f0.speed) && f0.speed >= 0;
    f7 && (this.stats.withSpeed += 1);
    let f8 = null,
      f9 = null,
      ff = null;
    if (f7) {
      if (f6 !== null && f6 > f2.maxAccuracyM * 2) return this._reject('inaccurate');
      f8 = f0.speed, f9 = "gps", ff = this.lastSpeedT === null ? null : f1 - this.lastSpeedT, this.anchor = {
        'latitude': f3,
        'longitude': f4,
        'accuracy': f6 ?? f2.maxAccuracyM,
        't': f1
      };
    } else {
      if (f6 === null || f6 > f2.maxAccuracyM) return this._reject("inaccurate");
      if (!this.anchor || f1 - this.anchor.t > f2.restartAfterS) return this.anchor = {
        'latitude': f3,
        'longitude': f4,
        'accuracy': f6,
        't': f1
      }, this.lastFixT = f1, this.lastAccuracy = f6, this.stats.accepted += 1, {
        'accepted': !0,
        'reason': "anchor"
      };
      let fo = haversineDistance(this.anchor.latitude, this.anchor.longitude, f3, f4),
        fq = f1 - this.anchor.t,
        fM = Math.max(f2.minMoveM, 0.75 * (this.anchor.accuracy + f6));
      if (fo > fM) f8 = fo / fq, f9 = "derived", ff = this.lastSpeedT === null ? null : f1 - this.lastSpeedT, this.anchor = {
        'latitude': f3,
        'longitude': f4,
        'accuracy': f6,
        't': f1
      };else {
        if (fq >= f2.stationaryAfterS) f8 = 0, f9 = "derived", ff = this.lastSpeedT === null ? null : f1 - this.lastSpeedT, this.anchor = {
          'latitude': f3,
          'longitude': f4,
          'accuracy': f6,
          't': f1
        };else return this.lastFixT = f1, this.lastAccuracy = f6, this.stats.accepted += 1, {
          'accepted': !0,
          'reason': "within-noise"
        };
      }
    }
    if (f8 > f2.maxSpeedMps) return this._reject('implausible-speed');
    let fN = this.speed === null || ff === null || ff > f2.restartAfterS;
    return !fN && ff > 0 && this.rawSpeed !== null && Math.abs(f8 - this.rawSpeed) / ff > f2.maxAccelMps2 ? (this.consecutiveRejects += 1, this.consecutiveRejects <= f2.maxConsecutiveRejects ? this._reject("implausible-jump") : this._accept(f8, f9, f1, f5, f6, null, "resync")) : this._accept(f8, f9, f1, f5, f6, fN ? null : ff, fN ? "restart" : 'ok');
  }
  _accept(M, W, j, f0, f1, f2, f3) {
    let f4 = this.opts;
    if (f4.mode === "adaptive") this._adaptive(M, f2);else {
      if (f2 === null || f2 <= 0) this.speed = M, this.accel = 0;else {
        let f5 = this.speed;
        this.speed = f5 + smoothingAlpha(f2, f4.speedTauS) * (M - f5);
        let f6 = (this.speed - f5) / f2;
        this.accel = clamp(this.accel + smoothingAlpha(f2, f4.accelTauS) * (f6 - this.accel), -f4.maxAccelMps2, f4.maxAccelMps2);
      }
    }
    return this.speed < 0.05 && (this.speed = 0), this.rawSpeed = M, this.source = W, this.lastSpeedT = j, this.lastFixT = j, this.lastSpeedReceivedAt = f0, this.lastAccuracy = f1, this.consecutiveRejects = 0, this.stats.accepted += 1, {
      'accepted': !0,
      'reason': f3
    };
  }
  _adaptive(M, W) {
    let j = this.opts;
    if (W === null || W <= 0 || this.speed === null || this.sigma === null || this.lastRaw === null) {
      this.sigma === null && (this.sigma = j.sigmaStart), this.speed = M, this.lastRaw = M, this.accel = 0, this.pending = null;
      return;
    }
    let f0 = (M - this.lastRaw) / W,
      f1 = this.lastRaw;
    this.lastRaw = M;
    let f2 = Math.max(j.sigmaFloor, this.sigma);
    if (this.pending) {
      let f4 = this.pending;
      if (this.pending = null, Math.sign(f0) === Math.sign(f4.accel) && Math.abs(f0) >= j.confirmRatio * Math.abs(f4.accel)) {
        this.confirmedJumps += 1, this.accel = clamp(f0, -j.maxAccelMps2, j.maxAccelMps2), this.speed = M;
        return;
      }
      let f5 = W + f4.dt,
        f6 = (M - f4.rawBefore) / f5;
      if (Math.abs(f6 - f4.accelBefore) <= j.snapK * f2) {
        this.stats.reasons.spike = (this.stats.reasons.spike || 0) + 1, this.spikes += 1, this.accel = f4.accelBefore, this.speed = M;
        return;
      }
      this.accel = clamp(f6, -j.maxAccelMps2, j.maxAccelMps2), this.speed = M;
      return;
    }
    let f3 = f0 - this.accel;
    if (Math.abs(f3) > j.snapK * f2) {
      let f7 = Math.abs(this.accel) < j.snapK * f2 ? f0 * j.onsetBoost : f0;
      this.pending = {
        'accel': f0,
        'rawBefore': f1,
        'accelBefore': this.accel,
        'dt': W
      }, this.accel = clamp(f7, -j.pendingMaxAccel, j.pendingMaxAccel), this.speed += (M - this.speed) * this._trust().speedTrust;
      return;
    } else this.accel += smoothingAlpha(W, j.calmTauS * (f2 / j.sigmaFloor)) * f3, this.sigma += smoothingAlpha(W, j.sigmaTauS) * (Math.abs(f3) * 1.25 - this.sigma);
    this.speed = M;
  }
  _trust() {
    let M = this.opts;
    return this.spikes === 0 && this.confirmedJumps >= M.trustAfterConfirmed ? M.trusted : M.cautious;
  }
  snapshot(M) {
    let W = this.opts;
    if (this.speed === null || this.lastSpeedReceivedAt === null) return {
      'speedMps': 0,
      'accelMps2': 0,
      'rawSpeedMps': null,
      'source': null,
      'quality': 'none',
      'ageS': null,
      'accuracyM': this.lastAccuracy
    };
    let u = Math.max(0, (M - this.lastSpeedReceivedAt) / 1000),
      j = u >= W.lostAfterS ? "lost" : u >= W.staleAfterS ? "stale" : 'fresh',
      p = this.speed,
      f0 = this.accel;
    if (W.mode === "adaptive") {
      let f1 = u <= W.predictMaxS ? 1 : Math.max(0, 1 - (u - W.predictMaxS) / 1.5),
        f2 = this.pending ? this._trust().predict : 1;
      p = Math.max(0, p + f0 * Math.min(u + W.lagS, W.predictMaxS) * f1 * f2), f0 *= f1;
    }
    return {
      'speedMps': p,
      'accelMps2': f0,
      'rawSpeedMps': this.rawSpeed,
      'source': this.source,
      'quality': j,
      'ageS': u,
      'accuracyM': this.lastAccuracy
    };
  }
};
var X = Object.freeze({
  'enableHighAccuracy': !0,
  'maximumAge': 0,
  'timeout': 10000
});
var ct = {
  1: "Standortzugriff wurde abgelehnt. Bitte erlaube den Standort für diese Seite in den Browser-Einstellungen.",
  2: "Standort ist derzeit nicht verfügbar (kein GPS-Empfang?).",
  3: "Zeitüberschreitung beim Warten auf eine Standortmessung."
};
var ReferenceGeolocationInput = class n extends EventTarget {
  static isSupported() {
    return typeof navigator < 'u' && "geolocation" in navigator;
  }
  constructor(M) {
    super(), this.estimator = new MotionEstimator(M), this.watchId = null, this.status = "off", this.lastReceivedAt = null, this.lastValidEpoch = null, this.pollMs = 0, this.pollTimer = null, this.pollBusy = !1;
  }
  configure(M = {}, {
    pollMs: r = 0
  } = {}) {
    this.estimator.opts = {
      ...this.estimator.defaults,
      ...M
    }, this.pollMs = r, this.watchId !== null && this._startPolling();
  }
  _startPolling() {
    clearInterval(this.pollTimer), this.pollTimer = null, this.pollMs && (this.pollTimer = setInterval(() => {
      this.pollBusy || this.watchId === null || (this.pollBusy = !0, navigator.geolocation.getCurrentPosition(M => {
        this.pollBusy = !1, this.watchId !== null && this._onPosition(M);
      }, () => {
        this.pollBusy = !1;
      }, {
        ...X,
        'timeout': 2000
      }));
    }, this.pollMs));
  }
  _setStatus(M) {
    this.status !== M && (this.status = M, this.dispatchEvent(new CustomEvent("status", {
      'detail': {
        'status': M
      }
    })));
  }
  start() {
    return n.isSupported() ? (this.watchId !== null || (this.estimator.reset(), this._setStatus("requesting"), this.watchId = navigator.geolocation.watchPosition(M => this._onPosition(M), M => this._onError(M), X), this._startPolling()), !0) : (this._setStatus("unsupported"), !1);
  }
  stop() {
    this.watchId !== null && navigator.geolocation.clearWatch(this.watchId), this.watchId = null, clearInterval(this.pollTimer), this.pollTimer = null, this._setStatus("off");
  }
  _onPosition(M) {
    let r = performance.now(),
      W = this.lastReceivedAt === null ? null : r - this.lastReceivedAt;
    this.lastReceivedAt = r;
    let a = M.coords,
      l = this.estimator.addFix({
        'latitude': a.latitude,
        'longitude': a.longitude,
        'accuracy': a.accuracy,
        'speed': a.speed,
        'timestamp': M.timestamp,
        'receivedAt': r
      });
    l.accepted && (this.lastValidEpoch = Date.now()), this._setStatus("active"), this.dispatchEvent(new CustomEvent("fix", {
      'detail': {
        'result': l,
        'intervalMs': W,
        'coords': {
          'accuracy': a.accuracy,
          'speed': a.speed,
          'hasSpeed': Number.isFinite(a.speed)
        }
      }
    }));
  }
  _onError(M) {
    let r = ct[M.code] || M.message || "Unbekannter Standortfehler.";
    M.code === 1 ? (this.stop(), this._setStatus("denied")) : this._setStatus(M.code === 2 ? 'unavailable' : "waiting"), this.dispatchEvent(new CustomEvent("geoerror", {
      'detail': {
        'code': M.code,
        'message': r
      }
    }));
  }
  snapshot(M) {
    return this.estimator.snapshot(M);
  }
};

export { MotionEstimator, MOTION_DEFAULTS, ReferenceGeolocationInput, haversineDistance };
