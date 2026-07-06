import { describe, it, expect } from 'vitest'
import {
  getGameCategoryMappings,
  getCategoryTargetInfo,
  getCountryForCategory,
  getActiveCategoriesFromGame,
} from '@/services/category-mapping-service'
import type { GameDetails } from '@/types/challenge'

const mockGameDetails: GameDetails = {
  id: 1,
  title: 'Test CTF',
  summary: '',
  content: '',
  hidden: false,
  divisions: null,
  inviteCodeRequired: false,
  writeupRequired: false,
  poster: null,
  limit: 0,
  teamCount: 10,
  division: null,
  teamName: null,
  practiceMode: false,
  status: 'active',
  start: Date.now(),
  end: Date.now() + 3600000,
  challenges: {
    Web: [
      { id: 1, title: 'Web Challenge', category: 'Web', score: 500, solved: 5, bloods: [], disableBloodBonus: false },
    ],
    Crypto: [
      { id: 2, title: 'Crypto Challenge', category: 'Crypto', score: 300, solved: 3, bloods: [], disableBloodBonus: false },
    ],
    Misc: [
      { id: 3, title: 'Misc Challenge', category: 'Misc', score: 100, solved: 8, bloods: [], disableBloodBonus: false },
    ],
  },
}

describe('category-mapping-service', () => {
  describe('getActiveCategoriesFromGame', () => {
    it('returns all category keys from game details', () => {
      const categories = getActiveCategoriesFromGame(mockGameDetails)
      expect(categories).toEqual(['Web', 'Crypto', 'Misc'])
    })

    it('returns empty array for game with no challenges', () => {
      const empty = { ...mockGameDetails, challenges: {} }
      expect(getActiveCategoriesFromGame(empty)).toEqual([])
    })
  })

  describe('getGameCategoryMappings', () => {
    it('maps active categories to countries with colors', () => {
      const mappings = getGameCategoryMappings(mockGameDetails)
      expect(Object.keys(mappings)).toEqual(['Web', 'Crypto', 'Misc'])
      expect(mappings.Web.country).toBe('India')
      expect(mappings.Web.color).toBe('#ff6b6b')
      expect(mappings.Crypto.country).toBe('Germany')
    })

    it('skips categories not in the fixed mapping', () => {
      const custom = {
        ...mockGameDetails,
        challenges: { UnknownCategory: [{ id: 99, title: 'X', category: 'Unknown', score: 1, solved: 0, bloods: [], disableBloodBonus: false }] },
      }
      const mappings = getGameCategoryMappings(custom as any)
      expect(Object.keys(mappings)).toEqual([])
    })
  })

  describe('getCategoryTargetInfo', () => {
    it('returns country and color for Web category', () => {
      const info = getCategoryTargetInfo('Web')
      expect(info.country?.name).toBe('India')
      expect(info.country?.lat).toBe(20.5937)
      expect(info.color).toBe('#ff6b6b')
    })

    it('returns fallback for unknown category', () => {
      const info = getCategoryTargetInfo('Unknown' as any)
      expect(info.country).toBeNull()
      expect(info.color).toBe('#ffffff')
      expect(info.highlightIntensity).toBe(0.5)
    })

    it('Pwn maps to Kazakhstan', () => {
      const info = getCategoryTargetInfo('Pwn')
      expect(info.country?.name).toBe('Kazakhstan')
    })

    it('Forensics maps to Brazil', () => {
      const info = getCategoryTargetInfo('Forensics')
      expect(info.country?.name).toBe('Brazil')
    })
  })

  describe('getCountryForCategory', () => {
    it('returns country object for valid category', () => {
      const country = getCountryForCategory('Web')
      expect(country?.name).toBe('India')
      expect(country?.region).toBe('Asia')
      expect(country?.importance).toBe('high')
    })

    it('returns null for unmapped category', () => {
      expect(getCountryForCategory('Unknown' as any)).toBeNull()
    })
  })
})
