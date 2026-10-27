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

/**
 * Globe projection helpers.
 *
 * The hero globe is drawn on a 2D canvas: points are projected from the unit
 * sphere to screen space and only the front hemisphere (z > 0) is stroked, so
 * the wireframe reads as a solid rotating sphere instead of a flat disc.
 */
export interface GlobePoint {
  /** Horizontal position on the unit sphere, -1 (left) to 1 (right). */
  x: number
  /** Vertical position on the unit sphere, -1 (bottom) to 1 (top). */
  y: number
  /** Depth on the unit sphere, 1 faces the viewer and -1 faces away. */
  z: number
}

export interface GlobeArc {
  /** Latitude of every sampled point, in degrees. */
  lat: number[]
  /** Longitude of every sampled point, in degrees. */
  lon: number[]
}

const DEG_TO_RAD = Math.PI / 180

/**
 * Project a latitude/longitude pair onto the unit sphere.
 *
 * `rotation` spins the globe around its vertical axis and `tilt` leans that
 * axis towards the viewer, which is what makes the poles visible.
 */
export function projectGlobePoint(
  latDeg: number,
  lonDeg: number,
  rotation: number,
  tilt: number
): GlobePoint {
  const lat = latDeg * DEG_TO_RAD
  const lon = lonDeg * DEG_TO_RAD + rotation

  const ringRadius = Math.cos(lat)
  const x = ringRadius * Math.sin(lon)
  const y = Math.sin(lat)
  const z = ringRadius * Math.cos(lon)

  const cosTilt = Math.cos(tilt)
  const sinTilt = Math.sin(tilt)

  return {
    x,
    y: y * cosTilt - z * sinTilt,
    z: y * sinTilt + z * cosTilt,
  }
}

/** Meridians run pole to pole; one arc per `stepDeg` of longitude. */
export function buildGlobeMeridians(stepDeg = 20): GlobeArc[] {
  const arcs: GlobeArc[] = []
  for (let lon = -180; lon < 180; lon += stepDeg) {
    const lat: number[] = []
    const lonList: number[] = []
    for (let l = -90; l <= 90; l += 3) {
      lat.push(l)
      lonList.push(lon)
    }
    arcs.push({ lat, lon: lonList })
  }
  return arcs
}

/** Parallels are horizontal rings; one arc per `stepDeg` of latitude. */
export function buildGlobeParallels(stepDeg = 20): GlobeArc[] {
  const arcs: GlobeArc[] = []
  for (let lat = -90 + stepDeg; lat < 90; lat += stepDeg) {
    const latList: number[] = []
    const lon: number[] = []
    for (let l = -180; l <= 180; l += 3) {
      latList.push(lat)
      lon.push(l)
    }
    arcs.push({ lat: latList, lon })
  }
  return arcs
}

/**
 * Deterministic surface speckles that read as landmass from a distance.
 *
 * A fixed seed keeps the pattern identical across renders and reloads, so the
 * globe never flickers between two shapes.
 */
export function buildGlobeSpeckles(count = 220): Array<[number, number]> {
  const points: Array<[number, number]> = []
  let seed = 20261027
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  for (let i = 0; i < count; i += 1) {
    // asin of a uniform value spreads points evenly over the sphere area.
    const lat = Math.asin(random() * 2 - 1) / DEG_TO_RAD
    const lon = random() * 360 - 180
    points.push([lat, lon])
  }
  return points
}
