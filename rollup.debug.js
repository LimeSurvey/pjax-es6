import common from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import { terser } from "rollup-plugin-terser";

const plugins = [
    babel({exclude: 'node_modules/**'}),
    resolve(),
    common(),
]
module.exports = {
    input: 'src/index.js',
    output: {
      file: 'dist/pjax.js',
      format: 'umd',
      name: 'pjax',
      sourcemap: true,
    },
    plugins
  };