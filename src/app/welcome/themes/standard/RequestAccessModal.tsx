"use client";

import React, { useEffect, useState } from "react";
import {
    submitBetaRequest,
    type BetaRequestResult,
} from "../../shared/betaRequest";
import styles from "./requestModal.module.css";

interface RequestAccessModalProps {
    onClose: () => void;
}

/**
 * RequestAccessModal — compact beta-request dialog for the standard landing.
 * Reuses the shared submitBetaRequest funnel and surfaces its result states.
 */
export default function RequestAccessModal({ onClose }: RequestAccessModalProps) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<BetaRequestResult | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setResult(null);
        const outcome = await submitBetaRequest({ name, email, reason });
        setResult(outcome);
        setIsSubmitting(false);
    };

    return (
        <div className={styles.backdrop} onClick={onClose} role="presentation">
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="request-title"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className={styles.close}
                    aria-label="Close"
                    onClick={onClose}
                >
                    ×
                </button>

                {result === "done" ? (
                    <div className={styles.success}>
                        <h2 id="request-title" className={styles.title}>
                            You&apos;re on the list.
                        </h2>
                        <p className={styles.intro}>
                            If you&apos;re selected for the beta, we&apos;ll email your
                            invite.
                        </p>
                        <button
                            type="button"
                            className={styles.primary}
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 id="request-title" className={styles.title}>
                            Request beta access
                        </h2>
                        <p className={styles.intro}>
                            LoreCanvas is invite-only during the beta. Leave your email
                            and we&apos;ll reach out.
                        </p>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <label className={styles.label} htmlFor="req-email">
                                Email
                            </label>
                            <input
                                id="req-email"
                                className={styles.input}
                                type="email"
                                required
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <label className={styles.label} htmlFor="req-name">
                                Name (optional)
                            </label>
                            <input
                                id="req-name"
                                className={styles.input}
                                type="text"
                                maxLength={120}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                            <label className={styles.label} htmlFor="req-reason">
                                What are you writing? (optional)
                            </label>
                            <textarea
                                id="req-reason"
                                className={styles.textarea}
                                maxLength={2000}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                            <button
                                type="submit"
                                className={styles.primary}
                                disabled={isSubmitting || !email.trim()}
                            >
                                {isSubmitting ? "Sending…" : "Request access"}
                            </button>
                        </form>
                        {result === "duplicate" && (
                            <p className={styles.note}>
                                This email is already on the list.
                            </p>
                        )}
                        {result === "error" && (
                            <p className={styles.error}>
                                Something went wrong — try again in a minute.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
