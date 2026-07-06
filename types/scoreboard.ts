export type BloodType = "Unaccepted" | "FirstBlood" | "SecondBlood" | "ThirdBlood" | "Normal"

export type ChallengeCategory =
  | "Misc"
  | "Crypto"
  | "Pwn"
  | "Web"
  | "Reverse"
  | "Blockchain"
  | "Forensics"
  | "Hardware"
  | "Mobile"
  | "PPC"
  | "AI"
  | "Pentest"
  | "OSINT"

export interface TimelineItem {
  time: number
  score: number
}

export interface TeamTimeline {
  id: number
  name: string
  items: TimelineItem[]
}
  
export interface SolvedChallenge {
  id: number
  score: number
  type: BloodType
  userName: string | null
  time: number
}

export interface TeamInfo {
  id: number
  name: string
  bio: string | null
  division: string | null
  avatar: string | null
  score: number
  scoreGap?: number
  rank: number
  divisionRank: number | null
  lastSubmissionTime: number
  solvedChallenges: SolvedChallenge[]
  solvedCount: number
}

export interface BloodInfo {
  id: number
  name: string
  avatar: string | null
  submitTimeUtc: number | null
}

export interface ChallengeInfo {
  id: number
  title: string
  category: ChallengeCategory
  score: number
  solved: number
  bloods: BloodInfo[]
  disableBloodBonus: boolean
}

export interface ScoreboardResponse {
  updateTimeUtc: number
  bloodBonus: number
  timeLines: Record<string, TeamTimeline[]>
  items: TeamInfo[]
  challenges: Record<ChallengeCategory, ChallengeInfo[]>
  challengeCount: number
}
