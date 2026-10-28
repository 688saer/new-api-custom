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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Loader2, Sparkles, X } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { listApiKeys, listImageModels } from '../api'

/** Aspect ratios the image relays in front of this console usually accept. */
const SIZE_OPTIONS = ['1024x1024', '1536x1024', '1024x1536', '512x512']

const COUNT_OPTIONS = ['1', '2', '3', '4']

/** Everything the panel edits, held by the workspace so nodes can drive it. */
export interface CanvasDraft {
  apiKeyId: string
  model: string
  size: string
  count: string
  prompt: string
}

/** An image node chosen as the basis for the next request. */
export interface CanvasReference {
  id: string
  image: string
}

interface CanvasPromptPanelProps {
  draft: CanvasDraft
  onDraftChange: (patch: Partial<CanvasDraft>) => void
  generating: boolean
  reference: CanvasReference | null
  /** Prompts that already ran this session, newest first. */
  recentPrompts?: string[]
  onClearReference: () => void
  onGenerate: () => void
  className?: string
}

/** Prompt plus the site resources needed to draw with: one key and one model. */
export function CanvasPromptPanel(props: CanvasPromptPanelProps) {
  const { t } = useTranslation()

  const keysQuery = useQuery({
    queryKey: ['canvas', 'api-keys'],
    queryFn: listApiKeys,
    staleTime: 30_000,
  })
  const modelsQuery = useQuery({
    queryKey: ['canvas', 'image-models'],
    queryFn: listImageModels,
    staleTime: 60_000,
  })

  const keyOptions = useMemo(
    () =>
      (keysQuery.data ?? [])
        .filter((item) => item.status === 1)
        .map((item) => ({
          value: String(item.id),
          label: item.name || `#${item.id}`,
        })),
    [keysQuery.data]
  )
  const modelOptions = useMemo(
    () =>
      (modelsQuery.data ?? []).map((item) => ({
        value: item.name,
        label: item.name,
      })),
    [modelsQuery.data]
  )
  const sizeOptions = useMemo(
    () => SIZE_OPTIONS.map((item) => ({ value: item, label: item })),
    []
  )
  const countOptions = useMemo(
    () => COUNT_OPTIONS.map((item) => ({ value: item, label: item })),
    []
  )

  const canGenerate =
    Boolean(props.draft.apiKeyId) &&
    Boolean(props.draft.model.trim()) &&
    Boolean(props.draft.prompt.trim()) &&
    !props.generating

  // Hide the prompt that is already in the box: it is what the operator is
  // looking at, so repeating it as a shortcut only adds noise.
  const recent = (props.recentPrompts ?? []).filter(
    (item) => item !== props.draft.prompt.trim()
  )

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col gap-4 overflow-y-auto p-1',
        props.className
      )}
    >
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='canvas-prompt'>{t('Prompt')}</Label>
        <Textarea
          id='canvas-prompt'
          value={props.draft.prompt}
          onChange={(event) =>
            props.onDraftChange({ prompt: event.target.value })
          }
          placeholder={t('Describe the image you want')}
          rows={4}
          className='resize-none'
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              if (canGenerate) props.onGenerate()
            }
          }}
        />
        <p className='text-muted-foreground text-xs'>
          {t('Press Ctrl and Enter to generate')}
        </p>
      </div>

      {recent.length > 0 && (
        <div className='flex flex-col gap-1.5'>
          <Label>{t('Recent prompts')}</Label>
          <div className='flex flex-col gap-1'>
            {recent.map((prompt) => (
              <button
                key={prompt}
                type='button'
                className='text-muted-foreground hover:bg-muted hover:text-foreground truncate rounded px-1.5 py-1 text-left text-xs'
                title={prompt}
                onClick={() => props.onDraftChange({ prompt })}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {props.reference && (
        <div className='flex flex-col gap-1.5'>
          <Label>{t('Reference image')}</Label>
          <div className='flex items-center gap-2 rounded-lg border p-2'>
            <img
              src={props.reference.image}
              alt=''
              className='size-12 shrink-0 rounded object-cover'
            />
            <p className='text-muted-foreground min-w-0 flex-1 text-xs'>
              {t('The next result is drawn from this picture.')}
            </p>
            <Button
              variant='ghost'
              size='icon'
              className='size-6 shrink-0'
              onClick={props.onClearReference}
              aria-label={t('Remove reference')}
            >
              <X className='size-3.5' />
            </Button>
          </div>
        </div>
      )}

      <div className='flex flex-col gap-1.5'>
        <Label>{t('API key')}</Label>
        {keyOptions.length === 0 && !keysQuery.isLoading && (
          <div className='flex flex-col gap-2'>
            <p className='text-muted-foreground text-xs'>
              {t('No enabled API key yet.')}
            </p>
            <Button size='sm' variant='outline' render={<Link to='/keys' />}>
              <span>{t('Create an API key')}</span>
            </Button>
          </div>
        )}
        {keyOptions.length > 0 && (
          <Combobox
            options={keyOptions}
            value={props.draft.apiKeyId}
            onValueChange={(value) =>
              props.onDraftChange({ apiKeyId: value ?? '' })
            }
            placeholder={t('Select an API key')}
            emptyText={t('No matching API key')}
            aria-label={t('API key')}
          />
        )}
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label>{t('Image model')}</Label>
        {modelOptions.length === 0 && !modelsQuery.isLoading && (
          <p className='text-muted-foreground text-xs'>
            {t(
              'This site has no image model yet. Ask an administrator to enable an image channel.'
            )}
          </p>
        )}
        <Combobox
          options={modelOptions}
          value={props.draft.model}
          onValueChange={(value) => props.onDraftChange({ model: value ?? '' })}
          placeholder={t('Select a model')}
          emptyText={t('No matching model')}
          allowCustomValue
          aria-label={t('Image model')}
        />
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <div className='flex flex-col gap-1.5'>
          <Label>{t('Size')}</Label>
          <Combobox
            options={sizeOptions}
            value={props.draft.size}
            onValueChange={(value) =>
              props.onDraftChange({ size: value ?? SIZE_OPTIONS[0] })
            }
            placeholder={t('Size')}
            emptyText={t('No matching size')}
            allowCustomValue
            aria-label={t('Size')}
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label>{t('Count')}</Label>
          <Combobox
            options={countOptions}
            value={props.draft.count}
            onValueChange={(value) =>
              props.onDraftChange({ count: value ?? '1' })
            }
            placeholder={t('Count')}
            emptyText={t('No matching option')}
            aria-label={t('Count')}
          />
        </div>
      </div>

      <Button disabled={!canGenerate} onClick={props.onGenerate}>
        {props.generating ? (
          <>
            <Loader2 className='animate-spin' />
            <span>{t('Generating...')}</span>
          </>
        ) : (
          <>
            <Sparkles />
            <span>{props.reference ? t('Draw variation') : t('Generate')}</span>
          </>
        )}
      </Button>
    </div>
  )
}
