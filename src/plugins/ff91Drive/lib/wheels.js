// Ported from the FF 91 reference scene for Three.js r180.
import * as THREE from 'three'
import * as CarProps_1 from './vehicle-state.js'
import * as utils_1 from './math.js'

var CarWheels = (function () {
    function CarWheels(_carWhole, _cargo) {
        // Cap wheel rotation to avoid the "Wagon-wheel effect"
        this.maxWheelTurn = Math.PI / 9.69;
        this.parent = _carWhole;
        this.thread = _cargo["thread"];
        this.thread.minFilter = THREE.NearestFilter;
        this.thread.magFilter = THREE.LinearFilter;

        this.ogMatrix = new THREE.Matrix4().set(0.000788, 0, 0, -0.3939, 0, 0, 0.000788, -0.3939, 0, -0.000788, 0, 0.15, 0, 0, 0, 1);
        this.invMatrix = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1);
        this.wPosF = CarProps_1.FF91.WheelBase;
        this.wPosB = 0;
        this.wPosL = CarProps_1.FF91.WheelTrack / -2;
        this.wPosR = CarProps_1.FF91.WheelTrack / 2;
        this.wPosY = CarProps_1.FF91.WheelDiam / 2;
        var wheelGeom = _cargo["vrWheelBrakes"];
        this.addLeftWheels(wheelGeom.getObjectByName("Wheel"));
        this.addRightWheels();
        this.addBrakes(wheelGeom.getObjectByName("Brake"));
    }
    //////////////////////////////// BUILDING WHEELS ////////////////////////////////
    CarWheels.prototype.addLeftWheels = function (_wheelGroup) {
        this.wheelFL = _wheelGroup;
        this.meshRubber = this.wheelFL.getObjectByName("Tire");
        this.meshSilver = this.wheelFL.getObjectByName("RimsSilver");
        this.meshBlack = this.wheelFL.getObjectByName("RimsBlack");
        this.geomRubber = this.meshRubber.geometry;
        this.geomSilver = this.meshSilver.geometry;
        this.geomBlack = this.meshBlack.geometry;
        this.geomRubber.applyMatrix4(this.ogMatrix);
        this.geomSilver.applyMatrix4(this.ogMatrix);
        this.geomBlack.applyMatrix4(this.ogMatrix);
        // Compute normals in CPU to save JSON filesize
        this.geomRubber.computeVertexNormals();
        this.geomSilver.computeVertexNormals();
        this.geomBlack.computeVertexNormals();
        // Define materials
        this.matRubber = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHex(0x202020, THREE.LinearSRGBColorSpace),
            map: this.thread
        });
        this.matSilver = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHex(0x999999, THREE.LinearSRGBColorSpace),
            shininess: 50,
        });
        this.matBlack = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHex(0x111111, THREE.LinearSRGBColorSpace),
            shininess: 50,
        });
        this.meshRubber.material = this.matRubber;
        this.meshSilver.material = this.matSilver;
        this.meshBlack.material = this.matBlack;
        // Front left
        this.wheelFL.position.set(this.wPosF, this.wPosY, this.wPosL);
        this.parent.add(this.wheelFL);
        // Back left
        this.wheelBL = this.wheelFL.clone();
        this.wheelBL.position.set(this.wPosB, this.wPosY, this.wPosL);
        this.parent.add(this.wheelBL);
    };
    // Invert wheels to add on right side
    CarWheels.prototype.addRightWheels = function () {
        this.iGeomRubber = this.geomRubber.clone();
        this.iGeomSilver = this.geomSilver.clone();
        this.iGeomBlack = this.geomBlack.clone();
        // Invert matrix
        this.iGeomRubber.applyMatrix4(this.invMatrix);
        this.iGeomSilver.applyMatrix4(this.invMatrix);
        this.iGeomBlack.applyMatrix4(this.invMatrix);
        // Compute new normals after matrix transform
        // this.invertNormals(this.iGeomRubber);
        this.iGeomRubber.computeVertexNormals();
        this.iGeomSilver.computeVertexNormals();
        this.iGeomBlack.computeVertexNormals();
        var iMatRubber = this.matRubber.clone();
        var iMatSilver = this.matSilver.clone();
        var iMatBlack = this.matBlack.clone();
        iMatRubber.side = THREE.BackSide;
        iMatSilver.side = THREE.BackSide;
        iMatBlack.side = THREE.BackSide;
        this.iMeshRubber = new THREE.Mesh(this.iGeomRubber, iMatRubber);
        this.iMeshSilver = new THREE.Mesh(this.iGeomSilver, iMatSilver);
        this.iMeshBlack = new THREE.Mesh(this.iGeomBlack, iMatBlack);
        // Front right
        this.wheelFR = new THREE.Group();
        this.wheelFR.add(this.iMeshRubber);
        this.wheelFR.add(this.iMeshSilver);
        this.wheelFR.add(this.iMeshBlack);
        this.wheelFR.position.set(this.wPosF, this.wPosY, this.wPosR);
        this.parent.add(this.wheelFR);
        // Back right
        this.wheelBR = this.wheelFR.clone();
        this.wheelBR.position.set(this.wPosB, this.wPosY, this.wPosR);
        this.parent.add(this.wheelBR);
        // Consider using normals helper
        // let helper = new THREE.VertexNormalsHelper(this.carChassis.getObjectByName("BrakeGrid"), 40.0, 0xff9900, 1);
        // this.carChassis.add(helper);
    };
    CarWheels.prototype.addBrakes = function (_brakeGroup) {
        this.brakeBL = _brakeGroup;
        this.brMeshDisc = this.brakeBL.getObjectByName("Disc");
        this.brMeshPads = this.brakeBL.getObjectByName("Pad");
        this.brGeomDisc = this.brMeshDisc.geometry;
        this.brGeomPads = this.brMeshPads.geometry;
        this.brGeomDisc.applyMatrix4(this.ogMatrix);
        this.brGeomPads.applyMatrix4(this.ogMatrix);
        this.brGeomDisc.computeVertexNormals();
        this.brGeomPads.computeVertexNormals();
        this.brMatDisc = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHex(0x555555, THREE.LinearSRGBColorSpace),
            shininess: 100,
            flatShading: true
        });
        this.brMatPads = new THREE.MeshPhongMaterial({
            color: new THREE.Color().setHex(0x333333, THREE.LinearSRGBColorSpace),
            shininess: 50,
            flatShading: true
        });
        this.brMeshDisc.material = this.brMatDisc;
        this.brMeshPads.material = this.brMatPads;
        this.brakeBL.position.set(this.wPosB, this.wPosY, this.wPosL);
        this.parent.add(this.brakeBL);
        this.brakeFL = this.brakeBL.clone();
        this.brakeFL.position.set(this.wPosF, this.wPosY, this.wPosL);
        this.brakeFL.rotation.set(0, 0, Math.PI);
        this.parent.add(this.brakeFL);
        this.brakeFR = this.brakeBL.clone();
        this.brakeFR.position.set(this.wPosF, this.wPosY, this.wPosR);
        this.brakeFR.rotation.set(Math.PI, 0, Math.PI);
        this.parent.add(this.brakeFR);
        this.brakeBR = this.brakeBL.clone();
        this.brakeBR.position.set(this.wPosB, this.wPosY, this.wPosR);
        this.brakeBR.rotation.set(Math.PI, 0, 0);
        this.parent.add(this.brakeBR);
    };
    CarWheels.prototype.addHub = function (xPos, yPos, zPos) {
        // Origin
        var geometry = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 20);
        geometry.rotateX(Math.PI / 2);
        var material = new THREE.MeshPhongMaterial({ color: new THREE.Color().setHex(0x333333, THREE.LinearSRGBColorSpace), shininess: 50 });
        var hubSphere = new THREE.Mesh(geometry, material);
        hubSphere.position.set(xPos, yPos, zPos);
        this.parent.add(hubSphere);
        return hubSphere;
    };
    //////////////////////////////// OTHER EVENTS ////////////////////////////////
    CarWheels.prototype.turnByRadiusRatio = function (_props) {
        this.rotOverall = -_props.frameDist / CarProps_1.FF91.WheelCirc * Math.PI * 2;
        this.rotFL =
            this.rotBL =
                this.rotFR =
                    this.rotBR = Math.max(this.rotOverall, -this.maxWheelTurn);
        if (_props.wAngleSign !== 0) {
            this.ratioFO = _props.radFrontOut / _props.radBackIn;
            this.ratioBO = _props.radBackOut / _props.radBackIn;
            this.ratioFI = _props.radFrontIn / _props.radBackIn;
            this.ratioBI = 1.0;
            if (_props.wAngleSign == 1) {
                this.rotFL *= this.ratioFI;
                this.rotBL *= this.ratioBI;
                this.rotFR *= this.ratioFO;
                this.rotBR *= this.ratioBO;
                this.wheelFL.rotation.y = _props.wAngleInner;
                this.wheelFR.rotation.y = _props.wAngleOuter;
                this.brakeFL.rotation.y = _props.wAngleInner;
                this.brakeFR.rotation.y = -_props.wAngleOuter;
            }
            else {
                this.rotFL *= this.ratioFO;
                this.rotBL *= this.ratioBO;
                this.rotFR *= this.ratioFI;
                this.rotBR *= this.ratioBI;
                this.wheelFL.rotation.y = _props.wAngleOuter;
                this.wheelFR.rotation.y = _props.wAngleInner;
                this.brakeFL.rotation.y = _props.wAngleOuter;
                this.brakeFR.rotation.y = -_props.wAngleInner;
            }
            this.brakeBL.rotation.y =
                this.wheelBR.rotation.y =
                    this.wheelBL.rotation.y = utils_1.normalize(_props.speed, 22.2, 0) * _props.wAngleInner * -0.09;
            this.brakeBR.rotation.y = -this.wheelBL.rotation.y;
        }
        this.wheelFL.rotateZ(this.rotFL);
        this.wheelBL.rotateZ(this.rotBL);
        this.wheelFR.rotateZ(this.rotFR);
        this.wheelBR.rotateZ(this.rotBR);
    };
    //////////////////////////////// EVENT LISTENERS ////////////////////////////////
    CarWheels.prototype.update = function (props) {
        this.turnByRadiusRatio(props);
    };
    return CarWheels;
}());
export default CarWheels;
