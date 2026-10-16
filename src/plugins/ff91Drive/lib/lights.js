// Ported from the FF 91 reference scene for Three.js r180.
import * as THREE from 'three'
import headgridVS from '../shaders/head-grid.vert?raw'
import headgridFS from '../shaders/head-grid.frag?raw'
import tailLightVS from '../shaders/tail-light.vert?raw'
import tailGridVS from '../shaders/tail-grid.vert?raw'
import tailGridFS from '../shaders/tail-grid.frag?raw'
import flareVS from '../shaders/flare.vert?raw'
import flareFS from '../shaders/flare.frag?raw'
import turnBarVS from '../shaders/turn-glow.vert?raw'
import stopBarVS from '../shaders/brake-glow.vert?raw'
import turnBarFS from '../shaders/light-glow.frag?raw'

var CarLights = (function () {
    function CarLights(_carChassis, _cargo) {
        this.lfTimer = 0;
        this.rtTimer = 0;
        this.carChassis = _carChassis;
        this.flareHeadText = _cargo["flareHead"];
        this.flareTurnText = _cargo["flareTurn"];
        this.glowTurnText = _cargo["lightTurn"];
        this.glowStopText = _cargo["lightStop"];
        this.uniLightsTurn = new THREE.Vector3(0, 0, 0);
        this.uniLightsOther = new THREE.Vector3(0, 1, 0);
        this.initLightMeshes();
        this.initHeadlightFlares();
        this.initStopFlares();
        this.initTurnFlares();
    }
    ////////////////// SOLID LIGHT MESHES //////////////////
    CarLights.prototype.initLightMeshes = function () {
        var tailGrid = this.carChassis.getObjectByName("TailGrid");
        tailGrid.geometry.computeVertexNormals();
        // Headlights
        this.matHeadLights = new THREE.ShaderMaterial({
            uniforms: {
                lightsT: { value: this.uniLightsTurn },
                lightsO: { value: this.uniLightsOther }
            },
            vertexShader: headgridVS,
            fragmentShader: headgridFS
        });
        // Taillight material
        this.matTailLights = new THREE.ShaderMaterial({
            uniforms: {
                lightsT: { value: this.uniLightsTurn },
                lightsO: { value: this.uniLightsOther }
            },
            vertexShader: tailLightVS,
            fragmentShader: tailGridFS,
        });
        // Tailgrid material
        this.matTailGrid = new THREE.ShaderMaterial({
            uniforms: {
                lightsT: { value: this.uniLightsTurn },
                lightsO: { value: this.uniLightsOther }
            },
            vertexShader: tailGridVS,
            fragmentShader: tailGridFS
        });
        this.carChassis.getObjectByName("HeadLights").material = this.matHeadLights;
        this.carChassis.getObjectByName("TailLights").material = this.matTailLights;
        tailGrid.material = this.matTailGrid;
    };
    ////////////////// HEADLIGHT FLARES //////////////////
    CarLights.prototype.initHeadlightFlares = function () {
        this.flareHeadMat = new THREE.ShaderMaterial({
            uniforms: {
                tSprite: { value: this.flareHeadText },
                vpH: { value: 1 },
                size: { value: 1.5 },
                brightness: { value: 1.0 }
            },
            vertexShader: flareVS,
            fragmentShader: flareFS,
            blending: THREE.AdditiveBlending,
            transparent: true,
            // depthWrite: false,
            depthTest: false,
        });
        // Make positions
        var posArray = new Float32Array([
            // Passenger
            4000, 1875, 1700,
            4300, 1800, 1700,
            // Driver
            4000, 1875, -1700,
            4300, 1800, -1700,
        ]);
        // Make normals
        var normArray = new Float32Array([
            0.87, 0.22, 0.44,
            0.87, 0.22, 0.44,
            0.87, 0.22, -0.44,
            0.87, 0.22, -0.44,
        ]);
        this.flareHeadGeom = new THREE.BufferGeometry();
        this.flareHeadGeom.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
        this.flareHeadGeom.setAttribute("normal", new THREE.BufferAttribute(normArray, 3));
        this.flareHeadPoints = new THREE.Points(this.flareHeadGeom, this.flareHeadMat);
        this.carChassis.add(this.flareHeadPoints);
    };
    ////////////////// STOPLIGHT FLARES //////////////////
    CarLights.prototype.initStopFlares = function () {
        var glowStopMat = new THREE.ShaderMaterial({
            uniforms: {
                tSprite: { value: this.glowStopText }
            },
            vertexShader: stopBarVS,
            fragmentShader: turnBarFS,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthTest: false
        });
        this.glowStop = this.carChassis.getObjectByName("Stop");
        this.glowStop.material = glowStopMat;
    };
    ////////////////// TURN SIGNALS //////////////////
    CarLights.prototype.initTurnFlares = function () {
        // Left grid
        var posArray = new Float32Array([-4755, 2227, -1269, -4703, 2222, -1326, -4649, 2215, -1381, -4590, 2208, -1436, -4526, 2200, -1492, -4459, 2192, -1548, -4386, 2182, -1604, -4718, 2182, -1264, -4668, 2179, -1321, -4301, 2175, -1658, -4614, 2175, -1377, -4556, 2168, -1433, -4494, 2163, -1489, -4429, 2158, -1545, -4358, 2151, -1600, -4266, 2147, -1653, -4675, 2136, -1260, -4627, 2134, -1316, -4575, 2132, -1373, -4520, 2130, -1428, -4461, 2128, -1485, -4400, 2126, -1540, -4329, 2123, -1597,]);
        var normArray = new Float32Array([-0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4, -0.9, 0, -0.4,]);
        this.flareTurnMat = this.flareHeadMat.clone();
        this.flareTurnMat.uniforms["tSprite"].value = this.flareTurnText;
        this.flareTurnMat.uniforms["size"].value = 0.05;
        this.flareTurnMat.uniforms["brightness"].value = 1;
        var leftTurnGrid = new THREE.BufferGeometry();
        leftTurnGrid.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
        leftTurnGrid.setAttribute("normal", new THREE.BufferAttribute(normArray, 3));
        this.flareLPoints = new THREE.Points(leftTurnGrid, this.flareTurnMat);
        this.carChassis.add(this.flareLPoints);
        // Right grid
        posArray = new Float32Array([-4755, 2227, 1269, -4703, 2222, 1326, -4649, 2215, 1381, -4590, 2208, 1436, -4526, 2200, 1492, -4459, 2192, 1548, -4386, 2182, 1604, -4718, 2182, 1264, -4668, 2179, 1321, -4301, 2175, 1658, -4614, 2175, 1377, -4556, 2168, 1433, -4494, 2163, 1489, -4429, 2158, 1545, -4358, 2151, 1600, -4266, 2147, 1653, -4675, 2136, 1260, -4627, 2134, 1316, -4575, 2132, 1373, -4520, 2130, 1428, -4461, 2128, 1485, -4400, 2126, 1540, -4329, 2123, 1597]);
        normArray = new Float32Array([-0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4, -0.9, 0, 0.4,]);
        var rightTurnGrid = new THREE.BufferGeometry();
        rightTurnGrid.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
        rightTurnGrid.setAttribute("normal", new THREE.BufferAttribute(normArray, 3));
        this.flareRPoints = new THREE.Points(rightTurnGrid, this.flareTurnMat);
        this.carChassis.add(this.flareRPoints);
        // Left & right turn bars
        this.glowTurnMat = new THREE.ShaderMaterial({
            uniforms: {
                tSprite: { value: this.glowTurnText },
                lightsT: { value: this.uniLightsTurn }
            },
            vertexShader: turnBarVS,
            fragmentShader: turnBarFS,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthTest: false
        });
        this.carChassis.getObjectByName("Turn").material = this.glowTurnMat;
    };
    CarLights.prototype.onWindowResize = function (_vpH) {
        this.flareHeadMat.uniforms["vpH"].value = _vpH;
        this.flareTurnMat.uniforms["vpH"].value = _vpH;
    };
    // Animates lights
    CarLights.prototype.update = function (_props) {
        // Turning left
        if (_props.wAngleTarg > 0) {
            this.lfTimer = (this.lfTimer + _props.time.delta * 2) % 2;
            this.uniLightsTurn.y = this.lfTimer > 1 ? 0.0 : 1;
            this.uniLightsTurn.z = 0;
            this.uniLightsTurn.x = -1;
        }
        else if (_props.wAngleTarg < 0) {
            this.rtTimer = (this.rtTimer + _props.time.delta * 2) % 2;
            this.uniLightsTurn.z = this.rtTimer > 1 ? 0.0 : 1;
            this.uniLightsTurn.y = 0;
            this.uniLightsTurn.x = 1;
        }
        else {
            this.lfTimer = 0;
            this.rtTimer = 0;
            this.uniLightsTurn.y = 0;
            this.uniLightsTurn.z = 0;
            this.uniLightsTurn.x = 0;
        }
        this.uniLightsOther.x = _props.braking;
        this.glowStop.visible = _props.braking ? true : false;
        this.flareLPoints.visible = this.uniLightsTurn.y ? true : false;
        this.flareRPoints.visible = this.uniLightsTurn.z ? true : false;
    };
    return CarLights;
}());
export default CarLights;
