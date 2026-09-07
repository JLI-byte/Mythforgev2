"use client";

import {
    normaliseLinkContent,
    detectEmbed,
    faviconFor,
    displayHost,
    type LinkContent,
} from '@/lib/research/linkPreview';
import { safeHref } from '@/lib/safeUrl';
import styles from './LinkCardRenderer.module.css';

interface Props {
    content: LinkContent;
    onChange: (c: Record<string, unknown>) => void;
}

/**
 * A pasted link, as it sits on the research board.
 *
 * The card is fully controlled: the caller debounces, so every keystroke goes
 * straight out through onChange rather than being buffered here a second time.
 *
 * A recognised host becomes a player instead of a picture — video and audio are
 * not separate card types, they are what a link card turns into — so the embed
 * and the thumbnail share one box and only ever one of them is rendered.
 */
export function LinkCardRenderer({ content, onChange }: Props) {
    const view = normaliseLinkContent(content);
    const url = (content.url ?? '').trim();

    // The blank card asks for one thing and shows nothing else, because there
    // is nothing yet to show.
    if (!url) {
        return (
            <div className={styles.card}>
                <input
                    className={styles.urlInput}
                    aria-label="Link URL"
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    value={content.url ?? ''}
                    onChange={e => onChange({ ...content, url: e.target.value })}
                />
            </div>
        );
    }

    const embed = detectEmbed(url);
    const host = displayHost(url);
    const favicon = faviconFor(url);
    // Null means there is nothing safe to link to, and the row is plain text.
    const href = safeHref(url);
    const showImage = view.showImage ?? true;
    const showDescription = view.showDescription ?? true;
    const title = view.title ?? '';
    const hostRowContent = (
        <>
            {favicon && <img className={styles.favicon} src={favicon} alt="" width={14} height={14} />}
            <span className={styles.host}>{host}</span>
        </>
    );

    return (
        <div className={styles.card}>
            {showImage && (
                embed ? (
                    <div className={styles.media}>
                        <iframe
                            className={styles.embed}
                            src={embed.embedUrl}
                            title={title || host || 'Embedded media'}
                            loading="lazy"
                            allowFullScreen
                        />
                    </div>
                ) : content.imageUrl ? (
                    <div className={styles.media}>
                        <img className={styles.thumb} src={content.imageUrl} alt="" />
                    </div>
                ) : (
                    <div className={`${styles.media} ${styles.placeholder}`} aria-hidden="true" />
                )
            )}

            <input
                className={styles.titleInput}
                aria-label="Link title"
                placeholder="Title…"
                value={title}
                onChange={e => onChange({ ...content, title: e.target.value })}
            />

            {href ? (
                <a
                    className={styles.hostRow}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseDown={e => e.stopPropagation()}
                >
                    {hostRowContent}
                </a>
            ) : (
                <span className={styles.hostRow}>{hostRowContent}</span>
            )}

            {showDescription && (
                <textarea
                    className={styles.description}
                    aria-label="Link description"
                    placeholder="Description…"
                    value={content.description ?? ''}
                    onChange={e => onChange({ ...content, description: e.target.value })}
                />
            )}

            <div className={styles.footer}>
                <button
                    type="button"
                    className={styles.toggle}
                    aria-pressed={showImage}
                    onClick={() => onChange({ ...content, showImage: !showImage })}
                >
                    Image
                </button>
                <button
                    type="button"
                    className={styles.toggle}
                    aria-pressed={showDescription}
                    onClick={() => onChange({ ...content, showDescription: !showDescription })}
                >
                    Description
                </button>
            </div>
        </div>
    );
}
