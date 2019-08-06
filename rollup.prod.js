import common from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import { terser } from "rollup-plugin-terser";

const plugins = [
    babel({
        exclude: 'node_modules/**',
        "presets": [
            [
              "@babel/preset-env",
              {
                modules: false,
                "targets": {
                    "browsers": ["last 2 versions"]
                }
              }
            ]
          ],
    }),
    resolve(),
    common(),
    terser()
]

module.exports = {
    input: 'src/index.js',
    output: {
      file: 'dist/pjax.min.js',
      name: 'Pjax',
      format: 'umd',
    },
    plugins
  };