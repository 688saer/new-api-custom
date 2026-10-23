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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GeeTestCaptcha } from '../geetest-captcha'

interface FakeInstance {
  onSuccess: (callback: () => void) => void
  onReady: (callback: () => void) => void
  onError: (callback: () => void) => void
  onClose: (callback: () => void) => void
  getValidate: () => Record<string, string> | undefined
  showCaptcha: () => void
  destroy: () => void
}

/** A stand-in for the gt4.js popup: solved on demand, like the real widget. */
function installFakeGeeTest(options?: { noResult?: boolean }) {
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
    showCaptcha: vi.fn(() => instance.success?.()),
    destroy: vi.fn(),
    success: undefined,
    ready: undefined,
  }

  window.initGeetest4 = vi.fn((_options, callback) => {
    callback(instance as unknown as never)
    instance.ready?.()
  })

  return { instance, init: window.initGeetest4 }
}

describe('GeeTestCaptcha', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    delete window.initGeetest4
  })

  it('asks for the challenge before the widget is ready instead of allowing submit', () => {
    render(
      <GeeTestCaptcha captchaId='id-1' verified={false} onVerify={vi.fn()} />
    )

    expect(
      screen.getByRole('button', { name: 'Loading human verification...' })
    ).toBeDisabled()
  })

  it('hands the solved challenge back as serialized JSON', async () => {
    installFakeGeeTest()
    const onVerify = vi.fn()

    render(
      <GeeTestCaptcha captchaId='id-1' verified={false} onVerify={onVerify} />
    )

    const button = await screen.findByRole('button', {
      name: 'Click to complete human verification',
    })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)

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
    installFakeGeeTest({ noResult: true })
    const onVerify = vi.fn()

    render(
      <GeeTestCaptcha captchaId='id-1' verified={false} onVerify={onVerify} />
    )

    const button = await screen.findByRole('button', {
      name: 'Click to complete human verification',
    })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)

    expect(onVerify).not.toHaveBeenCalled()
    expect(
      await screen.findByText(
        'Human verification could not load. Check your network and try again.'
      )
    ).toBeInTheDocument()
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
    installFakeGeeTest()

    render(<GeeTestCaptcha captchaId='' verified={false} onVerify={vi.fn()} />)

    expect(window.initGeetest4).not.toHaveBeenCalled()
  })
})
