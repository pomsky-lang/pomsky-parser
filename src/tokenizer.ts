const UNICODE_LIT = /^U\s*\+\s*[0-9a-fA-F]+/u
const LETTER_OR_UNDERSCORE = /[\p{Alpha}_]/u
const NO_WORD_CHAR = /[^\p{Alpha}\p{M}\p{Nd}_]/u
const NO_DIGIT = /[^\d_]/u

const DOUBLE_QUOTED_STRING = /^"(?:\\[\s\S]|[^\\"])*"?/u

export enum Token {
  // Assertions
  Caret = 0,
  Dollar = 1,
  Percent = 2,
  AngleLeft = 3,
  AngleRight = 4,
  LookAhead = 5,
  LookBehind = 6,

  // Simple repetitions
  Star = 7,
  Plus = 8,
  QuestionMark = 9,

  // Specific repetitions
  OpenBrace = 10,
  CloseBrace = 11,
  Comma = 12,

  // Alternation, intersection, negation
  Pipe = 13,
  Ampersand = 14,
  Not = 15,

  // Groups
  Colon = 16,
  OpenParen = 17,
  CloseParen = 18,

  // Character sets
  OpenBracket = 19,
  CloseBracket = 20,

  // Range
  Dash = 21,

  // Match all
  Dot = 22,

  // Statements
  Semicolon = 23,
  Equals = 24,

  // Back-reference
  DoubleColon = 25,

  // Other
  String = 26,
  CodePoint = 27,
  Number = 28,
  Identifier = 29,
  ReservedName = 30,

  // Errors
  E_Unknown = 31,
  E_UnclosedString = 32,
}

export function tokenize(src: string): [Token, number, number][] {
  let input = src
  const result: [Token, number, number][] = []
  let offset = 0

  for (;;) {
    const inputLen = input.length
    input = input.replace(/^(\s*|#.*)*/u, '')
    offset += inputLen - input.length

    if (input.length === 0) {
      break
    }

    const [len, token] = consumeChain(input)

    const start = offset
    offset += len
    input = input.slice(len)
    result.push([token, start, offset])
  }

  return result
}

const singleTokens: { [token: string]: Token } = {
  $: Token.Dollar,
  '^': Token.Caret,
  '%': Token.Percent,
  '<': Token.AngleLeft,
  '>': Token.AngleRight,

  '*': Token.Star,
  '+': Token.Plus,
  '?': Token.QuestionMark,

  '{': Token.OpenBrace,
  '}': Token.CloseBrace,
  ',': Token.Comma,

  '|': Token.Pipe,
  '&': Token.Ampersand,
  '!': Token.Not,

  ':': Token.Colon,
  '(': Token.OpenParen,
  ')': Token.CloseParen,

  '[': Token.OpenBracket,
  ']': Token.CloseBracket,

  '-': Token.Dash,

  '.': Token.Dot,

  ';': Token.Semicolon,
  '=': Token.Equals,
}

export const reserved: { readonly [identifier: string]: true } = {
  U: true,
  let: true,
  lazy: true,
  greedy: true,
  range: true,
  base: true,
  atomic: true,
  enable: true,
  disable: true,
  if: true,
  else: true,
  recursion: true,
  regex: true,
  test: true,
  call: true,
}

// eslint-disable-next-line complexity
function consumeChain(input: string): [number, Token] {
  const char = input[0]

  if (input.startsWith('>>')) return [2, Token.LookAhead]
  if (input.startsWith('<<')) return [2, Token.LookBehind]
  if (input.startsWith('::')) return [2, Token.DoubleColon]

  if (char in singleTokens) return [1, singleTokens[char]]

  if (char === "'") {
    const lenInner = input.indexOf("'", 1)
    if (lenInner === -1) {
      return [input.length, Token.E_UnclosedString]
    } else {
      return [lenInner + 1, Token.String]
    }
  }

  if (char === '"') {
    const len = findLengthOfDoubleQuotedString(input)
    if (len !== undefined) {
      return [len, Token.String]
    } else {
      return [input.length, Token.E_UnclosedString]
    }
  }

  const unicodeLiteralMatch = UNICODE_LIT.exec(input)
  if (unicodeLiteralMatch != null) {
    return [unicodeLiteralMatch[0].length, Token.CodePoint]
  }

  if (isAsciiDigit(char)) {
    const numLength = input.search(NO_DIGIT)
    return [numLength === -1 ? input.length : numLength, Token.Number]
  }

  if (LETTER_OR_UNDERSCORE.test(char)) {
    const wordLength = input.search(NO_WORD_CHAR)
    const actualLength = wordLength === -1 ? input.length : wordLength
    const ident = input.slice(0, actualLength)
    return [actualLength, ident in reserved ? Token.ReservedName : Token.Identifier]
  }

  return [1, Token.E_Unknown]
}

function findLengthOfDoubleQuotedString(input: string): number | undefined {
  DOUBLE_QUOTED_STRING.lastIndex = 0
  const res = DOUBLE_QUOTED_STRING.exec(input)
  if (res == null) return
  return res[0].length
}

function isAsciiDigit(s: string): boolean {
  const code = s.charCodeAt(0)
  return code >= 48 && code <= 57
}
