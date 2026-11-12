import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InteractiveArena } from '@/components/interactive-arena'
import type { TeamInfo } from '@/types/scoreboard'

const scene = vi.hoisted(() => {
  const spaceships = new Map<number, { rank: number; score: number; teamName: string }>()
  const updateTeams = vi.fn((teams: TeamInfo[]) => {
    spaceships.clear()
    for (const team of teams) spaceships.set(team.id, { rank: team.rank, score: team.score, teamName: team.name })
  })
  return { spaceships, updateTeams }
})

vi.mock('@/src/scene', () => ({
  initScene: () => ({
    dispose: vi.fn(),
    getSpaceshipManager: () => scene,
    getEarth: () => null,
    getAutoShowcaseSystem: () => null,
  }),
}))
vi.mock('@/contexts/theme-context', () => ({ useTheme: () => ({ isDark: true }) }))
vi.mock('@/hooks/useDeviceCapabilities', () => ({
  useDeviceCapabilities: () => ({ isMobile: false }),
}))

afterEach(() => {
  scene.spaceships.clear()
  scene.updateTeams.mockClear()
})

describe('InteractiveArena team sync', () => {
  it('keeps the canvas available when teams arrive after an empty snapshot', async () => {
    const { container, rerender } = render(
      <InteractiveArena events={[]} teams={[]} challenges={{} as never} />,
    )
    expect(container.querySelector('#webgl')).not.toBeNull()
    rerender(<InteractiveArena events={[]} teams={[
      { id: 2, name: 'Beta', rank: 1, score: 50, solvedCount: 0, solvedChallenges: [] },
    ]} challenges={{} as never} />)
    await waitFor(() => expect(scene.spaceships.get(2)?.score).toBe(50))
  })

  it('updates a ship label when the score changes without a rank change', async () => {
    const team = (score: number): TeamInfo => ({
      id: 1, name: 'Alpha', rank: 1, score, solvedCount: 0, solvedChallenges: [],
    })
    const { rerender } = render(
      <InteractiveArena events={[]} teams={[team(100)]} allTeams={[team(100)]} challenges={{} as never} />,
    )
    await waitFor(() => expect(scene.updateTeams).toHaveBeenCalledTimes(1))
    rerender(<InteractiveArena events={[]} teams={[team(200)]} allTeams={[team(200)]} challenges={{} as never} />)
    await waitFor(() => expect(scene.updateTeams).toHaveBeenCalledTimes(2))
    expect(scene.spaceships.get(1)?.score).toBe(200)
  })
})
