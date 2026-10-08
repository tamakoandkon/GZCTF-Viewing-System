import { describe, expect, it } from "vitest"

import {
  getActiveCategoriesFromChallenges,
  getCategoryTargetInfo,
  getCountryForCategory,
  getGameCategoryMappings,
} from "@/services/category-mapping-service"
import {
  CHALLENGE_CATEGORIES,
  type ChallengeCategory,
  type ChallengeInfo,
  type ScoreboardResponse,
} from "@/types/scoreboard"

function createChallenges(): ScoreboardResponse["challenges"] {
  const challenges = {} as Record<ChallengeCategory, ChallengeInfo[]>
  for (const category of CHALLENGE_CATEGORIES) challenges[category] = []
  challenges.Web = [{ id: 1, title: "Web Challenge", category: "Web", score: 500, solved: 5 }]
  challenges.Crypto = [{ id: 2, title: "Crypto Challenge", category: "Crypto", score: 300, solved: 3 }]
  challenges.Misc = [{ id: 3, title: "Misc Challenge", category: "Misc", score: 100, solved: 8 }]
  return challenges
}

describe("category-mapping-service", () => {
  it("returns only categories that contain public challenges", () => {
    expect(getActiveCategoriesFromChallenges(createChallenges())).toEqual(["Misc", "Crypto", "Web"])
  })

  it("maps active categories to countries with colors", () => {
    const mappings = getGameCategoryMappings(createChallenges())
    expect(Object.keys(mappings)).toEqual(["Misc", "Crypto", "Web"])
    expect(mappings.Web?.country).toBe("India")
    expect(mappings.Web?.color).toBe("#ff6b6b")
    expect(mappings.Crypto?.country).toBe("Germany")
  })

  it("returns country and color for known categories", () => {
    const info = getCategoryTargetInfo("Web")
    expect(info.country?.name).toBe("India")
    expect(info.country?.lat).toBe(20.5937)
    expect(info.color).toBe("#ff6b6b")
    expect(getCountryForCategory("Pwn")?.name).toBe("Kazakhstan")
    expect(getCountryForCategory("Forensics")?.name).toBe("Brazil")
  })

  it("returns a safe fallback for unknown categories", () => {
    const info = getCategoryTargetInfo("Unknown" as ChallengeCategory)
    expect(info.country).toBeNull()
    expect(info.color).toBe("#ffffff")
    expect(info.highlightIntensity).toBe(0.5)
  })
})
