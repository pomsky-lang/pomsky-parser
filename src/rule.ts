export const enum RuleKind {
  Literal,
  CharClass,
  Group,
  Alternation,
  Intersection,
  Repetition,
  Boundary,
  Lookaround,
  Variable,
  Reference,
  Range,
  StmtExpr,
  Negation,
  Regex,
  Recursion,
  Dot,
}

interface IRule {
  $r: RuleKind
  span: Span
}

export type Rule =
  | Literal
  | CharClass
  | Group
  | Alternation
  | Intersection
  | Repetition
  | Boundary
  | Lookaround
  | Variable
  | Reference
  | Range
  | StmtExpr
  | Negation
  | Regex
  | Recursion
  | Dot

export type Span = [number, number]

export interface Literal extends IRule {
  $r: RuleKind.Literal
  content: string
}

export interface CharClass extends IRule {
  $r: RuleKind.CharClass
  inner: GroupItem[]
  isUnicodeAware: boolean
}

export type GroupItem =
  | { char: number }
  | { first: number; last: number }
  | { name: string; negative: boolean; kind?: string; span: Span }

export interface Group extends IRule {
  $r: RuleKind.Group
  rules: Rule[]
  kindOrName: GroupKind | string
}

export const enum GroupKind {
  Capturing,
  Atomic,
  Normal,
  Implicit,
}

export interface Alternation extends IRule {
  $r: RuleKind.Alternation
  rules: Rule[]
}

export interface Intersection extends IRule {
  $r: RuleKind.Intersection
  rules: Rule[]
}

export interface Repetition extends IRule {
  $r: RuleKind.Repetition
  rule: Rule
  kind: RepetitionKind
  quantifier: Quantifier
}

export interface RepetitionKind {
  lower: number
  upper?: number
}

export const enum Quantifier {
  Greedy,
  Lazy,
  DefaultGreedy,
  DefaultLazy,
}

export interface Boundary extends IRule {
  $r: RuleKind.Boundary
  kind: BoundaryKind
}

export const enum BoundaryKind {
  Start,
  End,
  Word,
  NotWord,
  WordStart,
  WordEnd,
}

export interface Lookaround extends IRule {
  $r: RuleKind.Lookaround
  kind: LookaroundKind
  rule: Rule
}

export const enum LookaroundKind {
  Ahead,
  Behind,
  AheadNegative,
  BehindNegative,
}

export interface Variable extends IRule {
  $r: RuleKind.Variable
  name: string
}

export interface Reference extends IRule {
  $r: RuleKind.Reference
  target: ReferenceTarget
}

export type ReferenceTarget = { name: string } | { number: number } | { relative: number }

export interface Range extends IRule {
  $r: RuleKind.Range
  start: string
  end: string
  radix: number
}

export interface StmtExpr extends IRule {
  $r: RuleKind.StmtExpr
  stmt: Stmt
  rule: Rule
}

export type Stmt = EnableStmt | DisableStmt | LetStmt | TestStmt

export const enum StmtKind {
  Enable,
  Disable,
  Let,
  Test,
}

export interface EnableStmt {
  $s: StmtKind.Enable
  setting: BooleanSetting
  span: Span
}

export const enum BooleanSetting {
  Lazy,
  Unicode,
}

export interface DisableStmt {
  $s: StmtKind.Disable
  setting: BooleanSetting
  span: Span
}

export interface LetStmt {
  $s: StmtKind.Let
  name: string
  nameSpan: Span
  rule: Rule
}

export interface TestStmt {
  $s: StmtKind.Test
  cases: TestCase[]
  span: Span
}

export type TestCase = TestCaseMatch | TestCaseMatchAll | TestCaseReject

export const enum TestCaseKind {
  Match,
  MatchAll,
  Reject,
}

export interface TestCaseMatch {
  $t: TestCaseKind.Match
  literal: Literal
  captures: TestCapture[]
  span: Span
}

export interface TestCaseMatchAll {
  $t: TestCaseKind.MatchAll
  literal: Literal
  matches: TestCaseMatch[]
}

export interface TestCaseReject {
  $t: TestCaseKind.Reject
  literal: Literal
  asSubstring: boolean
}

export interface TestCapture {
  ident: string | number
  identSpan: Span
  literal: Literal
}

export interface Negation extends IRule {
  $r: RuleKind.Negation
  rule: Rule
  notSpan: Span
}

export interface Regex extends IRule {
  $r: RuleKind.Regex
  content: string
}

export interface Recursion extends IRule {
  $r: RuleKind.Recursion
}

export interface Dot extends IRule {
  $r: RuleKind.Dot
}
