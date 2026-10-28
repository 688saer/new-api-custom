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

/** 取一张工单图片的字节，两侧各自传入带令牌的客户端。 */
export type TicketImageLoader = (attachmentId: number) => Promise<Blob>

/**
 * 工单图片接口需要会话凭据，不能直接放进 <img src>。
 * 这里用调用方给的 loader 取回图片，转成 objectURL，组件卸载时释放。
 */
export function useTicketImage(
  attachmentId: number,
  load: TicketImageLoader
): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!attachmentId) {
      setUrl(null)
      return
    }

    let revoked = false
    let objectUrl: string | null = null

    void load(attachmentId)
      .then((blob) => {
        // 接口出错时会返回 JSON 错误体，别把它当成图片渲染
        if (blob.type && !blob.type.startsWith('image/')) {
          throw new Error('attachment is not an image')
        }
        if (revoked) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!revoked) setUrl(null)
      })

    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachmentId, load])

  return url
}
