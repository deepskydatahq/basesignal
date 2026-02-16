import { describe, it, expect } from 'vitest'

describe('@basesignal/core', () => {
  it('should be importable', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
  })
})
