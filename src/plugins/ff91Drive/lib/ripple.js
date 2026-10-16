// Ported from the FF 91 reference scene for Three.js r180.
import * as THREE from 'three'
import rawVert from '../shaders/ripple.vert?raw'
import hmFrag from '../shaders/ripple.frag?raw'

var RippleGen = (function () {
    function RippleGen(_renderer, mouse, _gridSize) {
        if (_gridSize === void 0) { _gridSize = 64; }
        this.renderChange = false;
        // DevScene
        this.devMode = false;
        // Set up renderers
        this.renderer = _renderer;
        this.textureSize = _gridSize;
        var dataType = THREE.HalfFloatType;
        this.rTarget1 = new THREE.WebGLRenderTarget(this.textureSize, this.textureSize, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            stencilBuffer: false,
            depthBuffer: false,
            format: THREE.RGBAFormat,
            type: dataType,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping
        });
        this.rTarget2 = this.rTarget1.clone();
        // Set up GP scene
        this.gpScene = new THREE.Scene();
        this.gpCam = new THREE.Camera();
        this.gpCam.position.z = 1;
        var rezString = "vec2( " + this.textureSize.toFixed(1) + ", " + this.textureSize.toFixed(1) + " )";
        this.gpGeom = new THREE.PlaneGeometry(2, 2);
        this.gpMat = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                ripplePos: { value: mouse },
                rippleSize: { value: 1.0 },
                rippleImpact: { value: 1.0 },
                viscosity: { value: 0.01 },
                heightmap: { value: null }
            },
            defines: {
                BOUNDS: this.textureSize.toFixed(1),
                resolution: rezString
            },
            vertexShader: rawVert,
            fragmentShader: hmFrag,
            depthWrite: false,
        });
        this.uniSize = this.gpMat.uniforms["rippleSize"];
        this.uniImpact = this.gpMat.uniforms["rippleImpact"];
        this.gpMesh = new THREE.Mesh(this.gpGeom, this.gpMat);
        this.gpScene.add(this.gpMesh);
        // Set up dev view
        if (this.devMode) {
            this.devScene = new THREE.Scene();
            this.devCam = new THREE.Camera();
            this.devCam.position.z = 1;
            this.devGeom = new THREE.PlaneGeometry(2, 2);
            this.devMat = new THREE.MeshBasicMaterial({ map: this.rTarget1.texture });
            this.devMesh = new THREE.Mesh(this.devGeom, this.devMat);
            this.devScene.add(this.devMesh);
        }
    }
    RippleGen.prototype.renderTo = function (target) {
        const previous = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(target);
        this.renderer.render(this.gpScene, this.gpCam);
        this.renderer.setRenderTarget(previous);
    };
    RippleGen.prototype.dispose = function () {
        this.rTarget1.dispose();
        this.rTarget2.dispose();
        this.gpGeom.dispose();
        this.gpMat.dispose();
        if (this.devGeom) this.devGeom.dispose();
        if (this.devMat) this.devMat.dispose();
    };
    RippleGen.prototype.newRippleSize = function (_size) {
        this.uniSize.value = _size;
    };
    RippleGen.prototype.newRippleImpact = function (_val) {
        this.uniImpact.value = _val;
    };
    RippleGen.prototype.update = function () {
        this.renderChange = !this.renderChange;
        // Render target 1
        if (this.renderChange) {
            this.gpMat.uniforms["heightmap"].value = this.rTarget2.texture;
            this.renderTo(this.rTarget1);
            if (this.devMode) {
                this.renderer.setViewport(0, 0, this.textureSize * 2, this.textureSize * 2);
                this.renderer.render(this.devScene, this.devCam);
                this.renderer.setViewport(0, 0, this.renderer.domElement.width, this.renderer.domElement.height);
            }
            return this.rTarget1.texture;
        }
        else {
            this.gpMat.uniforms["heightmap"].value = this.rTarget1.texture;
            this.renderTo(this.rTarget2);
            if (this.devMode) {
                this.renderer.setViewport(0, 0, this.textureSize * 2, this.textureSize * 2);
                this.renderer.render(this.devScene, this.devCam);
                this.renderer.setViewport(0, 0, this.renderer.domElement.width, this.renderer.domElement.height);
            }
            return this.rTarget2.texture;
        }
    };
    return RippleGen;
}());
export default RippleGen;
