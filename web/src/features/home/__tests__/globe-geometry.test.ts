/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, it } from 'vitest'

import {
  buildGlobeMeridians,
  buildGlobeParallels,
  buildGlobeSpeckles,
  projectGlobePoint,
} from '../lib/globe-geometry'

describe('globe projection', () => {
  it('places the point facing the viewer at the centre of the disc', () => {
    const point = projectGlobePoint(0, 0, 0, 0)

    expect(point.x).toBeCloseTo(0, 6)
    expect(point.y).toBeCloseTo(0, 6)
    expect(point.z).toBeCloseTo(1, 6)
  })

  it('puts the opposite meridian on the far hemisphere', () => {
    const point = projectGlobePoint(0, 180, 0, 0)

    expect(point.z).toBeCloseTo(-1, 6)
  })

  it('rotating the globe by 90 degrees moves the prime meridian to the edge', () => {
    const point = projectGlobePoint(0, 0, Math.PI / 2, 0)

    expect(point.x).toBeCloseTo(1, 6)
    expect(point.z).toBeCloseTo(0, 6)
  })

  it('projects the north pole to the top of the sphere', () => {
    const point = projectGlobePoint(90, 45, 0, 0)

    expect(point.y).toBeCloseTo(1, 6)
    expect(point.x).toBeCloseTo(0, 6)
  })

  it('tilting leans the north pole towards the viewer', () => {
    const point = projectGlobePoint(90, 0, 0, Math.PI / 2)

    expect(point.y).toBeCloseTo(0, 6)
    expect(point.z).toBeCloseTo(1, 6)
  })

  it('keeps every projected point on the unit sphere', () => {
    for (const lat of [-80, -35, 0, 42, 77]) {
      for (const lon of [-170, -90, 0, 65, 155]) {
        const point = projectGlobePoint(lat, lon, 1.1, 0.4)
        const length = Math.hypot(point.x, point.y, point.z)
        expect(length).toBeCloseTo(1, 6)
      }
    }
  })
})

describe('globe grid generation', () => {
  it('builds one meridian per 20 degrees of longitude, each pole to pole', () => {
    const meridians = buildGlobeMeridians(20)

    expect(meridians).toHaveLength(18)
    expect(meridians[0].lat).toHaveLength(61)
    expect(meridians[0].lat[0]).toBe(-90)
    expect(meridians[0].lat[60]).toBe(90)
    expect(new Set(meridians[0].lon)).toEqual(new Set([-180]))
  })

  it('builds parallels that stop short of both poles', () => {
    const parallels = buildGlobeParallels(20)

    expect(parallels).toHaveLength(8)
    expect(parallels[0].lat[0]).toBe(-70)
    expect(parallels[7].lat[0]).toBe(70)
    expect(parallels[0].lon[0]).toBe(-180)
    expect(parallels[0].lon.at(-1)).toBe(180)
  })

  it('produces a denser grid when the step shrinks', () => {
    expect(buildGlobeMeridians(10)).toHaveLength(36)
    expect(buildGlobeParallels(10)).toHaveLength(17)
  })
})

describe('globe speckles', () => {
  it('reproduces the same pattern on every call', () => {
    expect(buildGlobeSpeckles(24)).toEqual(buildGlobeSpeckles(24))
  })

  it('keeps coordinates inside the latitude and longitude ranges', () => {
    for (const [lat, lon] of buildGlobeSpeckles(200)) {
      expect(lat).toBeGreaterThanOrEqual(-90)
      expect(lat).toBeLessThanOrEqual(90)
      expect(lon).toBeGreaterThanOrEqual(-180)
      expect(lon).toBeLessThanOrEqual(180)
    }
  })

  it('extends a shorter pattern rather than reshuffling it', () => {
    const short = buildGlobeSpeckles(5)
    const long = buildGlobeSpeckles(20)

    expect(long.slice(0, 5)).toEqual(short)
  })
})
