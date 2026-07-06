export type TeamStatus = "Pending" | "Accepted" | "Rejected" | "Suspended" | "Unsubmitted"

export interface GameDetail {
  id: number
  title: string
  summary: string
  content: string
  hidden: boolean
  divisions: string[] | null
  inviteCodeRequired: boolean
  writeupRequired: boolean
  poster: string | null
  limit: number
  teamCount: number
  division: string | null
  teamName: string | null
  practiceMode: boolean
  status: TeamStatus
  start: number
  end: number
}
