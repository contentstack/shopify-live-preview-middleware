import { FastifyReply, FastifyRequest } from "fastify";
import { LivePreviewShopify } from "@contentstack/shopify-live-preview-sdk";
import { FieldSchema, Entry } from "@contentstack/shopify-live-preview-sdk/dist/setup-exports";
import _ from "lodash";
import { config } from "../config.js";
import path from "path";
import { fileURLToPath } from 'url';
import { resolveTemplatePath } from "../templateResolver.js";

// Get the current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the request body interface
interface PreviewDataRequestBody {
    live_preview: string;
    ctUid: string;
    entryUid: string;
    locale: string;
    theme_variable: {
        liquid_path: string;
        data_cslp: string;
        payload?: any;
    };
}

// Configure the Liquid engine with the middleware's views directory
const viewsPath = process.env.MIDDLEWARE_VIEWS_PATH || path.resolve(__dirname, "../../views");
const liquidEngineOptions = {
    root: [
        viewsPath,
        path.resolve(viewsPath, "snippets"),
        path.resolve(viewsPath, "sections"),
        path.resolve(viewsPath, "assets"),
        path.resolve(viewsPath, "config"),
        path.resolve(viewsPath, "layout"),
        path.resolve(viewsPath, "locales"),
        path.resolve(viewsPath, "templates"),
    ]
}

const livePreviewShopify = LivePreviewShopify.getInstance({...config.contentstack, liquidEngineOptions });
const engine = livePreviewShopify.getLiquidEngine();
// You can add more filter or register more tags here into the engine if needed
// example: engine.registerFilter('my_custom_filter', (value) => {
    // return `Custom filter applied to: ${value}`;
// });

// The preview service's answer to an unknown or expired live-preview hash.
const INVALID_SESSION_ERROR_CODE = 382;

class PreviewFetchError extends Error {
    constructor(
        public readonly statusCode: 401 | 502,
        message: string,
        public readonly upstreamErrorCode?: unknown,
    ) {
        super(message);
    }
}

// fetchData resolves upstream error bodies instead of rejecting, so anything without an
// entry + schema is a failed fetch: nothing renders without a hash the service accepted.
const assertPreviewData = (result: unknown): { schema: FieldSchema[], entry: Entry } => {
    const body = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    if (Array.isArray(body.schema) && body.entry && typeof body.entry === 'object') {
        return { schema: body.schema as FieldSchema[], entry: body.entry as Entry };
    }
    // Only the error code is kept: the rest of the upstream body echoes the stack api key and org uid.
    if (body.error_code === INVALID_SESSION_ERROR_CODE) {
        throw new PreviewFetchError(401, 'Live preview session is invalid or expired', body.error_code);
    }
    throw new PreviewFetchError(502, 'Preview data unavailable', body.error_code);
};

export const getPreviewDataHandler = async (req: FastifyRequest<{ Body: PreviewDataRequestBody }>, res: FastifyReply) => {
    const { live_preview, ctUid, entryUid, locale, theme_variable } = req.body;
    const { liquid_path } = theme_variable;
    
    const result = await livePreviewShopify.fetchData(ctUid, entryUid, live_preview, locale).catch((error: Error) => {
        req.log.warn({ err: error.message }, 'preview fetch failed');
        return null;
    });
    let entryData: { schema: FieldSchema[], entry: Entry };
    try {
        entryData = assertPreviewData(result);
    } catch (error) {
        if (error instanceof PreviewFetchError) {
            req.log.warn({ statusCode: error.statusCode, upstreamErrorCode: error.upstreamErrorCode }, 'preview fetch rejected');
            return res.status(error.statusCode).send({ message: error.message });
        }
        throw error;
    }

    // Resolved before enrichment, which makes its own upstream calls for references.
    const templatePath = resolveTemplatePath(viewsPath, liquid_path);
    if (!templatePath) {
        return res.status(404).send({ message: 'Template not found' });
    }

    let shopifyData = { ...theme_variable?.payload };

    // CDA include_schema=true returns `schema` as the field array itself — pass it
    // directly; wrapping it in another array produced an empty key-based map, which
    // routed every field (incl. modular blocks) through the generic no-schema branch.
    const keyBasedCt = livePreviewShopify.createContentTypeKeyBased(entryData.schema);
    const updatedEntry = entryData.entry;

    if (_.get(shopifyData, 'product.metafields.contentstack_products', null)) {
        const currentMetafields = shopifyData.product.metafields.contentstack_products;
        const updatedMetafields = await livePreviewShopify.getUpdatedProductMetafields(currentMetafields, keyBasedCt, updatedEntry, { ctUid: ctUid, entryUid: entryUid, hash: live_preview })
        shopifyData.product.metafields.contentstack_products = updatedMetafields;
    } else if (_.get(shopifyData, 'collection.metafields.contentstack_collections', null)) {
        // One request carries one entry; applying it to both would overwrite shared uids like `sections`.
        const currentMetafields = shopifyData.collection.metafields.contentstack_collections;
        const updatedMetafields = await livePreviewShopify.getUpdatedProductMetafields(currentMetafields, keyBasedCt, updatedEntry, { ctUid: ctUid, entryUid: entryUid, hash: live_preview })
        shopifyData.collection.metafields.contentstack_collections = updatedMetafields;
    }

    if (_.get(shopifyData, 'metaobjects', null)) {
        const currentMetaobjects = shopifyData.metaobjects;
        const mappedShopifyData = await livePreviewShopify.getUpdatedMetaobject({ ...currentMetaobjects }, keyBasedCt, updatedEntry, { ctUid: ctUid, hash: live_preview });
        shopifyData.metaobjects = mappedShopifyData.currentMetaobjects;
    }
    try {
        const newRenderedData = await engine.renderFile(templatePath, shopifyData);
        return res.send({ html: newRenderedData });
    } catch (error: any) {
        // The render data is caller-supplied, so only the template and message are logged.
        req.log.error({ liquidPath: templatePath, err: error.message }, 'liquid render failed');
        return res.status(500).send({ message: 'Error rendering liquid file' });
    }
}
