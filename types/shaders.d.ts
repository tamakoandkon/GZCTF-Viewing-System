// Type declarations for shader module imports (loaded via webpack asset/source)
declare module "*.fs" {
  const content: string
  export default content
}
declare module "*.vs" {
  const content: string
  export default content
}
declare module "*.glsl" {
  const content: string
  export default content
}
declare module "*.vert" {
  const content: string
  export default content
}
declare module "*.frag" {
  const content: string
  export default content
}

// JSON data
declare module "*/data/globe.json" {
  const data: {
    type: string
    features: Array<{
      type: string
      properties: {
        name: string
        iso_a2?: string
        iso_a3?: string
        continent?: string
      }
      geometry: {
        type: string
        coordinates: any
      }
    }>
  }
  export default data
}
