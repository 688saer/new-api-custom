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
 * Portrait illustrations shown inside the mascot's speech bubble.
 *
 * The animated clips are video, but a still frame cannot cheer or apologise,
 * so a small set of drawn reactions accompanies the bubble. Each entry is a
 * mood the click response can land on; the greeting always uses the first.
 */
export interface MascotPortrait {
  /** File stem under `public/mascot/portraits`. */
  id: string
  /** Roughly what the picture conveys, used to match it to a context. */
  mood: string
}

export const MASCOT_PORTRAITS: readonly MascotPortrait[] = [
  { id: 'hi', mood: 'greeting' },
  { id: 'happy', mood: 'delighted' },
  { id: 'cheer', mood: 'celebrating' },
  { id: 'wink', mood: 'playful' },
  { id: 'think', mood: 'thinking' },
  { id: 'proud', mood: 'confident' },
  { id: 'sorry', mood: 'apologetic' },
  { id: 'cry', mood: 'upset' },
  { id: 'shock', mood: 'surprised' },
  { id: 'sleepy', mood: 'tired' },
  { id: 'love', mood: 'friendly' },
  { id: 'wave', mood: 'helpful' },
]

export const MASCOT_PORTRAIT_BASE = '/mascot/portraits'

export function portraitUrl(id: string): string {
  return `${MASCOT_PORTRAIT_BASE}/${id}.png`
}

/** The portrait used for the first-visit greeting. */
export const GREETING_PORTRAIT = MASCOT_PORTRAITS[0]

/** A cheerful portrait for a click, excluding the greeting one so it reads as a reaction. */
export function randomReactionPortrait(random: () => number = Math.random): MascotPortrait {
  const reactions = MASCOT_PORTRAITS.filter((portrait) => portrait.id !== GREETING_PORTRAIT.id)
  // Clamp the index: an RNG that returns exactly 1 would otherwise read past the
  // end and hand back undefined.
  const index = Math.min(Math.floor(random() * reactions.length), reactions.length - 1)
  return reactions[index]
}
