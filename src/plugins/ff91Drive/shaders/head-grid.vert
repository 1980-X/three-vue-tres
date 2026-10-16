float normFloat(float n, float minVal, float maxVal){
	return max(0.0, min(1.0, (n-minVal) / (maxVal-minVal)));
}

// Returns 1 if type matches val, 0 if not
float checkType(float type, float val){
	return step(val - 0.1, type) * step(type, val + 0.1);
}

uniform vec3 lightsT;
uniform vec3 lightsO;
attribute float type;
varying float wht;
varying float amb;

// z-up position because Blender is weird like that
void main() {
	vec2 posXY = vec2(position.y - 2299.0, position.z - 1355.0);
	float distOrigin = distance(posXY, vec2(0.0));   // FF Logo

	// 0: Daytime running lights
	wht = checkType(type, 0.0);
	
	// 1: nightlights
	wht += checkType(type, 1.0) * lightsO.y;
	
	// 2: high beams
	wht += checkType(type, 2.0) * lightsO.z;
	
	// 3: right turn signal
	wht += checkType(type, 3.0) * (1.0 - lightsT.x);
	amb = checkType(type, 3.0) * lightsT.z;
	
	// 4: left turn signal
	wht += checkType(type, 4.0) * (1.0 + lightsT.x);
	amb += checkType(type, 4.0) * lightsT.y;

	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0 );
}
