const input = ['./out/index.js', './out/tokenizer.js', './out/rule.js']

export default [
  {
    input,
    output: {
      sourcemap: true,
      dir: 'dist',
      format: 'cjs',
    },
  },
  {
    input,
    output: {
      sourcemap: true,
      dir: 'dist',
      format: 'es',
      entryFileNames: '[name].mjs',
    },
  },
]
