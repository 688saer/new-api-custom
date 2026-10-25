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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

import type { RewardStyle, RewardTicketCopy } from '../types'
import { REWARD_STYLES } from '../types'

const STYLE_LABEL_KEYS: Record<RewardStyle, string> = {
  aurora: 'Aurora',
  citrus: 'Citrus',
  sunrise: 'Sunrise',
  nocturne: 'Nocturne',
}

interface RewardCopyFieldsProps {
  style: RewardStyle
  copy: RewardTicketCopy
  onStyleChange: (style: RewardStyle) => void
  onCopyChange: (patch: Partial<RewardTicketCopy>) => void
  t: (key: string) => string
}

/** 券面内容：样式与各段文案，改动会即时反映在右侧预览上。 */
export function RewardCopyFields(props: RewardCopyFieldsProps) {
  const copy = props.copy

  return (
    <fieldset className='space-y-4 border-t pt-6'>
      <legend className='text-sm font-semibold'>
        {props.t('Ticket content')}
      </legend>

      <div className='space-y-2'>
        <Label htmlFor='reward-style'>{props.t('Style')}</Label>
        <NativeSelect
          id='reward-style'
          value={props.style}
          onChange={(event) =>
            props.onStyleChange(event.target.value as RewardStyle)
          }
        >
          {REWARD_STYLES.map((style) => (
            <NativeSelectOption key={style} value={style}>
              {props.t(STYLE_LABEL_KEYS[style])}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='reward-title'>{props.t('Ticket title')}</Label>
        <Input
          id='reward-title'
          value={copy.title}
          maxLength={60}
          onChange={(event) =>
            props.onCopyChange({ title: event.target.value })
          }
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='reward-subtitle'>{props.t('Ticket subtitle')}</Label>
        <Input
          id='reward-subtitle'
          value={copy.subtitle}
          maxLength={200}
          onChange={(event) =>
            props.onCopyChange({ subtitle: event.target.value })
          }
        />
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='reward-label'>{props.t('Top label')}</Label>
          <Input
            id='reward-label'
            value={copy.label}
            maxLength={30}
            onChange={(event) =>
              props.onCopyChange({ label: event.target.value })
            }
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='reward-stub'>{props.t('Stub text')}</Label>
          <Input
            id='reward-stub'
            value={copy.stub_text}
            maxLength={12}
            onChange={(event) =>
              props.onCopyChange({ stub_text: event.target.value })
            }
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='reward-footer'>{props.t('Footer text')}</Label>
        <Input
          id='reward-footer'
          value={copy.footer}
          maxLength={160}
          onChange={(event) =>
            props.onCopyChange({ footer: event.target.value })
          }
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='reward-button'>{props.t('Claim button text')}</Label>
        <Input
          id='reward-button'
          value={copy.button_text}
          maxLength={20}
          onChange={(event) =>
            props.onCopyChange({ button_text: event.target.value })
          }
        />
      </div>
    </fieldset>
  )
}
