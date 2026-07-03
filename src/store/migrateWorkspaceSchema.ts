/* eslint-disable @typescript-eslint/no-explicit-any -- raw persisted blobs are
   untyped by design at the migration boundary. */
import { migratePerShelfBibles } from './migratePerShelfBibles';
import { migrateArticleFolders } from './migrateArticleFolders';

/**
 * The full, ordered workspace-schema migration chain. Both hydration paths
 * (zustand persist migrate + Supabase cloud hydrate) call THIS — never the
 * individual steps — so a blob at any historical version comes out current.
 * Every step is idempotent, so re-running the chain is always safe.
 */
export function migrateWorkspaceSchema(data: Record<string, any>): Record<string, any> {
    return migrateArticleFolders(migratePerShelfBibles(data));
}
