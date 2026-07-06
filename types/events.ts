export type EventType = "Normal" | "ContainerStart" | "ContainerDestroy" | "FlagSubmit" | "CheatDetected"

export interface GameEvent {
  type: EventType
  values: string[]
  time: number
  user?: string
  team?: string
}

export type EventsResponse = GameEvent[]
