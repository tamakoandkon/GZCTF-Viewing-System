import { describe, expect, it } from 'vitest'

import {
  COUNTRY_FILL_NAMES,
  getCountryCoordinates,
  getCountryStandardName,
  isFillCountry,
} from '@/src/globe/earth/data'

describe('earth country data', () => {
  it('keeps the documented fill list at 45 countries', () => {
    expect(COUNTRY_FILL_NAMES.size).toBe(45)
  })

  it('normalizes GeoJSON short names to the names used by the renderer', () => {
    expect(getCountryStandardName('Dem. Rep. Congo')).toBe('Democratic Republic of the Congo')
    expect(getCountryStandardName('S. Sudan')).toBe('South Sudan')
    expect(getCountryStandardName("Côte d'Ivoire")).toBe('Ivory Coast')
    expect(getCountryStandardName('Serbia')).toBe('Republic of Serbia')
  })

  it('fills alias countries that are present in globe.json', () => {
    expect(isFillCountry('Dem. Rep. Congo')).toBe(true)
    expect(isFillCountry('S. Sudan')).toBe(true)
    expect(isFillCountry('Tanzania')).toBe(true)
    expect(isFillCountry('China')).toBe(false)
  })

  it('resolves fallback coordinates through aliases', () => {
    expect(getCountryCoordinates('Serbia')).toEqual({ lat: 44.0165, lng: 21.0059 })
    expect(getCountryCoordinates('Dem. Rep. Congo')).toEqual({
      lat: -4.0383,
      lng: 21.7587,
    })
    expect(getCountryCoordinates('China')).toBeNull()
  })
})
