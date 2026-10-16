const modelBase = 'https://opensource.cdn.icegl.cn/model/industry4/tesla/'

export const vehicleModels = [
  {
    id: 'modely', name: 'Model Y Performance', url: `${modelBase}modely-2025-performance.glb`,
    wheelIds: ['LF', 'RF', 'RL', 'RR'], screenNode: 'Display', screenMaterial: 'Display2', combinedScreen: true,
    rearTurnHeight: 1.0, highStopHeight: 1.25,
    lights: [
      { material: 'Glass_Lights', nodes: ['Static_Exterior'], glow: true },
      { material: 'Light_Off', nodes: ['Brake_Lights_Off'], glow: true },
      { material: 'Light_Off', nodes: ['Trunk_Cover'], glow: false },
    ],
  },
  {
    id: 'model3', name: 'Model 3 Performance', url: `${modelBase}model3-2024-performance.glb`,
    wheelIds: ['LF', 'RF', 'LR', 'RR'], screenNode: 'Screen_Front', screenMaterial: 'Front_Screen', combinedScreen: false,
    rearTurnHeight: .86, highStopHeight: 1.03,
    lights: [
      { material: 'Light', nodes: ['Lights', 'Lights_Trunk'], glow: false },
      { material: 'Glass_Lights', nodes: ['Lights_Glass', 'Lights_Glass_Trunk'], glow: true },
    ],
  },
] as const

export type VehicleModelId = typeof vehicleModels[number]['id']
export function getVehicleModel(id: unknown) { return vehicleModels.find(vehicle => vehicle.id === id) || vehicleModels[0] }
