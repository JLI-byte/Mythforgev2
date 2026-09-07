/**
 * Which records belong to the built-in example world — LEAF MODULE
 * (no store or React import).
 *
 * The example world can be switched off, which moves its records out of the
 * live arrays into a stash rather than deleting them. Both halves of that
 * move — and anything else that needs to ask "is this record part of the
 * example?" — resolve it here, so there is one definition of the cascade.
 *
 * Types are structural on purpose: the store passes its real World/Project/
 * Document/Scene/Entity arrays in and gets arrays of the same concrete types
 * back, without this module depending on the store.
 */

/**
 * The example world's name. Lives here, not in betaSeedData, because that
 * module is 54KB and is loaded through a dynamic import to keep it out of the
 * main bundle — a static import of a constant from it would drag the whole
 * payload back in. Only used to adopt an example world seeded before ids were
 * recorded; everything else selects by id.
 */
export const SEED_WORLD_NAME = 'The Shattered Realm';

interface HasId { id: string }
interface ProjectLike extends HasId { worldId?: string }
interface DocumentLike extends HasId { projectId: string }
interface SceneLike extends HasId { documentId: string; projectId: string }
interface EntityLike extends HasId { projectId: string }

/** The five arrays the cascade walks. */
export interface ExampleCollections<
    W extends HasId,
    P extends ProjectLike,
    D extends DocumentLike,
    S extends SceneLike,
    E extends EntityLike,
> {
    worlds: W[];
    projects: P[];
    documents: D[];
    scenes: S[];
    entities: E[];
}

/** Every record belonging to the example world, by id. */
export interface ExampleSelection {
    worldIds: Set<string>;
    projectIds: Set<string>;
    documentIds: Set<string>;
    sceneIds: Set<string>;
    entityIds: Set<string>;
}

export function selectExampleRecords<
    W extends HasId,
    P extends ProjectLike,
    D extends DocumentLike,
    S extends SceneLike,
    E extends EntityLike,
>(source: ExampleCollections<W, P, D, S, E>, worldId: string): ExampleSelection {
    const worldIds = new Set(
        source.worlds.filter(w => w.id === worldId).map(w => w.id),
    );
    // A project with no worldId is a standalone and never part of the example.
    const projectIds = new Set(
        source.projects.filter(p => p.worldId !== undefined && worldIds.has(p.worldId))
            .map(p => p.id),
    );
    const documentIds = new Set(
        source.documents.filter(d => projectIds.has(d.projectId)).map(d => d.id),
    );
    // A scene carries both keys. Matching either sweeps up a scene whose
    // document has been deleted, which matching documentId alone would strand.
    const sceneIds = new Set(
        source.scenes
            .filter(s => documentIds.has(s.documentId) || projectIds.has(s.projectId))
            .map(s => s.id),
    );
    const entityIds = new Set(
        source.entities.filter(e => projectIds.has(e.projectId)).map(e => e.id),
    );
    return { worldIds, projectIds, documentIds, sceneIds, entityIds };
}

/**
 * Split the collections into what stays and what goes into the stash.
 * The two halves are disjoint and their union is the input.
 */
export function partitionExample<
    W extends HasId,
    P extends ProjectLike,
    D extends DocumentLike,
    S extends SceneLike,
    E extends EntityLike,
>(
    source: ExampleCollections<W, P, D, S, E>,
    worldId: string,
): {
    kept: ExampleCollections<W, P, D, S, E>;
    stashed: ExampleCollections<W, P, D, S, E>;
} {
    const sel = selectExampleRecords(source, worldId);
    const split = <T extends HasId>(rows: T[], ids: Set<string>) => ({
        kept: rows.filter(r => !ids.has(r.id)),
        stashed: rows.filter(r => ids.has(r.id)),
    });

    const w = split(source.worlds, sel.worldIds);
    const p = split(source.projects, sel.projectIds);
    const d = split(source.documents, sel.documentIds);
    const s = split(source.scenes, sel.sceneIds);
    const e = split(source.entities, sel.entityIds);

    return {
        kept: {
            worlds: w.kept, projects: p.kept, documents: d.kept,
            scenes: s.kept, entities: e.kept,
        },
        stashed: {
            worlds: w.stashed, projects: p.stashed, documents: d.stashed,
            scenes: s.stashed, entities: e.stashed,
        },
    };
}
