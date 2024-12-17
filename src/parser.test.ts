import { expect, test } from 'vitest'
import { parse } from './parser.js'
import { processRule } from '../tests/testHelper.js'

test('parsing char set works', () => {
  expect(processRule(parse('[n w]'))).toEqual({
    $r: 'CharClass',
    inner: [{ char: 10 }, { name: 'w', kind: undefined, negative: false, span: [3, 4] }],
    isUnicodeAware: true,
    span: [0, 5],
  })
})

test('parsing variables works', () => {
  expect(processRule(parse('x y'))).toEqual({
    $r: 'Group',
    kindOrName: 'Implicit',
    parts: [
      { $r: 'Variable', name: 'x', span: [0, 1] },
      { $r: 'Variable', name: 'y', span: [2, 3] },
    ],
    span: [0, 3],
  })
})

test('parsing statements works', () => {
  expect(processRule(parse('let x = (); disable unicode; enable lazy; x'))).toEqual({
    $r: 'StmtExpr',
    span: [0, 43],
    stmt: {
      $s: 'Let',
      name: 'x',
      nameSpan: [4, 5],
      rule: {
        $r: 'Group',
        kindOrName: 'Normal',
        span: [8, 10],
        parts: [{ $r: 'Literal', content: '', span: [0, 0] }],
      },
    },
    rule: {
      $r: 'StmtExpr',
      span: [12, 43],
      stmt: { $s: 'Disable', setting: 'Unicode', span: [12, 28] },
      rule: {
        $r: 'StmtExpr',
        span: [29, 43],
        stmt: { $s: 'Enable', setting: 'Lazy', span: [29, 41] },
        rule: { $r: 'Variable', name: 'x', span: [42, 43] },
      },
    },
  })
})

test('parsing statements works', () => {
  expect(processRule(parse('let x = (); disable unicode; enable lazy; x'))).toEqual({
    $r: 'StmtExpr',
    span: [0, 43],
    stmt: {
      $s: 'Let',
      name: 'x',
      nameSpan: [4, 5],
      rule: {
        $r: 'Group',
        kindOrName: 'Normal',
        span: [8, 10],
        parts: [{ $r: 'Literal', content: '', span: [0, 0] }],
      },
    },
    rule: {
      $r: 'StmtExpr',
      span: [12, 43],
      stmt: { $s: 'Disable', setting: 'Unicode', span: [12, 28] },
      rule: {
        $r: 'StmtExpr',
        span: [29, 43],
        stmt: { $s: 'Enable', setting: 'Lazy', span: [29, 41] },
        rule: { $r: 'Variable', name: 'x', span: [42, 43] },
      },
    },
  })
})
