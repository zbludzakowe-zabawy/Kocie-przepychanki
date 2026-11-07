import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/**
 * Po buildzie zapisuje dist/sw.js na podstawie src/sw-template.js. Wersja to skrót
 * wszystkich publikowanych plików, więc każde wdrożenie ze zmianami to nowy
 * service worker, a aplikacja pokazuje „Dostępna nowa wersja”.
 */
function serviceWorker() {
  let outDir = 'dist';
  return {
    name: 'kocie-service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir)
        .filter((f) => !f.endsWith('sw.js'))
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(relative(outDir, f)).update(readFileSync(f));
      const version = hash.digest('hex').slice(0, 12);
      const assets = ['./', ...files.map((f) => './' + relative(outDir, f).split('\\').join('/'))];
      const sw = readFileSync('src/sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__ASSETS__', JSON.stringify(assets));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

// `npm run build` tworzy samodzielny dist/index.html (plus manifest, ikony
// i service worker do instalowania aplikacji na telefonie).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile(), serviceWorker()],
});
