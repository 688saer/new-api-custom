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
import { useEffect, useState } from 'react'

/**
 * 工单图片接口需要会话凭据，不能直接放进 <img src>。
 * 这里把图片取成 blob 并生成 objectURL，组件卸载时释放。
 */
export function useTicketImage(attachmentId: number): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!attachmentId) {
      setUrl(null)
      return
    }

    let revoked = false
    let objectUrl: string | null = null
    const controller = new AbortController()

    void fetch(`/api/user/ticket-uploads/${attachmentId}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('image request failed')
        return response.blob()
      })
      .then((blob) => {
        if (revoked) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!revoked) setUrl(null)
      })

    return () => {
      revoked = true
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachmentId])

  return url
}
