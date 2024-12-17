import type { ParseError } from '../src/parser.js'
import type { Group, Repetition, Rule, Stmt } from '../src/rule.js'
import { BooleanSetting, GroupKind, Quantifier, RuleKind, StmtKind } from '../src/rule.js'

const ruleIdents: Record<RuleKind, string> = {
  [RuleKind.Literal]: 'Literal',
  [RuleKind.CharClass]: 'CharClass',
  [RuleKind.Group]: 'Group',
  [RuleKind.Alternation]: 'Alternation',
  [RuleKind.Intersection]: 'Intersection',
  [RuleKind.Repetition]: 'Repetition',
  [RuleKind.Boundary]: 'Boundary',
  [RuleKind.Lookaround]: 'Lookaround',
  [RuleKind.Variable]: 'Variable',
  [RuleKind.Reference]: 'Reference',
  [RuleKind.Range]: 'Range',
  [RuleKind.StmtExpr]: 'StmtExpr',
  [RuleKind.Negation]: 'Negation',
  [RuleKind.Regex]: 'Regex',
  [RuleKind.Recursion]: 'Recursion',
  [RuleKind.Grapheme]: 'Grapheme',
  [RuleKind.Codepoint]: 'Codepoint',
  [RuleKind.Dot]: 'Dot',
}

const groupIdents: Record<GroupKind, string> = {
  [GroupKind.Capturing]: 'Capturing',
  [GroupKind.Atomic]: 'Atomic',
  [GroupKind.Normal]: 'Normal',
  [GroupKind.Implicit]: 'Implicit',
}

const quantifierIdents: Record<Quantifier, string> = {
  [Quantifier.DefaultGreedy]: 'DefaultGreedy',
  [Quantifier.DefaultLazy]: 'DefaultLazy',
  [Quantifier.Greedy]: 'Greedy',
  [Quantifier.Lazy]: 'Lazy',
}

const stmtIdents: Record<StmtKind, string> = {
  [StmtKind.Enable]: 'Enable',
  [StmtKind.Disable]: 'Disable',
  [StmtKind.Let]: 'Let',
  [StmtKind.Test]: 'Test',
}

const booleanSettingIdents: Record<BooleanSetting, string> = {
  [BooleanSetting.Lazy]: 'Lazy',
  [BooleanSetting.Unicode]: 'Unicode',
}

export function processRule(rule: Rule | ParseError[]) {
  if (Array.isArray(rule)) return rule

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let ruleNew: any = { ...rule }
  ruleNew.$r = ruleIdents[rule.$r]
  switch (rule.$r) {
    case RuleKind.Group:
      ruleNew = processGroup(ruleNew)
      break
    case RuleKind.Alternation:
      ruleNew.rules = rule.rules.map(processRule)
      break
    case RuleKind.Intersection:
      ruleNew.rules = rule.rules.map(processRule)
      break
    case RuleKind.Repetition:
      ruleNew = processRepetition(ruleNew)
      break
    case RuleKind.CharClass:
    case RuleKind.Lookaround:
    case RuleKind.Boundary:
    case RuleKind.Reference:
      break
    case RuleKind.StmtExpr:
      ruleNew.rule = processRule(rule.rule)
      ruleNew.stmt = processStmt(rule.stmt)
      break
  }
  return ruleNew
}

function processGroup(group: Group) {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const groupNew: any = { ...group }
  if (typeof group.kindOrName !== 'string') {
    groupNew.kindOrName = groupIdents[group.kindOrName]
  }
  groupNew.parts = group.parts.map(processRule)
  return groupNew
}

function processRepetition(rep: Repetition) {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const repNew: any = { ...rep }
  repNew.quantifier = quantifierIdents[rep.quantifier]
  repNew.rule = processRule(rep.rule)
  return repNew
}

function processStmt(stmt: Stmt) {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const stmtNew: any = { ...stmt }
  stmtNew.$s = stmtIdents[stmt.$s]
  switch (stmt.$s) {
    case StmtKind.Enable:
    case StmtKind.Disable:
      stmtNew.setting = booleanSettingIdents[stmt.setting]
      break
    case StmtKind.Let:
      stmtNew.rule = processRule(stmt.rule)
      break
    case StmtKind.Test:
  }
  return stmtNew
}
