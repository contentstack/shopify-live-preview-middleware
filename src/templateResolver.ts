import fs from 'fs';
import path from 'path';

// Same order as the engine roots, so a bare name resolves to the file liquidjs used to pick.
const ALLOWED_FOLDERS = ['snippets', 'sections', 'assets', 'templates'];
// Still engine roots so templates can include from them; never rendered directly.
export const DENIED_FOLDERS = ['layout', 'config', 'locales'];

const templateExists = (viewsRoot: string, rel: string) =>
    fs.existsSync(path.join(viewsRoot, `${rel}.liquid`));

// Returns a folder-prefixed path, never a bare name: liquidjs looks a bare name up across
// every engine root, layout/ included.
export const resolveTemplatePath = (viewsRoot: string, liquidPath: string): string | null => {
    const rel = path.posix.normalize(liquidPath.replace(/\./g, '/'));
    const segments = rel.split('/');
    if (path.posix.isAbsolute(rel) || segments.includes('..')) return null;

    if (segments.length === 1) {
        const candidates = [rel, ...ALLOWED_FOLDERS.map((folder) => `${folder}/${rel}`)];
        return candidates.find((candidate) => templateExists(viewsRoot, candidate)) ?? null;
    }

    return ALLOWED_FOLDERS.includes(segments[0]) && templateExists(viewsRoot, rel) ? rel : null;
};
