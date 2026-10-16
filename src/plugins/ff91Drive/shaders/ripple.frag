precision highp float;
precision highp int;

#include <common>

uniform vec2 ripplePos;
uniform float rippleSize;
uniform float viscosity;
uniform float rippleImpact;
uniform sampler2D heightmap;

#define deltaTime ( 1.0 / 60.0 )
#define GRAVITY_CONSTANT ( resolution.x * deltaTime * 1.0 )

out vec4 outColor;

void main()	{

	vec2 cellSize = 1.0 / resolution.xy;

	vec2 uv = gl_FragCoord.xy * cellSize;

	// heightmapValue.x == height
	// heightmapValue.y == velocity
	// heightmapValue.z, heightmapValue.w not used
	vec4 heightmapValue = texture( heightmap, uv );

	// Get neighbours
	float north = texture( heightmap, uv + vec2( 0.0, cellSize.y ) ).r;
	float south = texture( heightmap, uv + vec2( 0.0, - cellSize.y ) ).r;
	float east = texture( heightmap, uv + vec2( cellSize.x, 0.0 ) ).r;
	float west = texture( heightmap, uv + vec2( - cellSize.x, 0.0 ) ).r;

	float sump = north + south + east + west - 4.0 * heightmapValue.x;

	float accel = sump * GRAVITY_CONSTANT;

	// Dynamics
	heightmapValue.y += accel;
	heightmapValue.x += heightmapValue.y * deltaTime;

	// Viscosity
	heightmapValue.x += sump * viscosity;

	// Mouse influence
	float mousePhase = clamp( 
		length(( uv - vec2( 0.5 ) ) * BOUNDS - vec2( ripplePos.x, - ripplePos.y ) ) * PI / rippleSize, 
		0.0, 
		PI
	);
	heightmapValue.x += (cos( mousePhase ) + 1.0) * rippleImpact;

	// Bring X back to 0 over time to prevent endless growth
	heightmapValue.x *= 0.998;

	// outColor = vec4(heightmapValue.x, 0.0, 0.0, 1.0);
	outColor = heightmapValue;
}
