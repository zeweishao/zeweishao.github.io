import { build } from 'esbuild';
import { rmSync } from 'node:fs';

// The list code ships alone; three.js and the viewer become a separate chunk loaded on first open.
rmSync('../figures', { recursive: true, force: true });
await build({
  entryPoints: ['app.js'],
  outdir: '../figures',
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  chunkNames: 'chunks/[name]-[hash]',
  legalComments: 'eof',
});
