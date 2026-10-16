// Ported from the FF 91 reference scene for Three.js r180.
import * as THREE from 'three'
import CarWheels_1 from './wheels.js'
import CarLights_1 from './lights.js'

/*
***** Car hierarchy *****
CarWhole
├── wheelFL
├── wheelFR
├── wheelBL
├── wheelBR
├── CarChassis
    ├── BodyBlack
    ├── BodySilver
    ├── Brakes
    ├── FFBack
    ├── GlassTinted
    ├── GlassTransparent
    ├── Headlights
    ├── Taillights
    └── Undercarriage

For lens flare, look into:
https://alteredqualia.com/three/examples/webgl_city.html
*/
var CarBody = (function () {
    function CarBody(_scene, _cargo) {
        this.parent = _scene;
        this.carWhole = new THREE.Group();
        this.carWhole.rotateY(-Math.PI / 2);
        this.parent.add(this.carWhole);
        this.carChassis = this.buildCarChassis(_cargo["vrBodyCompiled"], _cargo["envReflection"]);
        this.carWhole.add(this.carChassis);
        this.addShadow(_cargo["shadow"]);
        this.carLights = new CarLights_1(this.carChassis, _cargo);
        this.carWheels = new CarWheels_1(this.carWhole, _cargo);
    }
    // Creates black part of body
    CarBody.prototype.buildCarChassis = function (_bodyGeom, _cubeText) {
        _bodyGeom.scale.set(0.0005, 0.0005, 0.0005);
        _bodyGeom.position.set(1.56, 0, 0);
        this.envCube = _cubeText;

        // Material Body Color
        this.matBodySilver = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHex(0xbbbbbb, THREE.LinearSRGBColorSpace),
            metalness: 0.7,
            roughness: 0.7,
            envMap: this.envCube,
        });
        // Material Body Black
        this.matBodyBlack = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHex(0x000000, THREE.LinearSRGBColorSpace),
            emissive: new THREE.Color().setHex(0x444444, THREE.LinearSRGBColorSpace),
            reflectivity: 0.8,
            envMap: this.envCube,
        });
        // Tinted windows
        this.matGlassTinted = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHex(0x000000, THREE.LinearSRGBColorSpace),
            emissive: new THREE.Color().setHex(0x666666, THREE.LinearSRGBColorSpace),
            reflectivity: 1,
            envMap: this.envCube,
        });
        this.matUndercarriage = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHex(0x000000, THREE.LinearSRGBColorSpace)
        });
        // Transparent glass
        this.matGlassTransp = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHex(0x000000, THREE.LinearSRGBColorSpace),
            emissive: new THREE.Color().setHex(0x666666, THREE.LinearSRGBColorSpace),
            reflectivity: 1.0,
            envMap: this.envCube,
            transparent: true,
            blending: THREE.AdditiveBlending,
        });
        // Car bodymaterials
        _bodyGeom.getObjectByName("BodyBlack").material = this.matBodyBlack;
        _bodyGeom.getObjectByName("BodySilver").material = this.matBodySilver;
        _bodyGeom.getObjectByName("GlassTransparent").material = this.matGlassTransp;
        _bodyGeom.getObjectByName("GlassTinted").material = this.matGlassTinted;
        _bodyGeom.getObjectByName("Undercarriage").material = this.matUndercarriage;
        return _bodyGeom;
    };
    CarBody.prototype.addShadow = function (_shad) {
        var shadowPlane = new THREE.PlaneGeometry(6.5, 6.5, 1, 1);
        shadowPlane.rotateX(-Math.PI / 2);
        shadowPlane.translate(1.56, 0, 0);
        var shadowMat = new THREE.MeshBasicMaterial({
            map: _shad,
            side: THREE.DoubleSide,
            blending: THREE.MultiplyBlending,
            premultipliedAlpha: true,
            transparent: true,
            depthWrite: false
        });
        var shadowMesh = new THREE.Mesh(shadowPlane, shadowMat);
        this.carWhole.add(shadowMesh);
    };
    ///////////////////////////// PUBLIC METHODS /////////////////////////////
    CarBody.prototype.onWindowResize = function (_vpH) {
        this.carLights.onWindowResize(_vpH);
    };
    // Called once per frame
    CarBody.prototype.update = function (_props) {
        // Apply car physics
        this.carWhole.rotation.y = _props.theta;
        this.carChassis.rotation.z = _props.longitMomentum * 0.0015;
        this.carChassis.rotation.x = _props.lateralMomentum * 0.002;
        this.carWheels.update(_props);
        this.carLights.update(_props);
    };
    return CarBody;
}());
export default CarBody;
