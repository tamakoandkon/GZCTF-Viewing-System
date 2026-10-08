export const CHALLENGE_CATEGORIES = [
  "Misc",
  "Crypto",
  "Pwn",
  "Web",
  "Reverse",
  "Blockchain",
  "Forensics",
  "Hardware",
  "Mobile",
  "PPC",
  "AI",
  "Pentest",
  "OSINT",
] as const

export type BloodType = "Unaccepted" | "FirstBlood" | "SecondBlood" | "ThirdBlood" | "Normal"
export type ChallengeCategory = (typeof CHALLENGE_CATEGORIES)[number]

export interface SolvedChallenge {
  id: number
  score: number
  type: BloodType
  time: number
}

export interface TeamInfo {
  id: number
  name: string
  score: number
  scoreGap?: number
  rank: number
  solvedChallenges: SolvedChallenge[]
  solvedCount: number
}

export interface ChallengeInfo {
  id: number
  title: string
  category: ChallengeCategory
  score: number
  solved: number
}

export interface ScoreboardResponse {
  updateTimeUtc: number
  items: TeamInfo[]
  challenges: Record<ChallengeCategory, ChallengeInfo[]>
  challengeCount: number
}
