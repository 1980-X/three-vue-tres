#define PI 3.1415926

attribute float diagonal;

uniform sampler2D heightmap;
uniform float vpH;
uniform vec2 origin;
uniform float prog;

varying float opacity;
varying float diag;

// Normalizes a value between 0 - 1
float normFloat(float n, float minVal, float maxVal){
	return max(0.0, min(1.0, (n-minVal) / (maxVal-minVal)));
}

void main() {	diag = diagonal;
	float fluctuation = -texture2D(heightmap, uv).r;

	// Endless threadmill
	vec3 newPos = position;
	newPos.xz -= origin;
	newPos.x = (fract((newPos.x + RANGE) / RANGE2) * RANGE2) - RANGE;
	newPos.z = (fract((newPos.z + RANGE) / RANGE2) * RANGE2) - RANGE;
	newPos.y = fluctuation * 0.5;

	// Size
	float size = normFloat(abs(cameraPosition.y), -0.5, 2.0) * 0.25;

	// Fade out as camera fog
	float distOrigin = distance(newPos.xz, vec2(-0.5, 0.0));
	opacity = (fluctuation + 0.5) * normFloat(distOrigin, RANGE, RANGE * 0.5);

	// Make logo
	float ffLogo = step(distOrigin, 1.7) * prog;
	//newPos.y = max(ffLogo * 0.5, newPos.y);
	opacity = max(ffLogo, opacity);
	size = max(ffLogo, size);

	// Position, size    
	vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0 );
	gl_Position = projectionMatrix * mvPosition;
	gl_PointSize = vpH * size / -mvPosition.z;
}
