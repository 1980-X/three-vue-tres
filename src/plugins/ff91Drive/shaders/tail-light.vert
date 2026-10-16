#define NIGHTLIGHT 0.4

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
varying float red;
varying float amb;
varying float wht;
varying float brightness;

void main(){
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0 );
	brightness = 1.0;

	// Type 0: Reverse light?

	// Type 1: Right blinker
	amb = checkType(type, 1.0) * lightsT.z;

	// Type 2: Left blinker
	amb += checkType(type, 2.0) * lightsT.y;

	// Type 3: Side brakelights & side nightlights
	red = checkType(type, 3.0) * (NIGHTLIGHT + lightsO.x * (1.0 - NIGHTLIGHT));

	// Type 4: Center brakelight
	red += checkType(type, 4.0) * lightsO.x;

	// Type 5: Center nightlight
	red += checkType(type, 5.0) * NIGHTLIGHT;

	// Type 6: Lower foglights off
	red += checkType(type, 6.0) * NIGHTLIGHT * 0.2;

	// Type 7: Lower foglights on
	red += checkType(type, 7.0) * NIGHTLIGHT * 1.5;
}
