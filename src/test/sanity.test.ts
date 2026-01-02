// Sanity test to verify vitest setup
describe('Vitest Setup', () => {
  it('should work with global functions', () => {
    expect(true).toBe(true)
  })

  it('should run basic assertions', () => {
    const sum = 1 + 1
    expect(sum).toBe(2)
    expect(sum).not.toBe(3)
  })
})
