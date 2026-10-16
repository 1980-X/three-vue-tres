#define RED vec3(1.0, 0.1, 0.1) // red
#define AMB vec3(1.0, 0.6, 0.1)	// amber
#define WHT vec3(1.0, 1.0, 1.0)	// white

varying float red;
varying float amb;
varying float wht;
varying float brightness;

void main() {
	gl_FragColor = vec4((RED * red + AMB * amb) * brightness, 1.0);
}
