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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GeeTestCaptcha } from '../geetest-captcha'

interface FakeInstance {
  onSuccess: (callback: () => void) => void
  onReady: (callback: () => void) => void
  onError: (callback: () => void) => void
  onClose: (callback: () => void) => void
  getValidate: () => Record<string, string> | undefined
  showCaptcha: ReturnType<typeof vi.fn>
  destroy: () => void
  success?: () => void
  ready?: () => void
}

/** Stand-in for the GeeTest popup: the puzzle opens when asked to. */
function installFakeGeeTest(options?: {
  noResult?: boolean
  failInit?: boolean
}) {
  const instance: FakeInstance = {
    onSuccess: (callback) => {
      instance.success = callback
    },
    onReady: (callback) => {
      instance.ready = callback
    },
    onError: vi.fn(),
    onClose: vi.fn(),
    getValidate: () =>
      options?.noResult
        ? undefined
        : {
            lot_number: 'lot-1',
            captcha_output: 'output-1',
            pass_token: 'pass-1',
            gen_time: '1700000000',
          },
    showCaptcha: vi.fn(),
    destroy: vi.fn(),
  }

  const init = vi.fn(
    (config: Record<string, unknown>, callback: (value: never) => void) => {
      if (options?.failInit) {
        const onError = config.onError as ((error: unknown) => void) | undefined
        onError?.({ code: '60204', msg: 'Network failure' })
        return
      }
      callback(instance as unknown as never)
      instance.ready?.()
    }
  )
  window.initGeetest4 = init

  return { instance, init }
}

describe('GeeTestCaptcha', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    delete window.initGeetest4
  })

  it('passes an init-level onError so a load failure cannot be swallowed', async () => {
    const { init } = installFakeGeeTest()

    render(
      <GeeTestCaptcha captchaId='id-1' verified={false} onVerify={vi.fn()} />
    )

    await waitFor(() => expect(init).toHaveBeenCalledTimes(1))
    const config = init.mock.calls[0][0] as Record<string, unknown>
    expect(typeof config.onError).toBe('function')
    expect(config.product).toBe('popup')
  })

  it('opens the challenge when the button is pressed', async () => {
    const { instance } = installFakeGeeTest()

    render(
      <GeeTestCaptcha captchaId='id-1' verified={false} onVerify={vi.fn()} />
    )

    const button = await screen.findByRole('button', {
      name: 'Click to complete human verification',
    })
    fireEvent.click(button)

    expect(instance.showCaptcha).toHaveBeenCalledTimes(1)
  })

  it('hands the solved challenge back as serialized JSON', async () => {
    const { instance } = installFakeGeeTest()
    const onVerify = vi.fn()

    render(
      <GeeTestCaptcha captchaId='id-1' verified={false} onVerify={onVerify} />
    )

    await waitFor(() => expect(instance.success).toBeTypeOf('function'))
    act(() => instance.success?.())

    expect(onVerify).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(String(onVerify.mock.calls[0][0]))
    expect(payload).toEqual({
      lot_number: 'lot-1',
      captcha_output: 'output-1',
      pass_token: 'pass-1',
      gen_time: '1700000000',
    })
  })

  it('reports a locked-out solve instead of submitting an empty challenge', async () => {
    const { instance } = installFakeGeeTest({ noResult: true })
    const onVerify = vi.fn()

    render(
      <GeeTestCaptcha captchaId='id-1' verified={false} onVerify={onVerify} />
    )

    await waitFor(() => expect(instance.success).toBeTypeOf('function'))
    act(() => instance.success?.())

    expect(onVerify).not.toHaveBeenCalled()
    expect(
      await screen.findByText(
        'Human verification could not load. Check your network and try again.'
      )
    ).toBeInTheDocument()
  })

  it('offers a retry that re-initialises after a failed load', async () => {
    const { init } = installFakeGeeTest({ failInit: true })

    render(
      <GeeTestCaptcha captchaId='id-1' verified={false} onVerify={vi.fn()} />
    )

    const retry = await screen.findByRole('button', {
      name: 'Retry human verification',
    })
    expect(init).toHaveBeenCalledTimes(1)

    fireEvent.click(retry)

    await waitFor(() => expect(init).toHaveBeenCalledTimes(2))
  })

  it('confirms a stored challenge and offers a reset that drops it', () => {
    const onReset = vi.fn()

    render(
      <GeeTestCaptcha
        captchaId='id-1'
        verified
        onVerify={vi.fn()}
        onReset={onReset}
      />
    )

    expect(screen.getByText('Human verification passed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('does not load the vendor script without a captcha id', () => {
    const { init } = installFakeGeeTest()

    render(<GeeTestCaptcha captchaId='' verified={false} onVerify={vi.fn()} />)

    expect(init).not.toHaveBeenCalled()
  })
})
