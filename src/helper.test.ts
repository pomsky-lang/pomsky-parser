import { expect, test } from 'vitest'
import { join, parseQuotedText } from './helper.js'

test('joining empty spans works', () => {
  expect(join([0, 0], [1, 2])).toEqual([1, 2])
  expect(join([2, 5], [0, 0])).toEqual([2, 5])
})

test('joining non-empty spans works', () => {
  expect(join([10, 15], [1, 13])).toEqual([1, 15])
  expect(join([2, 5], [8, 8])).toEqual([2, 8])
})

test('parsing quoted text works', () => {
  expect(parseQuotedText(String.raw`"hello '\"\\ world"`)).toEqual(String.raw`hello '"\ world`)
  expect(parseQuotedText(String.raw`'hello \"\\ world'`)).toEqual(String.raw`hello \"\\ world`)
})
