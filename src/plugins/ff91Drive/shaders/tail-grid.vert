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

 	vec3 realPos = vec3(modelMatrix * vec4(position, 1.0));
	vec3 realNorm = normalize(vec3(modelMatrix * vec4(normal, 0.0)));

	vec3 lightVector = normalize(cameraPosition - realPos);
	brightness = dot(realNorm, lightVector);
	brightness = normFloat(brightness, 0.3, 0.2) + 0.5;
	brightness *= brightness * brightness;
	
	// Type 0: FF logo	
	red = checkType(type, 0.0);
	// FF brightens on stop light
	red += red * lightsO.x;

	// Type 1: center grid
	red += checkType(type, 1.0) * NIGHTLIGHT;

	// Type 2: Right blinker
	red += (checkType(type, 2.0) * NIGHTLIGHT) * step(lightsT.x, 0.0);
	amb = checkType(type, 2.0) * lightsT.z;

	// Type 3: Left blinker
	red += (checkType(type, 3.0) * NIGHTLIGHT) * step(0.0, lightsT.x);
	amb += checkType(type, 3.0) * lightsT.y;
	
	brightness = clamp(brightness, 0.0, 1.0);
}
