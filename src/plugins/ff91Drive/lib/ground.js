// Ported from the FF 91 reference scene for Three.js r180.
import * as THREE from 'three'
import rippleGen_1 from './ripple.js'
import * as utils_1 from './math.js'
import fragShader from '../shaders/ground.frag?raw'
import vertShader from '../shaders/ground.vert?raw'

var Grid = (function () {
    function Grid(_scene, _renderer, _ledSprite) {
        this.GRID_SIZE = 32;
        this.GRID_HALFSIZE = 16;
        this.parent = _scene;
        this.prevOrigin = new THREE.Vector2();
        this.ripplePos = new THREE.Vector2();
        this.ledSprite = _ledSprite;
        this.rippleGen = new rippleGen_1(_renderer, this.ripplePos, this.GRID_SIZE);
        this.generateGrid();
    }
    Grid.prototype.generateGrid = function () {
        ///////////////// GRID MATERIAL /////////////////
        this.color = new THREE.Color(0xffffff);
        this.gridMaterial = new THREE.ShaderMaterial({
            uniforms: {
                led: { value: this.ledSprite },
                heightmap: { value: null },
                vpH: { value: 1 },
                prog: { value: 0.0 },
                origin: { value: new THREE.Vector2() },
                color: { value: this.color }
            },
            defines: {
                RANGE: (this.GRID_SIZE / 2).toFixed(1),
                RANGE2: (this.GRID_SIZE).toFixed(1)
            },
            vertexShader: vertShader,
            fragmentShader: fragShader,
            transparent: true,
            depthWrite: false
        });
        this.uniProgress = this.gridMaterial.uniforms["prog"];
        this.uniOrigin = this.gridMaterial.uniforms["origin"];
        ///////////////// GRID GEOMETRY /////////////////
        var vertCount = Math.pow(this.GRID_SIZE, 2);
        var position = new Float32Array(vertCount * 3);
        var uvs = new Float32Array(vertCount * 2);
        var diagonal = new Uint16Array(vertCount);
        var randI = THREE.MathUtils.randInt;
        var xPos = 0;
        var zPos = 0;
        for (var i = 0, i3 = 0; i < vertCount; i++, i3 += 3) {
            // xPos = randI(0, this.GRID_SIZE);
            // zPos = randI(0, this.GRID_SIZE);
            xPos = (i % this.GRID_SIZE);
            zPos = Math.floor(i / this.GRID_SIZE);
            position[i3 + 0] = xPos - this.GRID_HALFSIZE;
            position[i3 + 1] = 0;
            position[i3 + 2] = zPos - this.GRID_HALFSIZE;
            uvs[i * 2 + 0] = xPos / this.GRID_SIZE;
            uvs[i * 2 + 1] = 1.0 - zPos / this.GRID_SIZE;
            diagonal[i] = (xPos + zPos) % 2;
        }
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
        this.geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
        this.geometry.setAttribute("diagonal", new THREE.BufferAttribute(diagonal, 1));
        ///////////////// GRID OBJECT /////////////////
        this.lightGrid = new THREE.Points(this.geometry, this.gridMaterial);
        this.lightGrid.frustumCulled = false;
        this.parent.add(this.lightGrid);
    };
    Grid.prototype.moveRippleOrigin = function (_x, _y) {
        this.ripplePos.set(_x, _y);
    };
    ///////////////////////////// PUBLIC METHODS /////////////////////////////
    // Update once per frame
    Grid.prototype.update = function (_props) {
        if (typeof _props != "undefined" && _props.speed > 0) {
            this.rippleGen.newRippleImpact(_props.speed / 64);
            this.moveRippleOrigin(utils_1.mod((_props.pos.x + this.GRID_HALFSIZE), this.GRID_SIZE) - this.GRID_HALFSIZE, utils_1.mod((_props.pos.y + this.GRID_HALFSIZE), this.GRID_SIZE) - this.GRID_HALFSIZE);
            this.uniOrigin.value = _props.pos;
        }
        this.gridMaterial.uniforms["heightmap"].value = this.rippleGen.update();
        this.moveRippleOrigin(1000, 1000);
    };
    // On Window Resize
    Grid.prototype.onWindowResize = function (vpW, vpH, pixelRatio) {
        this.gridMaterial.uniforms["vpH"].value = vpH * pixelRatio;
    };
    return Grid;
}());
export default Grid;
