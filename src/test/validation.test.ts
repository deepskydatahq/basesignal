import { describe, it, expect } from 'vitest'
import { levenshtein, validateActivityFormat, findDuplicate } from '../../convex/utils/validation'

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0)
  })

  it('returns string length for empty comparison', () => {
    expect(levenshtein('hello', '')).toBe(5)
    expect(levenshtein('', 'world')).toBe(5)
  })

  it('calculates single character difference', () => {
    expect(levenshtein('cat', 'bat')).toBe(1)
    expect(levenshtein('cat', 'cats')).toBe(1)
  })

  it('calculates multiple differences', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('Created', 'Made')).toBe(5)
  })
})

describe('validateActivityFormat', () => {
  it('accepts valid entity + action', () => {
    const result = validateActivityFormat('Account', 'Created')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('rejects empty entity', () => {
    const result = validateActivityFormat('', 'Created')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Entity is required')
  })

  it('rejects multi-word entity', () => {
    const result = validateActivityFormat('User Account', 'Created')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('single noun')
  })

  it('rejects non-past-tense action', () => {
    const result = validateActivityFormat('Account', 'Create')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('past tense')
  })

  it('accepts irregular past tense verbs', () => {
    expect(validateActivityFormat('Email', 'Sent').valid).toBe(true)
    expect(validateActivityFormat('Data', 'Built').valid).toBe(true)
    expect(validateActivityFormat('File', 'Run').valid).toBe(true)
  })

  it('rejects vague terms', () => {
    const result1 = validateActivityFormat('Onboarding', 'Completed')
    expect(result1.valid).toBe(false)
    expect(result1.error).toContain('vague')

    const result2 = validateActivityFormat('Account', 'Setup')
    expect(result2.valid).toBe(false)
  })
})

describe('findDuplicate', () => {
  const existingActivities = [
    { entity: 'Account', action: 'Created' },
    { entity: 'Project', action: 'Published' },
    { entity: 'Trial', action: 'Started' },
  ]

  it('returns null when no duplicate exists', () => {
    const result = findDuplicate('Report', 'Generated', existingActivities)
    expect(result).toBeNull()
  })

  it('finds exact match (case-insensitive)', () => {
    const result = findDuplicate('account', 'created', existingActivities)
    expect(result).not.toBeNull()
    expect(result?.entity).toBe('Account')
  })

  it('finds fuzzy match on full name', () => {
    // "Account Createdd" is distance 1 from "Account Created"
    const result = findDuplicate('Account', 'Createdd', existingActivities)
    expect(result).not.toBeNull()
  })

  it('finds similar action for same entity (typo)', () => {
    // Same entity, typo in action: "Publised" vs "Published"
    const result = findDuplicate('Project', 'Publised', existingActivities)
    expect(result).not.toBeNull()
    expect(result?.entity).toBe('Project')
  })

  it('does not match different entities with similar actions', () => {
    // "Report Created" should not match "Account Created" - different entities
    const result = findDuplicate('Report', 'Created', existingActivities)
    expect(result).toBeNull()
  })

  it('does not match opposite actions for same entity', () => {
    // "Account Deleted" should NOT match "Account Created"
    const result = findDuplicate('Account', 'Deleted', existingActivities)
    expect(result).toBeNull()
  })

  it('returns null for empty existing list', () => {
    const result = findDuplicate('Account', 'Created', [])
    expect(result).toBeNull()
  })
})
