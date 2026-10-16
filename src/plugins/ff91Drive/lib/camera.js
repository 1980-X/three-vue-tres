// Ported from the FF 91 reference scene for Three.js r180.
import * as THREE from 'three'

var CamControl = (function () {
    function CamControl(options) {
        // Default options
        this.options = {
            fov: 45,
            distance: 90,
            distRange: {
                max: Number.POSITIVE_INFINITY,
                min: Number.NEGATIVE_INFINITY
            },
            focusPos: new THREE.Vector3(),
            rotation: new THREE.Vector3(),
            rotRange: {
                xMax: Number.POSITIVE_INFINITY,
                xMin: Number.NEGATIVE_INFINITY,
                yMax: 90,
                yMin: -90,
            },
            eyeSeparation: 0.0 // Ignored
        };
        // Replace defaults with custom options
        for (var key in options) {
            if (key === "rotRange") {
                for (var key in options.rotRange) {
                    this.options.rotRange[key] = options.rotRange[key];
                }
            }
            else if (key === "distRange") {
                for (var key in options.distRange) {
                    this.options.distRange[key] = options.distRange[key];
                }
            }
            else {
                this.options[key] = options[key];
            }
        }
        // Set attributes from options
        this.distActual = this.options.distance;
        this.distTarget = this.options.distance;
        this.focusActual = this.options.focusPos.clone();
        this.focusTarget = this.options.focusPos.clone();
        this.rotActual = this.options.rotation.clone();
        this.rotTarget = this.options.rotation.clone();
        var vpW = 1;
        var vpH = 1;
        this.camera = new THREE.PerspectiveCamera(this.options.fov, vpW / vpH, 0.1, 100);
        // Helpers to calculate rotations
        this.radians = Math.PI / 180;
        this.quatX = new THREE.Quaternion();
        this.quatY = new THREE.Quaternion();
        this.gyro = {
            orient: 0
        };
        // Set default orientation for accelerator rotations
        if (typeof window !== "undefined" && typeof window.orientation !== "undefined") {
            this.defaultEuler = new THREE.Euler(90 * this.radians, 180 * this.radians, (180 + parseInt(window.orientation.toString(), 10)) * this.radians);
        }
        else {
            this.defaultEuler = new THREE.Euler(0, 0, 0);
        }
    }
    /////////////////////////////////////// SET ATTRIBUTES ///////////////////////////////////////
    // Sets distance from focusPos
    CamControl.prototype.setDistance = function (dist) {
        if (dist === void 0) { dist = 150; }
        this.distActual = dist;
        this.distTarget = dist;
    };
    // Sets max and min angles of orbit
    CamControl.prototype.setAngleRange = function (xMax, xMin, yMax, yMin) {
        if (xMax === void 0) { xMax = Number.POSITIVE_INFINITY; }
        if (xMin === void 0) { xMin = Number.NEGATIVE_INFINITY; }
        if (yMax === void 0) { yMax = 90; }
        if (yMin === void 0) { yMin = -90; }
        this.options.rotRange.xMax = xMax;
        this.options.rotRange.xMin = xMin;
        this.options.rotRange.yMax = yMax;
        this.options.rotRange.yMin = yMin;
    };
    // Sets angle of rotation
    CamControl.prototype.setRotation = function (_rotX, _rotY, _rotZ) {
        if (_rotX === void 0) { _rotX = 0; }
        if (_rotY === void 0) { _rotY = 0; }
        if (_rotZ === void 0) { _rotZ = 0; }
        this.rotActual.set(_rotX, _rotY, _rotZ);
        this.rotTarget.set(_rotX, _rotY, _rotZ);
        this.gyro.alpha = undefined;
        this.gyro.beta = undefined;
        this.gyro.gamma = undefined;
    };
    // Sets focus position
    CamControl.prototype.setFocusPos = function (_posX, _posY, _posZ) {
        if (_posX === void 0) { _posX = 0; }
        if (_posY === void 0) { _posY = 0; }
        if (_posZ === void 0) { _posZ = 0; }
        this.focusActual.set(_posX, _posY, _posZ);
        this.focusTarget.set(_posX, _posY, _posZ);
    };
    /////////////////////////////////////// MOTION ///////////////////////////////////////
    // Camera travels away or toward focusPos
    CamControl.prototype.dolly = function (distance) {
        this.distTarget += distance / 100;
        this.distTarget = THREE.MathUtils.clamp(this.distTarget, this.options.distRange.min, this.options.distRange.max);
    };
    // Camera orbits by an angle amount
    CamControl.prototype.orbitBy = function (angleX, angleY) {
        this.rotTarget.x += angleX;
        this.rotTarget.y += angleY;
        this.rotTarget.x = THREE.MathUtils.clamp(this.rotTarget.x, this.options.rotRange.xMin, this.options.rotRange.xMax);
        this.rotTarget.y = THREE.MathUtils.clamp(this.rotTarget.y, this.options.rotRange.yMin, this.options.rotRange.yMax);
    };
    // Camera orbits to an angle
    CamControl.prototype.orbitTo = function (angleX, angleY) {
        this.rotTarget.x = angleX;
        this.rotTarget.y = angleY;
        this.rotTarget.x = THREE.MathUtils.clamp(this.rotTarget.x, this.options.rotRange.xMin, this.options.rotRange.xMax);
        this.rotTarget.y = THREE.MathUtils.clamp(this.rotTarget.y, this.options.rotRange.yMin, this.options.rotRange.yMax);
    };
    // FocusPos moves along the XY axis
    CamControl.prototype.pan = function (distX, distY) {
        this.focusTarget.x -= distX / 10;
        this.focusTarget.y += distY / 10;
    };
    /////////////////////////////////////// DOM EVENTS ///////////////////////////////////////
    // Window resize triggered
    CamControl.prototype.onWindowResize = function (vpW, vpH) {
        this.camera.aspect = vpW / vpH;
        this.camera.updateProjectionMatrix();
    };
    // Landscape-portrait change on mobile devices
    CamControl.prototype.onDeviceReorientation = function (orientation) {
        this.gyro.orient = orientation * this.radians;
    };
    // Set accelerometer data on motion
    CamControl.prototype.onGyroMove = function (alpha, beta, gamma) {
        var acc = this.gyro;
        // Alpha = z axis [0 ,360]
        // Beta = x axis [-180 , 180]
        // Gamma = y axis [-90 , 90]
        acc.alpha = alpha;
        acc.beta = beta;
        acc.gamma = gamma;
    };
    /////////////////////////////////////// UTILS ///////////////////////////////////////
    // Called once per frame
    CamControl.prototype.update = function () {
        // Place camera on focus position
        this.distTarget = THREE.MathUtils.clamp(this.distTarget, this.options.distRange.min, this.options.distRange.max);
        this.distActual += (this.distTarget - this.distActual) * 0.01;
        this.focusActual.lerp(this.focusTarget, 0.05);
        this.camera.position.copy(this.focusActual);
        // If accelerometer data present
        if ([this.gyro.alpha, this.gyro.beta, this.gyro.gamma].every(Number.isFinite)) {
            // Calculate camera rotations
            this.camera.setRotationFromEuler(this.defaultEuler);
            this.camera.rotateZ(this.gyro.alpha * this.radians);
            this.camera.rotateX(this.gyro.beta * this.radians);
            this.camera.rotateY(this.gyro.gamma * this.radians);
            this.camera.rotation.z += this.gyro.orient;
        }
        else {
            // Calculate camera rotations
            this.rotActual.lerp(this.rotTarget, 0.05);
            this.quatX.setFromAxisAngle(CamControl.axisX, -THREE.MathUtils.degToRad(this.rotActual.y));
            this.quatY.setFromAxisAngle(CamControl.axisY, -THREE.MathUtils.degToRad(this.rotActual.x));
            this.quatY.multiply(this.quatX);
            this.camera.quaternion.copy(this.quatY);
        }
        // Set camera distance from focus position
        this.camera.translateZ(this.distActual);
    };
    CamControl.prototype.follow = function (target) {
        // Place camera on focus position
        this.distTarget = THREE.MathUtils.clamp(this.distTarget, this.options.distRange.min, this.options.distRange.max);
        this.distActual += (this.distTarget - this.distActual) * 0.01;
        this.focusTarget.set(target.x, target.y + 1.0, target.z + this.distActual);
        this.focusActual.lerp(this.focusTarget, 0.01);
        this.camera.position.copy(this.focusActual);
        this.camera.lookAt(target);
    };
    // X and Y Axes
    CamControl.axisX = new THREE.Vector3(1, 0, 0);
    CamControl.axisY = new THREE.Vector3(0, 1, 0);
    return CamControl;
}());
export default CamControl;
