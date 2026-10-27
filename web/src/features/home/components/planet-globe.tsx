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
import { useEffect, useRef } from 'react'

import { useTheme } from '@/context/theme-provider'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import {
  buildGlobeMeridians,
  buildGlobeParallels,
  buildGlobeSpeckles,
  projectGlobePoint,
  type GlobeArc,
} from '../lib/globe-geometry'

const TILT = 0.38
const SPIN_SPEED = 0.11
const STATIC_ROTATION = 1.15

const MERIDIANS = buildGlobeMeridians(20)
const PARALLELS = buildGlobeParallels(20)
const SPECKLES = buildGlobeSpeckles(240)

interface GlobePalette {
  accent: string
  accentSoft: string
  surfaceInner: string
  surfaceOuter: string
  shade: string
  speckle: string
}

const PALETTES: Record<'light' | 'dark', GlobePalette> = {
  light: {
    accent: '96, 165, 250',
    accentSoft: '167, 139, 250',
    surfaceInner: '255, 255, 255',
    surfaceOuter: '219, 231, 255',
    shade: '37, 64, 128',
    speckle: '59, 110, 200',
  },
  dark: {
    accent: '125, 180, 255',
    accentSoft: '178, 152, 255',
    surfaceInner: '39, 57, 92',
    surfaceOuter: '11, 18, 33',
    shade: '2, 6, 16',
    speckle: '176, 208, 255',
  },
}

interface PlanetGlobeProps {
  className?: string
  /** Accessible description of what the canvas shows. */
  label: string
}

/**
 * Rotating wireframe globe used as the hero visual.
 *
 * Drawn on a 2D canvas rather than WebGL so it stays cheap on low-end devices
 * and needs no extra dependency. Animation pauses when the element leaves the
 * viewport or the tab is hidden, and stops entirely for reduced-motion users.
 */
export function PlanetGlobe(props: PlanetGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const palette = PALETTES[resolvedTheme === 'dark' ? 'dark' : 'light']

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    let rotation = reduceMotion ? STATIC_ROTATION : 0
    let lastTime = 0
    let visible = true
    let width = 0
    let height = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const strokeArc = (
      arc: GlobeArc,
      radius: number,
      centerX: number,
      centerY: number,
      baseAlpha: number
    ) => {
      let previousVisible = false
      ctx.beginPath()
      for (let i = 0; i < arc.lat.length; i += 1) {
        const point = projectGlobePoint(arc.lat[i], arc.lon[i], rotation, TILT)
        const onFront = point.z > 0
        const screenX = centerX + point.x * radius
        const screenY = centerY - point.y * radius
        if (onFront && previousVisible) {
          ctx.lineTo(screenX, screenY)
        } else if (onFront) {
          ctx.moveTo(screenX, screenY)
        }
        previousVisible = onFront
      }
      ctx.strokeStyle = `rgba(${palette.accent}, ${baseAlpha})`
      ctx.stroke()
    }

    const draw = () => {
      if (width === 0 || height === 0) return
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) * 0.34

      ctx.clearRect(0, 0, width, height)

      // Atmosphere halo behind the sphere.
      const halo = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.82,
        centerX,
        centerY,
        radius * 1.6
      )
      halo.addColorStop(0, `rgba(${palette.accent}, 0.22)`)
      halo.addColorStop(0.55, `rgba(${palette.accentSoft}, 0.09)`)
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, width, height)

      // Sphere body with a light source from the top-left.
      const body = ctx.createRadialGradient(
        centerX - radius * 0.4,
        centerY - radius * 0.45,
        radius * 0.15,
        centerX,
        centerY,
        radius * 1.05
      )
      body.addColorStop(0, `rgba(${palette.surfaceInner}, 0.98)`)
      body.addColorStop(0.72, `rgba(${palette.surfaceOuter}, 0.96)`)
      body.addColorStop(1, `rgba(${palette.surfaceOuter}, 0.72)`)
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fillStyle = body
      ctx.fill()

      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.clip()

      // Terminator: darken the far side so the sphere reads as lit.
      const shade = ctx.createRadialGradient(
        centerX + radius * 0.55,
        centerY + radius * 0.6,
        radius * 0.1,
        centerX + radius * 0.2,
        centerY + radius * 0.2,
        radius * 1.4
      )
      shade.addColorStop(0, `rgba(${palette.shade}, 0.16)`)
      shade.addColorStop(0.6, `rgba(${palette.shade}, 0.04)`)
      shade.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = shade
      ctx.fillRect(0, 0, width, height)

      ctx.lineWidth = 1
      for (const arc of MERIDIANS) {
        strokeArc(arc, radius, centerX, centerY, 0.16)
      }
      for (const arc of PARALLELS) {
        strokeArc(arc, radius, centerX, centerY, 0.13)
      }

      // Surface speckles give the wireframe a sense of landmass.
      for (const [lat, lon] of SPECKLES) {
        const point = projectGlobePoint(lat, lon, rotation, TILT)
        if (point.z <= 0.08) continue
        const depth = Math.min(1, point.z)
        ctx.beginPath()
        ctx.arc(
          centerX + point.x * radius,
          centerY - point.y * radius,
          1.15,
          0,
          Math.PI * 2
        )
        ctx.fillStyle = `rgba(${palette.speckle}, ${0.1 + depth * 0.4})`
        ctx.fill()
      }

      ctx.restore()

      // Rim light along the lit edge.
      const rim = ctx.createLinearGradient(
        centerX - radius,
        centerY - radius,
        centerX + radius,
        centerY + radius
      )
      rim.addColorStop(0, `rgba(${palette.accent}, 0.55)`)
      rim.addColorStop(0.5, `rgba(${palette.accent}, 0.12)`)
      rim.addColorStop(1, `rgba(${palette.accentSoft}, 0.32)`)
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.strokeStyle = rim
      ctx.lineWidth = 1.2
      ctx.stroke()

      // Tilted orbit ring for depth.
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(-0.42)
      ctx.beginPath()
      ctx.ellipse(0, 0, radius * 1.28, radius * 0.34, 0, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${palette.accentSoft}, 0.22)`
      ctx.setLineDash([3, 7])
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }

    const tick = (time: number) => {
      const delta = lastTime === 0 ? 0 : (time - lastTime) / 1000
      lastTime = time
      if (!reduceMotion) {
        rotation = (rotation + delta * SPIN_SPEED) % (Math.PI * 2)
      }
      draw()
      if (!reduceMotion && visible) {
        frame = window.requestAnimationFrame(tick)
      }
    }

    const start = () => {
      if (reduceMotion) {
        draw()
        return
      }
      window.cancelAnimationFrame(frame)
      lastTime = 0
      frame = window.requestAnimationFrame(tick)
    }

    const stop = () => {
      window.cancelAnimationFrame(frame)
    }

    resize()
    start()

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            resize()
            draw()
          })
    observer?.observe(canvas)

    const visibilityObserver =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            const entry = entries[0]
            if (!entry) return
            visible = entry.isIntersecting
            if (visible) start()
            else stop()
          })
    visibilityObserver?.observe(canvas)

    const onVisibilityChange = () => {
      if (document.hidden) stop()
      else if (visible) start()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stop()
      observer?.disconnect()
      visibilityObserver?.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [palette, reduceMotion])

  return (
    <canvas
      ref={canvasRef}
      role='img'
      aria-label={props.label}
      data-testid='home-planet-globe'
      className={cn('block h-full w-full', props.className)}
    />
  )
}
