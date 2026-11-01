import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDiscoverer } from '#discover.ts';

test('registry imports retain their identity with aliases and missing output files', () => {
  const root = mkdtempSync(join(import.meta.dir, '.discovery-'));
  try {
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: 'ESNext',
          moduleResolution: 'Bundler',
          types: ['bun'],
          paths: { '@generated/*': ['./generated/*'] },
        },
      }),
    );
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ imports: { '#registry': './generated/registry.ts' } }),
    );
    const file = join(root, 'queries.ts');
    const registryPath = join(root, 'generated/registry.ts');
    writeFileSync(join(root, 'other.ts'), 'export interface Queries { Other: unknown }');
    writeFileSync(
      file,
      [
        "import { sql } from 'bun';",
        "import type { Queries as Q } from './generated/registry.js';",
        "import type { Queries as PathQueries } from '@generated/registry';",
        "import type { Queries as SubpathQueries } from '#registry';",
        "import type { Queries as Other } from './other';",
        'interface Queries { Local: unknown }',
        "sql<Q['Aliased'][]>`SELECT 1`;",
        "sql<Array<PathQueries['Paths']>>`SELECT 2`;",
        "sql<SubpathQueries['Subpath'][]>`SELECT 3`;",
        "sql<Other['Other'][]>`SELECT 4`;",
        "sql<Queries['Local'][]>`SELECT 5`;",
        "function shadow<Q>() { return sql<Q['Shadow'][]>`SELECT 6`; }",
      ].join('\n'),
    );
    const names = () =>
      createDiscoverer({ projectRoot: root, registryPath, files: [file] })(file).map(
        (query) => query.name,
      );
    expect(names()).toEqual(['Aliased', 'Paths', 'Subpath']);
    mkdirSync(join(root, 'generated'));
    writeFileSync(
      registryPath,
      'export interface Queries { Aliased: unknown; Paths: unknown; Subpath: unknown }',
    );
    expect(names()).toEqual(['Aliased', 'Paths', 'Subpath']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
