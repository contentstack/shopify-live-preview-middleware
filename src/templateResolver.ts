import fs from 'fs';
import path from 'path';

// Same order as the engine roots, so a bare name resolves to the file liquidjs used to pick.
// layout/, config/ and locales/ stay engine roots for includes but are never rendered directly.
const ALLOWED_FOLDERS = ['snippets', 'sections', 'assets', 'templates'];

const templateExists = (viewsRoot: string, rel: string) =>
    fs.existsSync(path.join(viewsRoot, `${rel}.liquid`));

// Bare names come back folder-prefixed (or as a file directly in views/, root 0) so liquidjs never searches layout/.
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
