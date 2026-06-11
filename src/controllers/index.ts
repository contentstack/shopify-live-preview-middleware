import { FastifyReply, FastifyRequest } from "fastify";
import { LivePreviewShopify } from "@contentstack/shopify-live-preview-sdk";
import { FieldSchema, Entry } from "@contentstack/shopify-live-preview-sdk/dist/setup-exports";
import _ from "lodash";
import { config } from "../config.js";
import path from "path";
import { fileURLToPath } from 'url';

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
const viewsPath = path.resolve(__dirname, "../../views");
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

export const getPreviewDataHandler = async (req: FastifyRequest<{ Body: PreviewDataRequestBody }>, res: FastifyReply) => {
    const { live_preview, ctUid, entryUid, locale, theme_variable } = req.body;
    const { liquid_path } = theme_variable;
    
    const entryData: { schema: FieldSchema[], entry: Entry } = await livePreviewShopify.fetchData(ctUid, entryUid, live_preview, locale) as { schema: FieldSchema[], entry: Entry };
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
    }

    if (_.get(shopifyData, 'metaobjects', null)) {
        const currentMetaobjects = shopifyData.metaobjects;
        const mappedShopifyData = await livePreviewShopify.getUpdatedMetaobject({ ...currentMetaobjects }, keyBasedCt, updatedEntry, { ctUid: ctUid, hash: live_preview });
        shopifyData.metaobjects = mappedShopifyData.currentMetaobjects;
    }
    if(typeof liquid_path !== 'string') {
        return res.status(400).send({ message: 'Invalid liquid path' });
    }
    const liquidFilePath = liquid_path.replace(/\./g, "/");
    try {        
        const newRenderedData = await engine.renderFile(liquidFilePath, shopifyData);
        return res.send({ html: newRenderedData });
    } catch (error: any) {
        console.error('=== LIQUID RENDERING ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Template path:', liquidFilePath);
        console.error('Data passed to template:', JSON.stringify(shopifyData, null, 2));
        return res.status(500).send({ message: 'Error rendering liquid file' });
    }
}

// Export the views health handler
export { viewsHealthHandler } from './viewsHealthController.js';