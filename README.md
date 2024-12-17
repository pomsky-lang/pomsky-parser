# `@pomsky-lang/parser`

An npm module for parsing [Pomsky](https://pomsky-lang.org/) files, written in TypeScript.

This module is used for the [VSCode extension](https://github.com/pomsky-lang/pomsky-vscode).

## Usage

```ts
import { parse } from '@pomsky-lang/parser'

const pomskyExpression = '"Hello, world!"'

const ast = parse(pomskyExpression)
if (Array.isArray(ast)) {
  throw new Error('Parse errors occurred')
}
```

### Tokenize only

```ts
import { tokenize } from '@pomsky-lang/parser/tokenizer'

const pomskyExpression = '"Hello, world!"'

const tokens = tokenize(pomskyExpression)
```

### Tokenize and parse separately

```ts
import { parse, tokenize } from '@pomsky-lang/parser'

const pomskyExpression = '"Hello, world!"'

const tokens = tokenize(pomskyExpression)
const ast = parse(pomskyExpression, tokens)
if (Array.isArray(ast)) {
  throw new Error('Parse errors occurred')
}
```

### Import types

The types for AST nodes (including `const enum`s) can be imported from `'@pomsky-lang/parser/rule'`.

## Donations

Pomsky is a passion project, so I rely on donations to make it financially sustainable. If you like this module, consider sponsoring my work on [GitHub Sponsors](https://github.com/sponsors/Aloso).

## Contributing

- Make sure your code is formatted with prettier, passes `biome lint`, and type-checks. We still have to add these checks to CI.
- Please follow [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/).
- Please adhere to the [code of conduct](https://github.com/pomsky-lang/pomsky/blob/main/CODE_OF_CONDUCT.md).

This parser is currently lacking unit and integration tests. If you want to contribute, integrating the [Rust test suite](https://github.com/pomsky-lang/pomsky/tree/main/pomsky-lib/tests) would be a great way to start.

## License

Dual-licensed under the [MIT](./LICENSE-MIT) and [Apache 2.0](./LICENSE-APACHE) license.
