import fs from 'fs';
import path from 'path';

// The resolver only renders files that exist, so every posted liquid_path needs one.
export const writeTemplate = (rel: string, content = '') => {
  const file = path.join(process.env.MIDDLEWARE_VIEWS_PATH as string, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
