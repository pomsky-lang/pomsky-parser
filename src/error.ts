import type { Span } from './rule.js'
import type { Token } from './tokenizer.js'

export class ParseError extends Error {
  public constructor(
    public readonly kind: ParseErrorKind,
    public readonly span: Span,
    public readonly expected?: string | Token,
  ) {
    super()
  }

  public static expected(span: Span, expected: string): ParseError {
    return new ParseError(ParseErrorKind.Expected, span, expected)
  }
}

export enum ParseErrorKind {
  UnclosedString = 0,
  UnknownToken = 1,
  LeftoverTokens = 2,
  ExpectedToken = 3,
  NumberTooLarge = 4,

  Expected = 5,

  LonePipe = 6,
  MultipleRepetitions = 7,
  NotAscendingRepetition = 8,
  InvalidCharsInGroupName = 9,
  GroupNameTooLong = 10,
  InvalidCodePoint = 11,
  EmptyCharSet = 12,
  UnallowedNotInCharSet = 13,
  EmptyStringInCharSetRange = 14,
  StringTooLongInCharSetRange = 15,
  NotAscendingCharRange = 16,
  InvalidRangeBase = 17,
  MultipleStringsInTestCase = 18,
}
