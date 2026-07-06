export interface Challenge {
  id: number
  title: string
  category: string
  score: number
  solved: number
  bloods: Array<{
    id: number
    name: string
    avatar: string | null
    submitTimeUtc: number | null
  }>
  disableBloodBonus: boolean
}

export interface ChallengeDetail {
  id: number
  title: string
  category: string
  content: string
  hints: Array<{
    id: number
    content: string
    cost: number
  }>
  attachments: Array<{
    id: number
    name: string
    url: string
  }>
  score: number
  solved: number
  bloods: Array<{
    id: number
    name: string
    avatar: string | null
    submitTimeUtc: number | null
  }>
  disableBloodBonus: boolean
}

export interface GameDetails {
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
  status: string
  start: number
  end: number
  challenges: Record<string, Challenge[]>
}
