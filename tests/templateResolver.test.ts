import { resolveTemplatePath } from '../src/templateResolver.js';
import { writeTemplate } from './helpers.js';

describe('resolveTemplatePath', () => {
  const viewsRoot = process.env.MIDDLEWARE_VIEWS_PATH as string;

  beforeAll(() => {
    writeTemplate('index.liquid');
    writeTemplate('sections/product-template.liquid');
    writeTemplate('snippets/hero.liquid');
    writeTemplate('templates/product.liquid');
    writeTemplate('assets/style.liquid');
    writeTemplate('layout/theme.liquid');
    writeTemplate('config/settings_schema.liquid');
    writeTemplate('locales/en/default.liquid');
    writeTemplate('custom/foo.liquid');
    writeTemplate('templates/customers/account.liquid');
    writeTemplate('layout/only/here.liquid');
  });

  it('returns the folder-prefixed path for a dotted section name', () => {
    expect(resolveTemplatePath(viewsRoot, 'sections.product-template')).toBe('sections/product-template');
  });

  // Merchants add their own folders under views/; only the protected ones are off limits.
  it('returns a template from a folder the merchant added', () => {
    expect(resolveTemplatePath(viewsRoot, 'custom.foo')).toBe('custom/foo');
  });

  // Keeps the old engine-root lookup: liquidjs used to find customers/account under templates/.
  it('falls back to the bare-name folders for a multi-segment path not directly in views/', () => {
    expect(resolveTemplatePath(viewsRoot, 'customers.account')).toBe('templates/customers/account');
  });

  it('refuses a multi-segment path that exists only under a protected folder', () => {
    expect(resolveTemplatePath(viewsRoot, 'only.here')).toBeNull();
  });

  // The route allows uppercase, and on a case-insensitive filesystem Layout/ is layout/.
  it.each(['Layout.theme', 'CONFIG.settings_schema', 'Locales.en.default'])(
    'refuses %s regardless of case',
    (liquidPath) => {
      expect(resolveTemplatePath(viewsRoot, liquidPath)).toBeNull();
    }
  );

  it('returns a template that sits directly in views/ under its own name', () => {
    expect(resolveTemplatePath(viewsRoot, 'index')).toBe('index');
  });

  it.each(['layout.theme', 'config.settings_schema', 'locales.en.default'])(
    'refuses %s even though the file exists',
    (liquidPath) => {
      expect(resolveTemplatePath(viewsRoot, liquidPath)).toBeNull();
    }
  );

  it.each(['layout', 'config', 'locales'])('never resolves into %s/, by dotted or bare name', (folder) => {
    writeTemplate(`${folder}/probe_${folder}.liquid`);

    expect(resolveTemplatePath(viewsRoot, `${folder}.probe_${folder}`)).toBeNull();
    expect(resolveTemplatePath(viewsRoot, `probe_${folder}`)).toBeNull();
  });

  // liquidjs would find a bare name in layout/ too, since layout/ is an engine root.
  it('refuses a bare name that exists only under layout/', () => {
    expect(resolveTemplatePath(viewsRoot, 'theme')).toBeNull();
  });

  it('prefixes a bare name with the allowed folder it was found in', () => {
    expect(resolveTemplatePath(viewsRoot, 'hero')).toBe('snippets/hero');
  });

  // Same precedence as the engine roots, so existing bare names keep rendering the same file.
  it('prefers snippets/ over sections/ for a bare name found in both', () => {
    writeTemplate('snippets/card.liquid');
    writeTemplate('sections/card.liquid');

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
