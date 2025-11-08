import { ParseError, ParseErrorKind } from './error.js'
import { join, parseQuotedText, stringOrCharToString, stripFirstLast } from './helper.js'
import type {
  GroupItem,
  Literal,
  ReferenceTarget,
  RepetitionKind,
  Rule,
  Span,
  Stmt,
  TestCapture,
  TestCase,
  TestCaseMatch,
} from './rule.js'
import {
  BooleanSetting,
  BoundaryKind,
  GroupKind,
  LookaroundKind,
  Quantifier,
  RuleKind,
  StmtKind,
  TestCaseKind,
} from './rule.js'
import { Token, tokenize } from './tokenizer.js'

// This parser is less advanced than the Rust implementation.
// It does not report warnings and currently omits some validation

export function parse(source: string, tokens?: [Token, number, number][]): Rule | ParseError[] {
  const parser = new Parser(source)

  const errors: ParseError[] = []
  for (const token of tokens ?? parser.getTokens()) {
    switch (token[0]) {
      case Token.E_UnclosedString:
        errors.push(new ParseError(ParseErrorKind.UnclosedString, [token[1], token[2]]))
        break
      case Token.E_Unknown:
        errors.push(new ParseError(ParseErrorKind.UnknownToken, [token[1], token[2]]))
        break
    }
  }
  if (errors.length > 0) {
    return errors
  }

  try {
    const res = parser.parseModified()
    if (parser.isEmpty()) {
      return res
    } else {
      return [new ParseError(ParseErrorKind.LeftoverTokens, parser.span())]
    }
  } catch (error) {
    return [error as ParseError]
  }
}

export class Parser {
  private source: string
  private tokens: [Token, number, number][]
  private offset = 0
  private isLazy = false
  private isUnicodeAware = true

  public constructor(source: string) {
    this.source = source
    this.tokens = tokenize(source)
  }

  public getTokens() {
    return this.tokens
  }

  /////////////////////// Helper methods

  public isEmpty(): boolean {
    return this.tokens.length === this.offset
  }

  private sourceAt(start: number, end: number): string {
    return this.source.slice(start, end)
  }

  private peek(): [Token, string] | undefined {
    const token = this.tokens[this.offset]
    if (token === undefined) {
      return undefined
    }
    return [token[0], this.sourceAt(token[1], token[2])]
  }

  public span(): [number, number] {
    const token = this.tokens[this.offset]
    if (token === undefined) {
      return [this.source.length, this.source.length]
    }
    return [token[1], token[2]]
  }

  private lastSpan(): [number, number] {
    const token = this.tokens[this.offset - 1]
    return [token[1], token[2]]
  }

  private advance() {
    this.offset += 1
  }

  private is(expected: Token): boolean {
    const token = this.tokens[this.offset]
    return token !== undefined && token[0] === expected
  }

  private consume(expected: Token): boolean {
    const token = this.tokens[this.offset]
    if (token !== undefined && token[0] === expected) {
      this.offset += 1
      return true
    }
    return false
  }

  private consumeAs(expected: Token): string | undefined {
    const token = this.tokens[this.offset]
    if (token !== undefined && token[0] === expected) {
      this.offset += 1
      return this.source.slice(token[1], token[2])
    }
  }

  private consumeReserved(reserved: string): boolean {
    const token = this.tokens[this.offset]
    if (
      token !== undefined &&
      token[0] === Token.ReservedName &&
      this.source.slice(token[1], token[2]) === reserved
    ) {
      this.offset += 1
      return true
    }
    return false
  }

  private consumeContextualKeyword(keyword: string): boolean {
    const token = this.tokens[this.offset]
    if (
      token !== undefined &&
      token[0] === Token.Identifier &&
      this.source.slice(token[1], token[2]) === keyword
    ) {
      this.offset += 1
      return true
    }
    return false
  }

  private consumeNumber(max: number): number | undefined {
    const token = this.tokens[this.offset]
    if (token !== undefined && token[0] === Token.Number) {
      const num = +this.source.slice(token[1], token[2])
      if (num <= max) {
        this.offset += 1
        return num
      } else {
        throw new ParseError(ParseErrorKind.NumberTooLarge, [token[1], token[2]])
      }
    }
  }

  private expect(expected: Token): undefined {
    const token = this.tokens[this.offset]
    if (token !== undefined && token[0] === expected) {
      this.offset += 1
    } else {
      throw new ParseError(ParseErrorKind.ExpectedToken, [token[1], token[2]], expected)
    }
  }

  private expectAs(expected: Token): string {
    const token = this.tokens[this.offset]
    if (token !== undefined && token[0] === expected) {
      this.offset += 1
      return this.source.slice(token[1], token[2])
    } else {
      throw new ParseError(ParseErrorKind.ExpectedToken, [token[1], token[2]], expected)
    }
  }

  private expectNumber(): number {
    const token = this.tokens[this.offset]
    if (token !== undefined && token[0] === Token.Number) {
      const num = +this.source.slice(token[1], token[2])
      if (!Number.isFinite(num)) {
        throw new ParseError(ParseErrorKind.NumberTooLarge, [token[1], token[2]])
      }
      this.offset += 1
      return num
    } else {
      throw new ParseError(ParseErrorKind.ExpectedToken, [token[1], token[2]], Token.Number)
    }
  }

  /////////////////////// Impl

  public parseModified(): Rule {
    const stmts: [Stmt, Span][] = []
    const wasLazy = this.isLazy
    const wasUnicodeAwaire = this.isUnicodeAware

    for (;;) {
      const stmt = this.parseModeModifier() ?? this.parseLet() ?? this.parseTest()
      if (!stmt) break

      switch (stmt[0].$s) {
        case StmtKind.Enable:
          if (stmt[0].setting === BooleanSetting.Lazy) this.isLazy = true
          else this.isUnicodeAware = true
          break
        case StmtKind.Disable:
          if (stmt[0].setting === BooleanSetting.Lazy) this.isLazy = false
          else this.isUnicodeAware = false
          break
      }

      stmts.push(stmt)
    }

    let rule = this.parseOr()

    this.isLazy = wasLazy
    this.isUnicodeAware = wasUnicodeAwaire

    const spanEnd = rule.span
    for (let i = stmts.length - 1; i >= 0; i--) {
      const [stmt, span] = stmts[i]
      rule = { $r: RuleKind.StmtExpr, stmt, span: join(span, spanEnd), rule }
    }

    return rule
  }

  private parseModeModifier(): [Stmt, Span] | undefined {
    let mode: boolean
    if (this.consumeReserved('enable')) {
      mode = true
    } else if (this.consumeReserved('disable')) {
      mode = false
    } else {
      return
    }

    const spanStart = this.lastSpan()
    let setting: BooleanSetting
    if (this.consumeReserved('lazy')) {
      setting = BooleanSetting.Lazy
    } else if (this.consumeContextualKeyword('unicode')) {
      setting = BooleanSetting.Unicode
    } else {
      throw ParseError.expected(this.span(), '`lazy` or `unicode`')
    }
    this.expect(Token.Semicolon)
    const spanEnd = this.lastSpan()
    const span = join(spanStart, spanEnd)
    return [{ $s: mode ? StmtKind.Enable : StmtKind.Disable, setting, span }, span]
  }

  private parseLet(): [Stmt, Span] | undefined {
    if (this.consumeReserved('let')) {
      const spanStart = this.lastSpan()
      const nameSpan = this.span()
      const name = this.expectAs(Token.Identifier)

      this.expect(Token.Equals)

      const rule = this.parseOr()

      try {
        this.expect(Token.Semicolon)
      } catch (err) {
        throw ParseError.expected((err as ParseError).span, 'expression or `;`')
      }

      const spanEnd = this.lastSpan()
      const span = join(spanStart, spanEnd)
      return [{ $s: StmtKind.Let, name, nameSpan, rule }, span]
    }
  }

  private parseTest(): [Stmt, Span] | undefined {
    if (this.consumeReserved('test')) {
      const spanStart = this.lastSpan()
      this.expect(Token.OpenBrace)

      const cases: TestCase[] = []
      for (;;) {
        const case_ = this.parseTestCases()
        if (!case_) break
        cases.push(case_)
      }

      this.expect(Token.CloseBrace)
      const spanEnd = this.lastSpan()
      const span = join(spanStart, spanEnd)

      return [{ $s: StmtKind.Test, cases, span }, span]
    }
  }

  private parseTestCases(): TestCase | undefined {
    if (this.consumeContextualKeyword('match')) {
      const matches: TestCaseMatch[] = []

      if (this.peek()?.[1] !== 'in') {
        matches.push(this.parseTestMatch())
        while (this.consume(Token.Comma)) {
          matches.push(this.parseTestMatch())
        }
      }

      let literal: Literal | undefined
      if (this.consumeContextualKeyword('in')) {
        literal = this.parseLiteral()
        if (literal === undefined) {
          throw new ParseError(ParseErrorKind.ExpectedToken, this.span(), Token.String)
        }
      }
      this.expect(Token.Semicolon)

      if (literal !== undefined) {
        return { $t: TestCaseKind.MatchAll, literal, matches }
      } else if (matches.length > 1) {
        const span = join(matches[0].span, matches[matches.length - 1].span)
        throw new ParseError(ParseErrorKind.MultipleStringsInTestCase, span)
      } else {
        return matches[0]
      }
    } else if (this.consumeContextualKeyword('reject')) {
      const asSubstring = this.consumeContextualKeyword('in')
      const literal = this.parseLiteral()
      if (literal === undefined) {
        throw new ParseError(ParseErrorKind.ExpectedToken, this.span(), Token.String)
      }
      this.expect(Token.Semicolon)
      return { $t: TestCaseKind.Reject, literal, asSubstring }
    }
  }

  private parseTestMatch(): TestCaseMatch {
    const literal = this.parseLiteral()
    if (literal === undefined) {
      throw new ParseError(ParseErrorKind.ExpectedToken, this.span(), Token.String)
    }

    const spanStart = this.lastSpan()
    const captures: TestCapture[] = []

    if (this.consumeContextualKeyword('as')) {
      this.expect(Token.OpenBrace)
      let isFirst = true
      for (;;) {
        if (!isFirst && !this.consume(Token.Comma)) {
          break
        }
        const capture = this.parseTestCapture()
        if (capture === undefined) break

        captures.push(capture)
        isFirst = false
      }
    }

    const spanEnd = this.lastSpan()
    return {
      $t: TestCaseKind.Match,
      literal,
      captures,
      span: join(spanStart, spanEnd),
    }
  }

  private parseTestCapture(): TestCapture | undefined {
    const ident = this.consumeNumber(65_536) ?? this.consumeAs(Token.Identifier)
    if (ident === undefined) return

    const identSpan = this.lastSpan()
    this.expect(Token.Colon)
    const literal = this.parseLiteral()
    if (literal === undefined) {
      throw new ParseError(ParseErrorKind.ExpectedToken, this.span(), Token.String)
    }

    return { ident, identSpan, literal }
  }

  private parseOr(): Rule {
    let span = this.span()
    const leadingPipe = this.consume(Token.Pipe)

    const alts: Rule[] = []
    const firstAlt = this.parseAnd()
    if (!firstAlt) {
      if (leadingPipe) throw new ParseError(ParseErrorKind.LonePipe, this.lastSpan())
      else return { $r: RuleKind.Literal, content: '', span: [0, 0] }
    }

    alts.push(firstAlt)
    while (this.consume(Token.Pipe)) {
      const nextAlt = this.parseAnd()
      if (!nextAlt) throw new ParseError(ParseErrorKind.LonePipe, this.lastSpan())

      span = join(span, nextAlt.span)
      alts.push(nextAlt)
    }

    if (alts.length === 1) {
      return alts[0]
    } else {
      return { $r: RuleKind.Alternation, rules: alts, span }
    }
  }

  private parseAnd(): Rule | undefined {
    const spanStart = this.span()
    const hasLeadingAmpersand = this.consume(Token.Ampersand)

    const firstSequence = this.parseSequence()
    if (!firstSequence) {
      if (hasLeadingAmpersand) throw ParseError.expected(this.span(), 'expression')
      else return
    }
    if (!this.is(Token.Ampersand)) return firstSequence

    const rules = [firstSequence]
    for (;;) {
      if (!this.consume(Token.Ampersand)) {
        return {
          $r: RuleKind.Intersection,
          rules,
          span: join(spanStart, this.lastSpan()),
        }
      }

      const nextSequence = this.parseSequence()
      if (!nextSequence) throw ParseError.expected(this.span(), 'expression')

      rules.push(nextSequence)
    }
  }

  private parseSequence(): Rule | undefined {
    const fixes: Rule[] = []
    for (;;) {
      const fix = this.parseFixes()
      if (!fix) break
      fixes.push(fix)
    }

    if (fixes.length === 0) {
      return
    } else if (fixes.length === 1) {
      return fixes[0]
    } else {
      const start = fixes[0].span
      const end = fixes[fixes.length - 1].span
      const span = join(start, end)
      return {
        $r: RuleKind.Group,
        rules: fixes,
        span,
        kindOrName: GroupKind.Implicit,
      }
    }
  }

  private parseFixes(): Rule | undefined {
    let notsSpan = this.span()
    let nots = 0
    while (this.consume(Token.Not)) {
      nots += 1
      notsSpan = join(notsSpan, this.lastSpan())
    }

    let rule = this.parseLookaround() ?? this.parseAtom()
    if (!rule) {
      if (nots === 0) {
        return
      } else {
        throw ParseError.expected(this.span(), 'expression')
      }
    }

    for (let i = 0; i < nots; i++) {
      rule = { $r: RuleKind.Negation, rule, notSpan: notsSpan, span: join(rule.span, notsSpan) }
    }

    for (;;) {
      const repetition = this.parseRepetition()
      if (!repetition) break
      const [kind, quantifier, repetitionSpan] = repetition
      const span = join(rule.span, repetitionSpan)
      rule = { $r: RuleKind.Repetition, rule, kind, quantifier, span }
    }

    return rule
  }

  private parseLookaround(): Rule | undefined {
    let kind: LookaroundKind
    if (this.consume(Token.LookAhead)) {
      kind = LookaroundKind.Ahead
    } else if (this.consume(Token.LookBehind)) {
      kind = LookaroundKind.Behind
    } else {
      return
    }
    const startSpan = this.lastSpan()
    const rule = this.parseModified()
    return {
      $r: RuleKind.Lookaround,
      rule,
      kind,
      span: join(startSpan, rule.span),
    }
  }

  private parseRepetition(): [RepetitionKind, Quantifier, Span] | undefined {
    const start = this.span()

    let kind: RepetitionKind | undefined
    if (this.consume(Token.Plus)) {
      kind = { lower: 1 }
    } else if (this.consume(Token.Star)) {
      kind = { lower: 0 }
    } else if (this.consume(Token.QuestionMark)) {
      kind = { lower: 0, upper: 1 }
    } else {
      kind = this.parseRepetitionBraces()
      if (!kind) return
    }

    let quantifier: Quantifier
    if (this.consumeReserved('greedy')) {
      quantifier = Quantifier.Greedy
    } else if (this.consumeReserved('lazy')) {
      quantifier = Quantifier.Lazy
    } else if (this.isLazy) {
      quantifier = Quantifier.DefaultLazy
    } else {
      quantifier = Quantifier.DefaultGreedy
    }

    const multiSpan = this.span()
    if (
      this.consume(Token.Plus) ||
      this.consume(Token.Star) ||
      this.consume(Token.QuestionMark) ||
      this.parseRepetitionBraces()
    ) {
      throw new ParseError(ParseErrorKind.MultipleRepetitions, join(multiSpan, this.lastSpan()))
    }

    const end = this.lastSpan()
    return [kind, quantifier, join(start, end)]
  }

  private parseRepetitionBraces(): RepetitionKind | undefined {
    if (this.consume(Token.OpenBrace)) {
      const numStart = this.span()

      const lower = this.consumeNumber(65_535)
      const comma = this.consume(Token.Comma)
      const upper = this.consumeNumber(65_535)

      const numEnd = this.lastSpan()
      const numSpan = join(numStart, numEnd)

      let kind: RepetitionKind
      if (comma) {
        kind = { lower: lower ?? 0, upper }
        if (upper && kind.lower > upper) {
          throw new ParseError(ParseErrorKind.NotAscendingRepetition, numSpan)
        }
      } else if (lower !== undefined && upper !== undefined) {
        throw ParseError.expected(numEnd, '`}` or `,`')
      } else if (lower !== undefined) {
        kind = { lower, upper: lower }
      } else {
        throw ParseError.expected(this.span(), 'number')
      }

      this.expect(Token.CloseBrace)
      return kind
    }
  }

  private parseAtom(): Rule | undefined {
    return (
      this.parseGroup() ??
      this.parseLiteral() ??
      this.parseCharSet() ??
      this.parseBoundary() ??
      this.parseReference() ??
      this.parseCodePointRule() ??
      this.parseRange() ??
      this.parseRegex() ??
      this.parseVariable() ??
      this.parseDot() ??
      this.parseRecursion()
    )
  }

  private parseGroup(): Rule | undefined {
    const [kindOrName, startSpan] = this.parseGroupKind()
    if (kindOrName !== GroupKind.Normal) {
      this.expect(Token.OpenParen)
    } else if (!this.consume(Token.OpenParen)) {
      return
    }

    const rule = this.parseModified()

    try {
      this.expect(Token.CloseParen)
    } catch (error) {
      throw ParseError.expected((error as ParseError).span, '`)` or an expression')
    }
    const span = join(startSpan, this.lastSpan())
    return { $r: RuleKind.Group, kindOrName, rules: [rule], span }
  }

  private parseGroupKind(): [GroupKind | string, Span] {
    if (this.consumeReserved('atomic')) {
      return [GroupKind.Atomic, this.lastSpan()]
    } else if (this.consume(Token.Colon)) {
      const span = this.lastSpan()

      const name = this.consumeAs(Token.Identifier)
      if (name !== undefined) {
        if (!/^[a-zA-Z0-9]*$/.test(name)) {
          throw new ParseError(ParseErrorKind.InvalidCharsInGroupName, this.lastSpan())
        } else if (name.length > 128) {
          throw new ParseError(ParseErrorKind.GroupNameTooLong, this.lastSpan())
        }
      }

      return [name ?? GroupKind.Capturing, span]
    } else {
      return [GroupKind.Normal, this.span()]
    }
  }

  private parseLiteral(): Literal | undefined {
    const lit = this.consumeAs(Token.String)
    if (lit === undefined) return
    const span = this.lastSpan()
    const content = parseQuotedText(lit)
    return { $r: RuleKind.Literal, content, span }
  }

  private parseCharSet(): Rule | undefined {
    if (this.consume(Token.OpenBracket)) {
      const startSpan = this.lastSpan()

      const inner = this.parseCharSetInner()

      try {
        this.expect(Token.CloseBracket)
      } catch (error) {
        throw ParseError.expected(
          (error as ParseError).span,
          'character class, string, code point, Unicode property or `]`',
        )
      }
      const span = join(startSpan, this.lastSpan())

      if (inner.length === 0) {
        throw new ParseError(ParseErrorKind.EmptyCharSet, span)
      }
      return {
        $r: RuleKind.CharClass,
        inner,
        span,
        isUnicodeAware: this.isUnicodeAware,
      }
    }
  }

  private parseCharSetInner(): GroupItem[] {
    const items: GroupItem[] = []
    for (;;) {
      const notSpan = this.span()
      const negative = this.consume(Token.Not)

      const charsOrRange = this.parseCharGroupCharsOrRange()
      if (charsOrRange && negative) {
        throw new ParseError(ParseErrorKind.UnallowedNotInCharSet, notSpan)
      }
      const group = charsOrRange ?? this.parseCharGroupIdent(negative)
      if (group === undefined) {
        if (negative) {
          throw new ParseError(ParseErrorKind.ExpectedToken, this.span(), Token.Identifier)
        }
        break
      }
      items.push(...group)
    }
    return items
  }

  private parseCharGroupCharsOrRange(): GroupItem[] | undefined {
    const span1 = this.span()
    const first = this.parseStringOrChar()
    if (first === undefined) return

    if (this.consume(Token.Dash)) {
      const span2 = this.span()
      const last = this.parseStringOrChar()
      if (last === undefined) {
        throw ParseError.expected(this.span(), 'code point or character')
      }

      const firstChar = stringOrCharToString(first, span1)
      const lastChar = stringOrCharToString(last, span2)
      if (firstChar > lastChar) {
        throw new ParseError(ParseErrorKind.NotAscendingCharRange, this.span())
      }
      return [{ first: firstChar, last: lastChar }]
    } else if (typeof first === 'string') {
      const [...chars] = parseQuotedText(first)
      return chars.map((c) => ({ char: c.codePointAt(0)! }))
    } else {
      return [{ char: first.char }]
    }
  }

  private parseStringOrChar(): string | { char: number; isShorthand: boolean } | undefined {
    const string = this.consumeAs(Token.String)
    if (string !== undefined) return string

    const cp = this.parseCodePoint()
    if (cp !== undefined) return { char: cp[0], isShorthand: false }

    const special = this.parseSpecialChar()
    if (special !== undefined) return { char: special, isShorthand: true }
  }

  private parseSpecialChar(): number | undefined {
    const next = this.peek()
    if (next?.[0] === Token.Identifier) {
      const char = next[1]
      if (char in specialChars) {
        this.advance()
        return specialChars[char].codePointAt(0)
      }
    }
  }

  // This doesn't check if the name is valid
  private parseCharGroupIdent(negative: boolean): GroupItem[] | undefined {
    const beforeColon = this.consumeAs(Token.Identifier)
    if (beforeColon === undefined) return

    let span = this.lastSpan()
    const afterColon = this.consume(Token.Colon) ? this.expectAs(Token.Identifier) : undefined
    span = join(span, this.lastSpan())
    const name = afterColon ?? beforeColon
    const kind = afterColon ? beforeColon : undefined

    return [{ name, span, kind, negative }]
  }

  private parseBoundary(): Rule | undefined {
    const span = this.span()
    let kind: BoundaryKind
    if (this.consume(Token.Caret)) {
      kind = BoundaryKind.Start
    } else if (this.consume(Token.Dollar)) {
      kind = BoundaryKind.End
    } else if (this.consume(Token.Percent)) {
      kind = BoundaryKind.Word
    } else if (this.consume(Token.AngleLeft)) {
      kind = BoundaryKind.WordStart
    } else if (this.consume(Token.AngleRight)) {
      kind = BoundaryKind.WordEnd
    } else {
      return
    }
    return { $r: RuleKind.Boundary, kind, span }
  }

  private parseReference(): Rule | undefined {
    if (this.consume(Token.DoubleColon)) {
      const startSpan = this.lastSpan()
      let target: ReferenceTarget
      if (this.consume(Token.Plus)) {
        const num = this.expectNumber()
        target = { relative: num }
      } else if (this.consume(Token.Dash)) {
        const num = this.expectNumber()
        target = { relative: -num }
      } else {
        const number = this.consumeNumber(65_535)
        if (number !== undefined) {
          target = { number }
        } else {
          try {
            const name = this.expectAs(Token.Identifier)
            target = { name }
          } catch (error) {
            throw ParseError.expected((error as ParseError).span, 'number or group name')
          }
        }
      }

      const span = join(startSpan, this.lastSpan())
      return { $r: RuleKind.Reference, target, span }
    }
  }

  private parseCodePointRule(): Rule | undefined {
    const cp = this.parseCodePoint()
    if (cp === undefined) return
    const [char, span] = cp
    return {
      $r: RuleKind.CharClass,
      inner: [{ char }],
      span,
      isUnicodeAware: this.isUnicodeAware,
    }
  }

  private parseCodePoint(): [number, Span] | undefined {
    const cp = this.consumeAs(Token.CodePoint)
    if (cp === undefined) return

    const span = this.lastSpan()
    const trimmed = cp.replace(/^U\s*\+?\s*/, '')
    const num = Number.parseInt(trimmed, 16)
    if ((num >= 0xd800 && num <= 0xdfff) || num > 0x10ffff) {
      throw new ParseError(ParseErrorKind.InvalidCodePoint, span)
    }
    return [num, span]
  }

  private parseRange(): Rule | undefined {
    if (this.consumeReserved('range')) {
      const spanStart = this.lastSpan()
      const first = this.expectAs(Token.String)

      this.expect(Token.Dash)

      const second = this.expectAs(Token.String)

      let radix = 10
      if (this.consumeReserved('base')) {
        radix = this.expectNumber()
        if (radix > 36 || radix < 2) {
          throw new ParseError(ParseErrorKind.InvalidRangeBase, this.lastSpan())
        }
      }

      const span = join(spanStart, this.lastSpan())

      const start = stripFirstLast(first)
      const end = stripFirstLast(second)

      // TODO: Some validation missing

      return { $r: RuleKind.Range, start, end, radix, span }
    }
  }

  private parseRegex(): Rule | undefined {
    if (this.consumeReserved('regex')) {
      const spanStart = this.lastSpan()
      const lit = this.expectAs(Token.String)
      const spanEnd = this.lastSpan()

      const content = parseQuotedText(lit)
      const span = join(spanStart, spanEnd)
      return { $r: RuleKind.Regex, content, span }
    }
  }

  private parseVariable(): Rule | undefined {
    const name = this.consumeAs(Token.Identifier)
    if (name === undefined) return
    const span = this.lastSpan()
    return { $r: RuleKind.Variable, name, span }
  }

  private parseDot(): Rule | undefined {
    if (this.consume(Token.Dot)) {
      return { $r: RuleKind.Dot, span: this.lastSpan() }
    }
  }

  private parseRecursion(): Rule | undefined {
    if (this.consumeReserved('recursion')) {
      return { $r: RuleKind.Recursion, span: this.lastSpan() }
    }
  }
}

const specialChars: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  a: '\u{07}',
  e: '\u{1B}',
  f: '\u{0C}',
}
