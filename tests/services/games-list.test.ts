import { describe, it, expect } from 'vitest'
import {
  getActiveGames,
  getUpcomingGames,
  getEndedGames,
  sortGamesByRecent,
  getGameStatus,
  getGameStatusText,
  formatGameTime,
  type GameInfo,
} from '@/services/games-list-service'

const now = Date.now()
const hour = 3600000

const mockGames: GameInfo[] = [
  { id: 1, title: 'Active CTF', summary: '', poster: null, limit: 0, start: now - hour, end: now + hour },
  { id: 2, title: 'Upcoming CTF', summary: '', poster: null, limit: 0, start: now + hour, end: now + 2 * hour },
  { id: 3, title: 'Ended CTF', summary: '', poster: null, limit: 0, start: now - 2 * hour, end: now - hour },
  { id: 4, title: 'Old CTF', summary: '', poster: null, limit: 0, start: now - 5 * hour, end: now - 3 * hour },
]

describe('games-list-service', () => {
  describe('getActiveGames', () => {
    it('returns only currently running games', () => {
      const active = getActiveGames(mockGames)
      expect(active).toHaveLength(1)
      expect(active[0].title).toBe('Active CTF')
    })
  })

  describe('getUpcomingGames', () => {
    it('returns games that have not started', () => {
      const upcoming = getUpcomingGames(mockGames)
      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].title).toBe('Upcoming CTF')
    })
  })

  describe('getEndedGames', () => {
    it('returns finished games', () => {
      const ended = getEndedGames(mockGames)
      expect(ended).toHaveLength(2)
      expect(ended.map(g => g.title)).toEqual(['Ended CTF', 'Old CTF'])
    })
  })

  describe('sortGamesByRecent', () => {
    it('sorts by start time descending', () => {
      const sorted = sortGamesByRecent(mockGames)
      expect(sorted[0].title).toBe('Upcoming CTF')
      expect(sorted[3].title).toBe('Old CTF')
    })

    it('returns a new array (does not mutate)', () => {
      const original = [...mockGames]
      const sorted = sortGamesByRecent(mockGames)
      expect(sorted).not.toBe(mockGames)
      expect(mockGames).toEqual(original)
    })
  })

  describe('getGameStatus', () => {
    it('returns active for running game', () => {
      expect(getGameStatus(mockGames[0])).toBe('active')
    })
    it('returns upcoming for future game', () => {
      expect(getGameStatus(mockGames[1])).toBe('upcoming')
    })
    it('returns ended for past game', () => {
      expect(getGameStatus(mockGames[2])).toBe('ended')
    })
  })

  describe('getGameStatusText', () => {
    it('returns Chinese status text', () => {
      expect(getGameStatusText(mockGames[0])).toContain('进行中')
      expect(getGameStatusText(mockGames[1])).toContain('即将开始')
      expect(getGameStatusText(mockGames[2])).toContain('已结束')
    })
  })

  describe('formatGameTime', () => {
    it('formats timestamp to locale string', () => {
      const formatted = formatGameTime(1700000000000)
      expect(typeof formatted).toBe('string')
      expect(formatted.length).toBeGreaterThan(0)
    })
  })
})
