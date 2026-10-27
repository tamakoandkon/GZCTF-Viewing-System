import { describe, expect, it } from 'vitest'

import { latLngToVector3, removeDuplicatePoints } from '@/src/globe/earth/geometry'

describe('earth geometry helpers', () => {
  it('projects lat/lng onto the requested sphere radius', () => {
    const point = latLngToVector3(0, 0, 100)
    expect(point.length()).toBeCloseTo(100, 5)
  })

  it('removes duplicate lat/lng pairs while preserving order', () => {
    const points = [
      { lat: 1, lng: 2, name: 'a' },
      { lat: 1, lng: 2, name: 'b' },
      { lat: 3, lng: 4, name: 'c' },
    ]
    expect(removeDuplicatePoints(points)).toEqual([
      { lat: 1, lng: 2, name: 'a' },
      { lat: 3, lng: 4, name: 'c' },
    ])
  })
})
