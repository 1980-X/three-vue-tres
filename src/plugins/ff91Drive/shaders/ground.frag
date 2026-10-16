uniform sampler2D led;
uniform vec3 color;

varying float opacity;
varying float diag;

void main() {
	// Multiplicative
    // gl_FragColor = -texture2D( led, vec2(abs(diag - gl_PointCoord.x), gl_PointCoord.y )) * opacity;
    // gl_FragColor += 1.0;

	// Additive
    gl_FragColor = texture2D( led, vec2(abs(diag - gl_PointCoord.x), gl_PointCoord.y )) * vec4(color, opacity);
}
