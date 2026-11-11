import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveTemplatePath, DENIED_FOLDERS } from '../src/templateResolver.js';

describe('resolveTemplatePath', () => {
  let viewsRoot: string;

  const touch = (rel: string) => {
    const file = path.join(viewsRoot, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
  };

  beforeAll(() => {
    viewsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'views-'));
    touch('sections/product-template.liquid');
    touch('snippets/hero.liquid');
    touch('templates/product.liquid');
    touch('assets/style.liquid');
    touch('layout/theme.liquid');
    touch('config/settings_schema.liquid');
    touch('locales/en/default.liquid');
  });

  afterAll(() => {
    fs.rmSync(viewsRoot, { recursive: true, force: true });
  });

  it('returns the folder-prefixed path for a dotted section name', () => {
    expect(resolveTemplatePath(viewsRoot, 'sections.product-template')).toBe('sections/product-template');
  });

  it.each(['layout.theme', 'config.settings_schema', 'locales.en.default'])(
    'refuses %s even though the file exists',
    (liquidPath) => {
      expect(resolveTemplatePath(viewsRoot, liquidPath)).toBeNull();
    }
  );

  it.each(DENIED_FOLDERS)('never resolves into %s/, by dotted or bare name', (folder) => {
    touch(`${folder}/probe_${folder}.liquid`);

    expect(resolveTemplatePath(viewsRoot, `${folder}.probe_${folder}`)).toBeNull();
    expect(resolveTemplatePath(viewsRoot, `probe_${folder}`)).toBeNull();
  });

  // liquidjs looks a bare name up across every engine root, layout/ included, so the
  // resolver must not hand it a bare name it found only in a denied folder.
  it('refuses a bare name that exists only under layout/', () => {
    expect(resolveTemplatePath(viewsRoot, 'theme')).toBeNull();
  });

  it('prefixes a bare name with the allowed folder it was found in', () => {
    expect(resolveTemplatePath(viewsRoot, 'hero')).toBe('snippets/hero');
  });

  // Same precedence as the engine roots, so existing bare names keep rendering the same file.
  it('prefers snippets/ over sections/ for a bare name found in both', () => {
    touch('snippets/card.liquid');
    touch('sections/card.liquid');

    expect(resolveTemplatePath(viewsRoot, 'card')).toBe('snippets/card');
  });

  it.each([
    ['traversal', 'x/../../etc/passwd'],
    ['an absolute path', '/etc/passwd'],
    ['traversal out of an allowed folder', 'sections/../layout/theme'],
    ['a missing file', 'sections.missing'],
    ['a null byte', 'sections\u0000'],
  ])('returns null for %s', (_name, liquidPath) => {
    expect(resolveTemplatePath(viewsRoot, liquidPath)).toBeNull();
  });
});
