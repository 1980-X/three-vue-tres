uniform sampler2D tSprite;
varying float brightness;
varying vec2 vUV;

// Normalizes a value between 0 - 1
float normFloat(float n, float minVal, float maxVal){
    return max(0.0, min(1.0, (n-minVal) / (maxVal-minVal)));
}

void main() {
	// Additive
    gl_FragColor = texture2D( tSprite, vUV) * brightness;

	// Subtractive
	// gl_FragColor = texture2D( tSprite, gl_PointCoord ) - vec4( color, 1.0 );
	// gl_FragColor *= opacity;

	// Multip
	/* gl_FragColor = -texture2D( tSprite, gl_PointCoord ) * opacity;
	gl_FragColor *= 1.0 - vec4( color, 1.0 );
	gl_FragColor += 1.0; */
}
