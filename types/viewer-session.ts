export interface ViewerTeam {
  id: number
  name: string
}

export interface ViewerSessionInfo {
  authenticated: true
  userName: string
  team: ViewerTeam
}

export interface ViewerLoginSuccess extends ViewerSessionInfo {
  succeeded: true
}

export interface ViewerLoginFailure {
  succeeded: false
  code:
    | "INVALID_CREDENTIALS"
    | "TEAM_REQUIRED"
    | "TEAM_SELECTION_REQUIRED"
    | "TEAM_SEAT_TAKEN"
    | "RATE_LIMITED"
    | "UPSTREAM_UNAVAILABLE"
  message: string
  teams?: ViewerTeam[]
}

export type ViewerLoginResponse = ViewerLoginSuccess | ViewerLoginFailure
