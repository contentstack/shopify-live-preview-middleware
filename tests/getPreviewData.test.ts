import { jest } from '@jest/globals';
import { LivePreviewShopify } from '@contentstack/shopify-live-preview-sdk';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/app.js';

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

const buildPreviewRequestBody = (overrides: Record<string, any> = {}) => ({
  live_preview: 'hash_abc123',
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

      expect(fetchDataSpy).toHaveBeenCalledWith('product_ct', 'entry_123', 'hash_abc123', 'en-us');
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
        hash: 'hash_abc123',
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
      expect(options).toEqual({ ctUid: 'product_ct', hash: 'hash_abc123' });
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

    // Documents Ajv coerceTypes (a fastify default): a numeric liquid_path is coerced to
    // a string at the schema layer, so the handler's own typeof guard never sees it.
    it('coerces a numeric liquid_path to a string and renders it', async () => {
      const body: any = buildPreviewRequestBody();
      body.theme_variable.liquid_path = 123;

      const res = await post(body);

      expect(res.statusCode).toBe(200);
      expect(renderFileSpy).toHaveBeenCalledWith('123', {});
    });
  });

  describe('failure paths', () => {
    it('returns 500 with the render error message when renderFile rejects', async () => {
      renderFileSpy.mockRejectedValue(new Error('template blew up') as never);

      const res = await post(buildPreviewRequestBody());

      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ message: 'Error rendering liquid file' });
    });

    it('returns 500 when the upstream fetchData rejects', async () => {
      fetchDataSpy.mockRejectedValue(new Error('CDA unreachable') as never);

      const res = await post(buildPreviewRequestBody());

      expect(res.statusCode).toBe(500);
      expect(renderFileSpy).not.toHaveBeenCalled();
    });
  });

  describe('adversarial liquid_path', () => {
    // Runs against the REAL engine (no renderFile spy) so the traversal attempt is
    // resolved by liquidjs itself rather than by a stub.
    it('does not leak file contents for a path-traversal attempt', async () => {
      renderFileSpy.mockRestore();

      const body: any = buildPreviewRequestBody();
      body.theme_variable.liquid_path = 'x/../../../../etc/passwd';

      const res = await post(body);

      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ message: 'Error rendering liquid file' });
      expect(res.body).not.toContain('root:');
    });
  });

  describe('unguarded locale pass-through', () => {
    // locale is absent from the route schema, so it reaches fetchData unvalidated.
    it('passes undefined to fetchData when locale is omitted', async () => {
      const body: any = buildPreviewRequestBody();
      delete body.locale;

      const res = await post(body);

      expect(res.statusCode).toBe(200);
      expect(fetchDataSpy).toHaveBeenCalledWith('product_ct', 'entry_123', 'hash_abc123', undefined);
    });
  });
});
