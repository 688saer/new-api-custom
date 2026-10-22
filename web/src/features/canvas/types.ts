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

/** One of the caller's API keys, as listed by `/api/token/`. */
export interface CanvasApiKey {
  id: number
  name: string
  /** 1 enabled, 2 disabled, 3 expired, 4 exhausted. */
  status: number
}

/** One model the site can draw with. */
export interface CanvasImageModel {
  name: string
}

/** Fields every node on the board shares. */
interface CanvasNodeBase {
  id: string
  /** Board coordinates of the node's top-left corner. */
  x: number
  y: number
  createdAt: number
  /**
   * Node this one was derived from, drawn as a track line between the two.
   * Absent for a picture drawn from scratch or for a note.
   */
  parentId?: string
}

/** A generated picture. */
export interface CanvasImageNode extends CanvasNodeBase {
  kind: 'image'
  /** Data URL or remote link, whichever the relay answered with. */
  image: string
  prompt: string
  model: string
}

/** A free-form note, handy for keeping prompts around while iterating. */
export interface CanvasTextNode extends CanvasNodeBase {
  kind: 'text'
  text: string
}

export type CanvasNode = CanvasImageNode | CanvasTextNode

/** Camera of the board: offset in pixels plus a scale factor. */
export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

/** Everything worth restoring when the page is opened again. */
export interface CanvasBoard {
  nodes: CanvasNode[]
  viewport: CanvasViewport
}
