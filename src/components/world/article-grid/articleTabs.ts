import { GridWidget } from './gridTypes';

export interface ArticleTab {
  id: string;
  name: string;
  widgets: GridWidget[];
}

export function parseArticleTabs(raw: string | undefined): ArticleTab[] {
  const defaultMain = (): ArticleTab[] => [{
    id: crypto.randomUUID(),
    name: 'Main',
    widgets: [],
  }];

  if (!raw) return defaultMain();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultMain();
    if (typeof parsed[0].name === 'string' && Array.isArray(parsed[0].widgets)) return parsed as ArticleTab[];
    if (typeof parsed[0].x === 'number' && typeof parsed[0].y === 'number') {
      return [{ id: crypto.randomUUID(), name: 'Main', widgets: parsed as GridWidget[] }];
    }
    return defaultMain();
  } catch {
    return defaultMain();
  }
}
