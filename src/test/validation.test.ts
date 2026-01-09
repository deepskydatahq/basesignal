import { expect, test } from 'vitest'
import { levenshtein, validateActivityFormat, findDuplicate, parseActivityName } from '../shared/validation'

// levenshtein tests

test('levenshtein calculates string distance correctly', () => {
  // Identical strings
  expect(levenshtein('hello', 'hello')).toBe(0)

  // Empty string comparisons
  expect(levenshtein('hello', '')).toBe(5)
  expect(levenshtein('', 'world')).toBe(5)

  // Single character differences
  expect(levenshtein('cat', 'bat')).toBe(1)
  expect(levenshtein('cat', 'cats')).toBe(1)

  // Multiple differences
  expect(levenshtein('kitten', 'sitting')).toBe(3)
  expect(levenshtein('Created', 'Made')).toBe(5)
})

// validateActivityFormat tests

test('validateActivityFormat accepts valid entity + action combinations', () => {
  const result = validateActivityFormat('Account', 'Created')
  expect(result.valid).toBe(true)
  expect(result.error).toBeUndefined()

  // Irregular past tense verbs should be accepted
  expect(validateActivityFormat('Email', 'Sent').valid).toBe(true)
  expect(validateActivityFormat('Data', 'Built').valid).toBe(true)
  expect(validateActivityFormat('File', 'Run').valid).toBe(true)
})

test('validateActivityFormat rejects invalid formats', () => {
  // Empty entity
  const emptyEntity = validateActivityFormat('', 'Created')
  expect(emptyEntity.valid).toBe(false)
  expect(emptyEntity.error).toContain('Entity is required')

  // Multi-word entity
  const multiWord = validateActivityFormat('User Account', 'Created')
  expect(multiWord.valid).toBe(false)
  expect(multiWord.error).toContain('single noun')

  // Non-past-tense action
  const nonPastTense = validateActivityFormat('Account', 'Create')
  expect(nonPastTense.valid).toBe(false)
  expect(nonPastTense.error).toContain('past tense')

  // Vague terms
  const vagueEntity = validateActivityFormat('Onboarding', 'Completed')
  expect(vagueEntity.valid).toBe(false)
  expect(vagueEntity.error).toContain('vague')

  const vagueAction = validateActivityFormat('Account', 'Setup')
  expect(vagueAction.valid).toBe(false)
})

// findDuplicate tests

test('findDuplicate detects exact and fuzzy matches', () => {
  const existingActivities = [
    { entity: 'Account', action: 'Created' },
    { entity: 'Project', action: 'Published' },
    { entity: 'Trial', action: 'Started' },
  ]

  // Exact match (case-insensitive)
  const exactMatch = findDuplicate('account', 'created', existingActivities)
  expect(exactMatch).not.toBeNull()
  expect(exactMatch?.entity).toBe('Account')

  // Fuzzy match on full name
  const fuzzyMatch = findDuplicate('Account', 'Createdd', existingActivities)
  expect(fuzzyMatch).not.toBeNull()

  // Similar action for same entity (typo)
  const typoMatch = findDuplicate('Project', 'Publised', existingActivities)
  expect(typoMatch).not.toBeNull()
  expect(typoMatch?.entity).toBe('Project')
})

test('findDuplicate returns null for non-duplicates', () => {
  const existingActivities = [
    { entity: 'Account', action: 'Created' },
    { entity: 'Project', action: 'Published' },
    { entity: 'Trial', action: 'Started' },
  ]

  // No duplicate exists
  expect(findDuplicate('Report', 'Generated', existingActivities)).toBeNull()

  // Different entities with similar actions should not match
  expect(findDuplicate('Report', 'Created', existingActivities)).toBeNull()

  // Opposite actions for same entity should not match
  expect(findDuplicate('Account', 'Deleted', existingActivities)).toBeNull()

  // Empty list
  expect(findDuplicate('Account', 'Created', [])).toBeNull()
})

// parseActivityName tests

test('parseActivityName extracts entity and action from "Account Created"', () => {
  const result = parseActivityName('Account Created')
  expect(result).toEqual({ entity: 'Account', action: 'Created' })
})

test('parseActivityName handles multi-word action "User Signed Up"', () => {
  const result = parseActivityName('User Signed Up')
  expect(result).toEqual({ entity: 'User', action: 'Signed Up' })
})

test('parseActivityName handles single word (no action)', () => {
  const result = parseActivityName('Account')
  expect(result).toEqual({ entity: 'Account', action: '' })
})

test('parseActivityName handles empty string', () => {
  const result = parseActivityName('')
  expect(result).toEqual({ entity: '', action: '' })
})

test('parseActivityName trims whitespace', () => {
  const result = parseActivityName('  Account   Created  ')
  expect(result).toEqual({ entity: 'Account', action: 'Created' })
})
