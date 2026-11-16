import fs from 'fs';
import path from 'path';

// Still engine roots so other templates can include from them, but never rendered directly.
const PROTECTED_FOLDERS = ['config', 'locales', 'layout'];

// Same order as the engine roots, so a path not found directly in views/ resolves to the
// file liquidjs used to pick, minus the protected roots.
const FALLBACK_FOLDERS = ['snippets', 'sections', 'assets', 'templates'];

const templateExists = (viewsRoot: string, rel: string) =>
    fs.existsSync(path.join(viewsRoot, `${rel}.liquid`));

// Returns a path relative to views/ (root 0) that is known to exist, so liquidjs renders
// exactly that file and never searches its other roots.
export const resolveTemplatePath = (viewsRoot: string, liquidPath: string): string | null => {
    const rel = path.posix.normalize(liquidPath.replace(/\./g, '/'));
    const segments = rel.split('/');
    if (path.posix.isAbsolute(rel) || segments.includes('..')) return null;
    // Lowercased because Layout/ is layout/ on a case-insensitive filesystem.
    if (segments.length > 1 && PROTECTED_FOLDERS.includes(segments[0].toLowerCase())) return null;

    const candidates = [rel, ...FALLBACK_FOLDERS.map((folder) => `${folder}/${rel}`)];
    return candidates.find((candidate) => templateExists(viewsRoot, candidate)) ?? null;
};
