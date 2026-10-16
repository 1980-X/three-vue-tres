// Ported from the FF 91 reference scene for Three.js r180.


// Converts a value to 0 - 1 from its min - max bounds
function normalize(val, min, max) {
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
}
export { normalize };
// Converts a value to 0 - 1 from its min - max bounds in quadratic in form
function normalizeQuadIn(val, min, max) {
    return Math.pow(normalize(val, min, max), 2.0);
}
export { normalizeQuadIn };
// Converts a value to 0 - 1 from its min - max bounds in quadratic out form
function normalizeQuadOut(val, min, max) {
    var x = normalize(val, min, max);
    return x * (2.0 - x);
}
export { normalizeQuadOut };
// Tween to target using Zeno's Paradox
function zTween(_val, _target, _ratio) {
    return _val + (_target - _val) * Math.min(_ratio, 1.0);
}
export { zTween };
// Keeps track of time in seconds
// and caps rendering to match desired FPS
var Time = (function () {
    function Time(timeFactor) {
        this.fallBackRates = [60, 40, 30, 20, 15];
        this.prev = 0;
        this.prevBreak = 0;
        this.delta = 0;
        this.timeFact = (typeof timeFactor === "undefined") ? 1 : timeFactor;
        this.frameCount = 0;
        this.fallBackIndex = 0;
        this.setFPS(60);
    }
    Time.prototype.update = function (_newTime) {
        this.deltaBreak = Math.min(_newTime - this.prevBreak, 1.0);
        // Update time if enough time has passed
        if (this.deltaBreak > this.spf) {
            this.delta = Math.min(_newTime - this.prev, 1.0);
            this.prev = _newTime;
            this.prevBreak = _newTime - (this.deltaBreak % this.spf);
            // this.checkFPS();
            // Returns true to render frame
            return true;
        }
        else {
            // Returns false to skip frame
            return false;
        }
    };
    Time.prototype.checkFPS = function () {
        if (this.delta > this.spf * 2) {
            this.frameCount++;
            console.log(this.frameCount);
            if (this.frameCount > 30) {
                this.frameCount = 0;
                this.fallBackIndex++;
                this.setFPS(this.fallBackRates[this.fallBackIndex]);
            }
        }
    };
    Time.prototype.setFPS = function (_newVal) {
        this.fps = _newVal;
        this.spf = 1 / this.fps;
    };
    return Time;
}());
export { Time };
// Fisher-Yates Shuffle
function shuffle(array) {
    var m = array.length, t, i;
    // While there remain elements to shuffle
    while (m) {
        // Pick a remaining element
        i = Math.floor(Math.random() * m--);
        // And swap it with the current element.
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }
    return array;
}
export { shuffle };
function mod(n, m) {
    return ((n % m) + m) % m;
}
export { mod };
