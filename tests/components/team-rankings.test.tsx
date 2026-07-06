import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeamRankings } from '@/components/team-rankings'
import type { TeamInfo } from '@/types/scoreboard'
import { ThemeProvider } from '@/contexts/theme-context'

const mockTeams: TeamInfo[] = [
  { id: 1, name: 'Alpha', rank: 1, score: 5000, solvedCount: 5, bio: null, division: null, avatar: null, divisionRank: null, lastSubmissionTime: 0, solvedChallenges: [] },
  { id: 2, name: 'Beta', rank: 2, score: 4000, solvedCount: 4, bio: null, division: null, avatar: null, divisionRank: null, lastSubmissionTime: 0, solvedChallenges: [] },
  { id: 3, name: 'Gamma', rank: 3, score: 3000, solvedCount: 3, bio: null, division: null, avatar: null, divisionRank: null, lastSubmissionTime: 0, solvedChallenges: [] },
  { id: 4, name: 'Delta', rank: 4, score: 2000, solvedCount: 2, bio: null, division: null, avatar: null, divisionRank: null, lastSubmissionTime: 0, solvedChallenges: [] },
  { id: 5, name: 'Epsilon', rank: 5, score: 1000, solvedCount: 1, bio: null, division: null, avatar: null, divisionRank: null, lastSubmissionTime: 0, solvedChallenges: [] },
]

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe('TeamRankings', () => {
  it('renders all provided teams', () => {
    renderWithTheme(<TeamRankings teams={mockTeams} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
    expect(screen.getByText('Delta')).toBeInTheDocument()
    expect(screen.getByText('Epsilon')).toBeInTheDocument()
  })

  it('renders scores', () => {
    renderWithTheme(<TeamRankings teams={mockTeams} />)
    expect(screen.getByText('5,000 pts')).toBeInTheDocument()
    expect(screen.getByText('1,000 pts')).toBeInTheDocument()
  })

  it('renders solved counts', () => {
    renderWithTheme(<TeamRankings teams={mockTeams} />)
    const count5 = screen.getByText('5 题')
    const count1 = screen.getByText('1 题')
    expect(count5).toBeInTheDocument()
    expect(count1).toBeInTheDocument()
  })

  it('shows group info when provided', () => {
    renderWithTheme(
      <TeamRankings
        teams={mockTeams}
        groupInfo={{ currentGroup: 1, totalGroups: 2, totalTeams: 10 }}
      />
    )
    expect(screen.getByText(/GROUP 1 \/ 2/)).toBeInTheDocument()
  })

  it('shows empty state when no teams', () => {
    renderWithTheme(<TeamRankings teams={[]} />)
    expect(screen.getByText('暂无队伍数据')).toBeInTheDocument()
  })

  it('shows rank numbers for all teams', () => {
    renderWithTheme(<TeamRankings teams={mockTeams} />)
    // Rank numbers appear as text within rank badges
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
