import { ParseError, ParseErrorKind } from './error.js'
import type { Span } from './rule.js'

export function join(first: Span, second: Span): Span {
  if (first[1] === 0) {
    return second
  } else if (second[1] === 0) {
    return first
  } else {
    const start = Math.min(first[0], second[0])
    const end = Math.max(first[1], second[1])
    return [start, end]
  }
}

// TODO: Throw exception if it contains an illegal escape
export function parseQuotedText(input: string) {
  if (input[0] === '"') {
    return stripFirstLast(input).replace(/\\([\\"])/g, '$1')
  } else {
    return stripFirstLast(input)
  }
}

export function stripFirstLast(input: string) {
  return input.slice(1, input.length - 1)
}

export function stringOrCharToString(
  c: string | { char: number; isShorthand: boolean },
  span: Span,
): number {
  if (typeof c !== 'string') return c.char
  const content = parseQuotedText(c)
  const codePoint = content.codePointAt(0)
  if (codePoint === undefined) {
    throw new ParseError(ParseErrorKind.EmptyStringInCharSetRange, span)
  }
  const expectedLen = codePoint > 0xffff ? 2 : 1
  if (content.length > expectedLen) {
    throw new ParseError(ParseErrorKind.StringTooLongInCharSetRange, span)
  }
  return codePoint
}
