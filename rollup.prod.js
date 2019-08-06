import common from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import { terser } from "rollup-plugin-terser";

const plugins = [
    babel({exclude: 'node_modules/**'}),
    resolve(),
    common(),
    terser()
]

module.exports = {
    input: 'src/index.js',
    output: {
      file: 'dist/pjax.min.js',
      name: 'pjax',
      format: 'umd',
    },
    plugins
  };