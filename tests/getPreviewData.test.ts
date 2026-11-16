import { jest } from '@jest/globals';
import { Writable } from 'stream';
import { LivePreviewShopify } from '@contentstack/shopify-live-preview-sdk';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/app.js';
import { writeTemplate } from './helpers.js';

// The controller captured this exact instance and its liquid engine at import time.
// getInstance() must be called with NO config here: passing one re-runs initialize(),
// which swaps in a fresh Liquid engine and would orphan the reference the controller
// already holds, making renderFile spies invisible to the handler.
const livePreviewShopify = LivePreviewShopify.getInstance();
const engine = livePreviewShopify.getLiquidEngine();

// Captured before any spying so the passthrough below calls the real implementation.
const realCreateContentTypeKeyBased = LivePreviewShopify.prototype.createContentTypeKeyBased;

// CDA include_schema=true returns `schema` as the field array itself — never wrapped in
// another array. Pinning that shape is the point of the regression case below.
const previewSchemaFixture = [
  { uid: 'title', data_type: 'text', display_name: 'Title' },
  { uid: 'description', data_type: 'text', display_name: 'Description' },
];

const previewEntryFixture = {
  uid: 'entry_123',
  title: 'Updated title',
  description: 'Updated description',
};

// Real hashes are 32 hex chars; the route schema wants 16-64 alphanumerics.
const PREVIEW_HASH = '0123456789abcdef0123456789abcdef';

const buildPreviewRequestBody = (overrides: Record<string, any> = {}) => ({
  live_preview: PREVIEW_HASH,
  ctUid: 'product_ct',
  entryUid: 'entry_123',
  locale: 'en-us',
  theme_variable: {
    liquid_path: 'sections.product-template',
    data_cslp: 'product_ct.entry_123.en-us.title',
    payload: {},
  },
  ...overrides,
});

// Captures fastify's JSON log lines so cases can assert what reaches the deployment logs.
const buildLoggedApp = async () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const app = buildServer({ logger: { level: 'warn', stream } as any });
  await app.ready();
  return { app, logs: () => lines.map((line) => JSON.parse(line)), raw: () => lines.join('') };
};

beforeAll(() => {
  writeTemplate('sections/product-template.liquid');
  writeTemplate('sections/main-collection.liquid');
  writeTemplate('layout/theme.liquid', 'LAYOUT');
  writeTemplate('templates/baz.liquid', 'TEMPLATE');
  writeTemplate('layout/baz.liquid', 'LAYOUT');
  writeTemplate('layout/bar.liquid', 'LAYOUT');
  writeTemplate('custom/foo.liquid', 'CUSTOM');
  writeTemplate('config/x.liquid', 'CONFIG');
});

describe('POST /get-preview-data', () => {
  let app: FastifyInstance;
  let fetchDataSpy: any;
  let keyBasedSpy: any;
  let renderFileSpy: any;
  let updatedMetafieldsSpy: any;
  let updatedMetaobjectSpy: any;

  beforeEach(async () => {
    app = buildServer({ logger: false });
    await app.ready();

    // jest.config.cjs sets restoreMocks/resetMocks/clearMocks, so every spy has to be
    // re-established here rather than once at suite level.
    fetchDataSpy = jest
      .spyOn(livePreviewShopify, 'fetchData')
      .mockResolvedValue({ schema: previewSchemaFixture, entry: previewEntryFixture } as never);

    // Passthrough: keeps the real key-based map (so downstream branches get a real
    // keyBasedCt) while still recording the argument it was handed.
    keyBasedSpy = jest
      .spyOn(livePreviewShopify, 'createContentTypeKeyBased')
      .mockImplementation(((schema: any) =>
        realCreateContentTypeKeyBased.call(livePreviewShopify, schema)) as never);

    renderFileSpy = jest.spyOn(engine, 'renderFile').mockResolvedValue('<div>rendered</div>' as never);

    updatedMetafieldsSpy = jest
      .spyOn(livePreviewShopify, 'getUpdatedProductMetafields')
      .mockResolvedValue({ updated: 'metafields' } as never);

    updatedMetaobjectSpy = jest
      .spyOn(livePreviewShopify, 'getUpdatedMetaobject')
      .mockResolvedValue({ currentMetaobjects: { updated: 'metaobject' } } as never);
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (payload: unknown) =>
    app.inject({ method: 'POST', url: '/get-preview-data', payload: payload as any });

  describe('happy path', () => {
    it('renders the liquid path with the payload and returns html', async () => {
      const res = await post(buildPreviewRequestBody());

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ html: '<div>rendered</div>' });
      // dots in liquid_path become slashes before hitting the engine
      expect(renderFileSpy).toHaveBeenCalledWith('sections/product-template', {});
    });

    it('forwards ctUid, entryUid, hash and locale to fetchData', async () => {
      await post(buildPreviewRequestBody());

      expect(fetchDataSpy).toHaveBeenCalledWith('product_ct', 'entry_123', PREVIEW_HASH, 'en-us');
    });

    it('skips both enrichment branches when payload has no product or metaobjects', async () => {
      await post(buildPreviewRequestBody());

      expect(updatedMetafieldsSpy).not.toHaveBeenCalled();
      expect(updatedMetaobjectSpy).not.toHaveBeenCalled();
    });

    it('still returns 200 when the CDA returns an empty schema array', async () => {
      fetchDataSpy.mockResolvedValue({ schema: [], entry: previewEntryFixture } as never);

      const res = await post(buildPreviewRequestBody());

      expect(res.statusCode).toBe(200);
      expect(keyBasedSpy).toHaveBeenCalledWith([]);
    });
  });

  describe('regression: CDA schema is passed through unwrapped', () => {
    it('calls createContentTypeKeyBased with the field array itself, not a wrapped array', async () => {
      await post(buildPreviewRequestBody());

      expect(keyBasedSpy).toHaveBeenCalledWith(previewSchemaFixture);

      // Guards the exact bug that was fixed: the argument must be the field array, so
      // its first element is a field object — not a nested array.
      const [passedSchema] = keyBasedSpy.mock.calls[0];
      expect(Array.isArray(passedSchema)).toBe(true);
      expect(Array.isArray(passedSchema[0])).toBe(false);
      expect(passedSchema[0]).toHaveProperty('uid', 'title');
    });
  });

  describe('product metafields branch', () => {
    const productBody = () =>
      buildPreviewRequestBody({
        theme_variable: {
          liquid_path: 'sections.product-template',
          data_cslp: 'product_ct.entry_123.en-us.title',
          payload: {
            product: { metafields: { contentstack_products: { existing: 'metafield' } } },
          },
        },
      });

    it('calls getUpdatedProductMetafields with the current metafields, entry and ids', async () => {
      await post(productBody());

      expect(updatedMetafieldsSpy).toHaveBeenCalledTimes(1);
      const [currentMetafields, keyBasedCt, entry, options] = updatedMetafieldsSpy.mock.calls[0];
      expect(currentMetafields).toEqual({ existing: 'metafield' });
      expect(entry).toEqual(previewEntryFixture);
      expect(options).toEqual({
        ctUid: 'product_ct',
        entryUid: 'entry_123',
        hash: PREVIEW_HASH,
      });
      // built by the real createContentTypeKeyBased, keyed by field uid
      expect(keyBasedCt).toHaveProperty('title');
    });

    it('assigns the resolved metafields back onto the render data', async () => {
      await post(productBody());

      const [, renderData] = renderFileSpy.mock.calls[0];
      expect(renderData.product.metafields.contentstack_products).toEqual({ updated: 'metafields' });
    });
  });

  // VP-2702: collection pages carry their Contentstack fields as collection metafields.
  describe('collection metafields branch', () => {
    const collectionBody = (payload: Record<string, any> = {}) =>
      buildPreviewRequestBody({
        theme_variable: {
          liquid_path: 'sections.main-collection',
          data_cslp: 'product_ct.entry_123.en-us.title',
          payload: {
            collection: { metafields: { contentstack_collections: { existing: 'collection-metafield' } } },
            ...payload,
          },
        },
      });

    it('calls getUpdatedProductMetafields with the collection metafields, entry and ids', async () => {
      await post(collectionBody());

      expect(updatedMetafieldsSpy).toHaveBeenCalledTimes(1);
      const [currentMetafields, , entry, options] = updatedMetafieldsSpy.mock.calls[0];
      expect(currentMetafields).toEqual({ existing: 'collection-metafield' });
      expect(entry).toEqual(previewEntryFixture);
      expect(options).toEqual({
        ctUid: 'product_ct',
        entryUid: 'entry_123',
        hash: PREVIEW_HASH,
      });
    });

    it('assigns the resolved metafields back onto the collection render data', async () => {
      await post(collectionBody());

      const [, renderData] = renderFileSpy.mock.calls[0];
      expect(renderData.collection.metafields.contentstack_collections).toEqual({ updated: 'metafields' });
    });

    it('refreshes only the product metafields when both product and collection are sent', async () => {
      await post(
        collectionBody({ product: { metafields: { contentstack_products: { existing: 'metafield' } } } })
      );

      expect(updatedMetafieldsSpy).toHaveBeenCalledTimes(1);
      expect(updatedMetafieldsSpy.mock.calls[0][0]).toEqual({ existing: 'metafield' });
      const [, renderData] = renderFileSpy.mock.calls[0];
      expect(renderData.collection.metafields.contentstack_collections).toEqual({ existing: 'collection-metafield' });
    });
  });

  describe('metaobjects branch', () => {
    const metaobjectBody = () =>
      buildPreviewRequestBody({
        theme_variable: {
          liquid_path: 'sections.product-template',
          data_cslp: 'product_ct.entry_123.en-us.title',
          payload: { metaobjects: { existing: 'metaobject' } },
        },
      });

    it('calls getUpdatedMetaobject with a copy of the current metaobjects and ids', async () => {
      await post(metaobjectBody());

      expect(updatedMetaobjectSpy).toHaveBeenCalledTimes(1);
      const [currentMetaobjects, , entry, options] = updatedMetaobjectSpy.mock.calls[0];
      expect(currentMetaobjects).toEqual({ existing: 'metaobject' });
      expect(entry).toEqual(previewEntryFixture);
      expect(options).toEqual({ ctUid: 'product_ct', hash: PREVIEW_HASH });
    });

    it('assigns result.currentMetaobjects back onto the render data', async () => {
      await post(metaobjectBody());

      const [, renderData] = renderFileSpy.mock.calls[0];
      expect(renderData.metaobjects).toEqual({ updated: 'metaobject' });
    });
  });

  describe('schema-layer validation (400s)', () => {
    it.each([
      ['live_preview', { live_preview: undefined }],
      ['ctUid', { ctUid: undefined }],
      ['entryUid', { entryUid: undefined }],
      ['theme_variable', { theme_variable: undefined }],
    ])('rejects a body missing %s with 400', async (_field, override) => {
      const body: any = buildPreviewRequestBody(override as Record<string, any>);
      Object.keys(override as Record<string, any>).forEach((k) => delete body[k]);

      const res = await post(body);

      expect(res.statusCode).toBe(400);
    });

    it.each([
      ['liquid_path', 'liquid_path'],
      ['data_cslp', 'data_cslp'],
      ['payload', 'payload'],
    ])('rejects a theme_variable missing %s with 400', async (_name, key) => {
      const body: any = buildPreviewRequestBody();
      delete body.theme_variable[key];

      const res = await post(body);

      expect(res.statusCode).toBe(400);
    });

    it.each([
      ['an object', {}],
      ['an array', []],
    ])('rejects liquid_path given %s with 400', async (_name, value) => {
      const body: any = buildPreviewRequestBody();
      body.theme_variable.liquid_path = value;

      const res = await post(body);

      expect(res.statusCode).toBe(400);
      expect(renderFileSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['empty', ''],
      ['the init placeholder', 'init'],
      ['65 chars', 'a'.repeat(65)],
      ['non-alphanumeric', '0123456789abcdef0123456789abcde_'],
    ])('rejects a live_preview hash that is %s with 400', async (_name, value) => {
      const res = await post(buildPreviewRequestBody({ live_preview: value }));

      expect(res.statusCode).toBe(400);
      expect(fetchDataSpy).not.toHaveBeenCalled();
    });

    // ctUid and entryUid are interpolated unencoded into the upstream URL by the SDK.
    it.each([
      ['entryUid', { entryUid: 'x?environment=production#' }],
      ['ctUid', { ctUid: 'a/b' }],
    ])('rejects a %s carrying URL syntax with 400', async (_name, override) => {
      const res = await post(buildPreviewRequestBody(override));

      expect(res.statusCode).toBe(400);
      expect(fetchDataSpy).not.toHaveBeenCalled();
    });

    // Ajv coerces 123 to '123', which passes the pattern but names no template.
    it('coerces a numeric liquid_path to a string and answers 404 for the missing template', async () => {
      const body: any = buildPreviewRequestBody();
      body.theme_variable.liquid_path = 123;

      const res = await post(body);

      expect(res.statusCode).toBe(404);
      expect(renderFileSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['a slash', 'sections/product-template'],
      ['traversal', 'sections..product-template'],
      ['a null byte', 'sections.product\u0000'],
      ['a leading dot', '.sections'],
    ])('rejects a liquid_path containing %s with 400', async (_name, value) => {
      const body: any = buildPreviewRequestBody();
      body.theme_variable.liquid_path = value;

      const res = await post(body);

      expect(res.statusCode).toBe(400);
      expect(renderFileSpy).not.toHaveBeenCalled();
    });
  });

  describe('failure paths', () => {
    it('returns 500 with the render error message when renderFile rejects', async () => {
      renderFileSpy.mockRejectedValue(new Error('template blew up') as never);

      const res = await post(buildPreviewRequestBody());

      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ message: 'Error rendering liquid file' });
    });

    it('returns 502 when the upstream fetchData rejects', async () => {
      fetchDataSpy.mockRejectedValue(new Error('CDA unreachable') as never);

      const res = await post(buildPreviewRequestBody());

      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ message: 'Preview data unavailable' });
      expect(renderFileSpy).not.toHaveBeenCalled();
    });

    // The SDK throws the upstream error_message, e.g. for a deleted referenced entry.
    it.each([
      ['product metafields', () => updatedMetafieldsSpy, { product: { metafields: { contentstack_products: { a: 1 } } } }],
      ['metaobjects', () => updatedMetaobjectSpy, { metaobjects: { a: 1 } }],
    ])('returns 502 without the upstream text when %s enrichment fails', async (_name, spy, payload) => {
      spy().mockRejectedValue(new Error('The requested entry does not exist') as never);

      const res = await post(
        buildPreviewRequestBody({
          theme_variable: { liquid_path: 'sections.product-template', data_cslp: 'product_ct.entry_123.en-us.title', payload },
        })
      );

      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ message: 'Preview data unavailable' });
      expect(renderFileSpy).not.toHaveBeenCalled();
    });

    it('logs the cause once when enrichment fails', async () => {
      updatedMetaobjectSpy.mockRejectedValue(new Error('The requested entry does not exist') as never);
      const { app: loggedApp, logs } = await buildLoggedApp();

      await loggedApp.inject({
        method: 'POST',
        url: '/get-preview-data',
        payload: buildPreviewRequestBody({
          theme_variable: { liquid_path: 'sections.product-template', data_cslp: 'product_ct.entry_123.en-us.title', payload: { metaobjects: { a: 1 } } },
        }),
      });
      await loggedApp.close();

      expect(logs()).toEqual([
        expect.objectContaining({ msg: 'preview enrichment failed', err: 'The requested entry does not exist' }),
      ]);
    });
  });

  // The upstream error body's `hint` echoes the stack api key and org uid.
  describe('fail-closed preview fetch', () => {
    const expectNothingRendered = () => {
      expect(keyBasedSpy).not.toHaveBeenCalled();
      expect(updatedMetafieldsSpy).not.toHaveBeenCalled();
      expect(updatedMetaobjectSpy).not.toHaveBeenCalled();
      expect(renderFileSpy).not.toHaveBeenCalled();
    };

    it('returns 401 without relaying the upstream body when the hash is rejected (382)', async () => {
      fetchDataSpy.mockResolvedValue({
        error_code: 382,
        error_message: 'Invalid live preview hash',
        hint: { apiKey: 'x', orgUid: 'y' },
      } as never);

      const res = await post(
        buildPreviewRequestBody({
          theme_variable: {
            liquid_path: 'sections.product-template',
            data_cslp: 'product_ct.entry_123.en-us.title',
            payload: {
              product: { metafields: { contentstack_products: { existing: 'metafield' } } },
              metaobjects: { existing: 'metaobject' },
            },
          },
        })
      );

      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ message: 'Live preview session is invalid or expired' });
      expect(res.body).not.toContain('hint');
      expect(res.body).not.toContain('error_code');
      expectNothingRendered();
    });

    it.each([
      ['another upstream error code', { error_code: 105, error_message: 'nope' }],
      ['an empty body', {}],
      ['a body without schema', { entry: previewEntryFixture }],
      ['a body without entry', { schema: previewSchemaFixture }],
      ['null', null],
    ])('returns 502 when fetchData resolves %s', async (_name, body) => {
      fetchDataSpy.mockResolvedValue(body as never);

      const res = await post(buildPreviewRequestBody());

      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ message: 'Preview data unavailable' });
      expectNothingRendered();
    });

    it('logs only the upstream error code for a rejected hash', async () => {
      fetchDataSpy.mockResolvedValue({
        error_code: 382,
        error_message: 'Invalid live preview hash',
        hint: { apiKey: 'stack-api-key', orgUid: 'org-uid' },
      } as never);
      const { app: loggedApp, logs, raw } = await buildLoggedApp();

      await loggedApp.inject({ method: 'POST', url: '/get-preview-data', payload: buildPreviewRequestBody() });
      await loggedApp.close();

      expect(logs()).toEqual([
        expect.objectContaining({ msg: 'preview fetch rejected', statusCode: 401, upstreamErrorCode: 382 }),
      ]);
      expect(raw()).not.toContain('stack-api-key');
      expect(raw()).not.toContain('Invalid live preview hash');
    });

    it('logs the cause when fetchData rejects', async () => {
      fetchDataSpy.mockRejectedValue(new Error('getaddrinfo ENOTFOUND') as never);
      const { app: loggedApp, logs } = await buildLoggedApp();

      await loggedApp.inject({ method: 'POST', url: '/get-preview-data', payload: buildPreviewRequestBody() });
      await loggedApp.close();

      expect(logs()).toEqual([
        expect.objectContaining({ msg: 'preview fetch failed', err: 'getaddrinfo ENOTFOUND' }),
      ]);
    });
  });

  describe('adversarial liquid_path', () => {
    // Real engine (no renderFile spy), so only the route schema stands in the way.
    it('rejects a path-traversal attempt at the schema layer without leaking file contents', async () => {
      renderFileSpy.mockRestore();

      const body: any = buildPreviewRequestBody();
      body.theme_variable.liquid_path = 'x/../../../../etc/passwd';

      const res = await post(body);

      expect(res.statusCode).toBe(400);
      expect(res.body).not.toContain('root:');
    });
  });

  describe('template folder rules', () => {
    it('returns 404 for a template under layout/ before enrichment or rendering', async () => {
      const body: any = buildPreviewRequestBody();
      body.theme_variable.liquid_path = 'layout.theme';
      body.theme_variable.payload = {
        product: { metafields: { contentstack_products: { existing: 'metafield' } } },
        metaobjects: { existing: 'metaobject' },
      };

      const res = await post(body);

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ message: 'Template not found' });
      expect(updatedMetafieldsSpy).not.toHaveBeenCalled();
      expect(updatedMetaobjectSpy).not.toHaveBeenCalled();
      expect(renderFileSpy).not.toHaveBeenCalled();
    });

    it('returns 404 for a liquid_path with no template file', async () => {
      const body: any = buildPreviewRequestBody();
      body.theme_variable.liquid_path = 'sections.missing';

      const res = await post(body);

      expect(res.statusCode).toBe(404);
      expect(renderFileSpy).not.toHaveBeenCalled();
    });

    // Real engine: left to liquidjs, root order (layout/ before templates/) would pick layout/baz.
    it('renders templates/baz for a bare name, not the layout/baz that shares it', async () => {
      renderFileSpy.mockRestore();
      const body: any = buildPreviewRequestBody();
      body.theme_variable.liquid_path = 'baz';

      const res = await post(body);

      expect(res.statusCode).toBe(200);
      expect(res.json().html).toContain('TEMPLATE');
      expect(res.json().html).not.toContain('LAYOUT');
    });

    it('returns 404 for a bare name that exists only under layout/', async () => {
      renderFileSpy.mockRestore();
      const body: any = buildPreviewRequestBody();
      body.theme_variable.liquid_path = 'bar';

      const res = await post(body);

      expect(res.statusCode).toBe(404);
      expect(res.body).not.toContain('LAYOUT');
    });

    // Real engine: a merchant folder renders, a protected folder is refused even though the file exists.
    it('renders custom.foo from a merchant folder and returns 404 for config.x', async () => {
      renderFileSpy.mockRestore();
      const custom: any = buildPreviewRequestBody();
      custom.theme_variable.liquid_path = 'custom.foo';
      const protectedPath: any = buildPreviewRequestBody();
      protectedPath.theme_variable.liquid_path = 'config.x';

      const customRes = await post(custom);
      const protectedRes = await post(protectedPath);

      expect(customRes.statusCode).toBe(200);
      expect(customRes.json().html).toContain('CUSTOM');
      expect(protectedRes.statusCode).toBe(404);
      expect(protectedRes.body).not.toContain('CONFIG');
    });
  });

  describe('render failure logging', () => {
    it('logs the template and error message, never the request payload or stack', async () => {
      const { app: loggedApp, logs, raw } = await buildLoggedApp();
      renderFileSpy.mockRejectedValue(new Error('template blew up') as never);

      const res = await loggedApp.inject({
        method: 'POST',
        url: '/get-preview-data',
        payload: buildPreviewRequestBody({
          theme_variable: {
            liquid_path: 'sections.product-template',
            data_cslp: 'x',
            payload: { customer: { email: 'secret@example.com' } },
          },
        }),
      });
      await loggedApp.close();

      expect(res.statusCode).toBe(500);
      expect(logs()).toEqual([
        { level: 50, time: expect.any(Number), pid: expect.any(Number), hostname: expect.any(String),
          reqId: expect.any(String), msg: 'liquid render failed', liquidPath: 'sections/product-template', err: 'template blew up' },
      ]);
      expect(raw()).not.toContain('secret@example.com');
    });
  });

  describe('unguarded locale pass-through', () => {
    // locale is absent from the route schema, so it reaches fetchData unvalidated.
    it('passes undefined to fetchData when locale is omitted', async () => {
      const body: any = buildPreviewRequestBody();
      delete body.locale;

      const res = await post(body);

      expect(res.statusCode).toBe(200);
      expect(fetchDataSpy).toHaveBeenCalledWith('product_ct', 'entry_123', PREVIEW_HASH, undefined);
    });
  });
});
