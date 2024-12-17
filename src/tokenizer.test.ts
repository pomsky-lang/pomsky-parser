import { expect, test } from 'vitest'
import { Token, tokenize } from './tokenizer'

test('can tokenize various inputs', () => {
  expect(tokenize('hello world! +-*::')).toEqual([
    [Token.Identifier, 0, 5],
    [Token.Identifier, 6, 11],
    [Token.Not, 11, 12],
    [Token.Plus, 13, 14],
    [Token.Dash, 14, 15],
    [Token.Star, 15, 16],
    [Token.DoubleColon, 16, 18],
  ])
})

test('can tokenize strings', () => {
  expect(tokenize(`"hello" 'world' '\\escapes' "\\esc\\"es" '`)).toEqual([
    [Token.String, 0, 7],
    [Token.String, 8, 15],
    [Token.String, 16, 26],
    [Token.String, 27, 37],
    [Token.E_UnclosedString, 38, 39],
  ])
})

test('can distinguish keywords and identifiers', () => {
  const input =
    'U let lazy greedy range base atomic enable disable if then else recursion regex test call'

  expect(tokenize(input)).toEqual([
    [Token.ReservedName, 0, 1],
    [Token.ReservedName, 2, 5],
    [Token.ReservedName, 6, 10],
    [Token.ReservedName, 11, 17],
    [Token.ReservedName, 18, 23],
    [Token.ReservedName, 24, 28],
    [Token.ReservedName, 29, 35],
    [Token.ReservedName, 36, 42],
    [Token.ReservedName, 43, 50],
    [Token.ReservedName, 51, 53],
    [Token.Identifier, 54, 58],
    [Token.ReservedName, 59, 63],
    [Token.ReservedName, 64, 73],
    [Token.ReservedName, 74, 79],
    [Token.ReservedName, 80, 84],
    [Token.ReservedName, 85, 89],
  ])
})

test('ignores comments', () => {
  const input = `hello # comment
world! # comment
+ # comment
- # comment
# comment
:)`

  expect(tokenize(input)).toEqual([
    [Token.Identifier, 0, 5],
    [Token.Identifier, 16, 21],
    [Token.Not, 21, 22],
    [Token.Plus, 33, 34],
    [Token.Dash, 45, 46],
    [Token.Colon, 67, 68],
    [Token.CloseParen, 68, 69],
  ])
})

test('distinguishes single and compound tokens', () => {
  const input = '<::>><>: U+30 U + 30'

  expect(tokenize(input)).toEqual([
    [Token.AngleLeft, 0, 1],
    [Token.DoubleColon, 1, 3],
    [Token.LookAhead, 3, 5],
    [Token.AngleLeft, 5, 6],
    [Token.AngleRight, 6, 7],
    [Token.Colon, 7, 8],
    [Token.CodePoint, 9, 13],
    [Token.CodePoint, 14, 20],
  ])
})
