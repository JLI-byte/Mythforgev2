"use client";

import React from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';

/**
 * SidebarToggle
 * 
 * A fixed pill-shaped button that sits at the inner edge of the editor/sidebar boundary.
 * It tracks the sidebar's width dynamically so it visually slides open and closed
 * with the compartment.
 */
export function SidebarToggle() {
    const isSidebarOpen = useWorkspaceStore((state) => state.isSidebarOpen);
    const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar);

    // No longer fixed dynamically. Positioned logically inside the new Toolbar.
    const dynamicStyles: React.CSSProperties = {
        width: '32px',
        height: '32px',
        background: 'transparent',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--foreground)',
        fontSize: '1.25rem',
        opacity: 0.7,
        transition: 'opacity 0.2s',
        padding: 0
    };

    return (
        <button
            onClick={toggleSidebar}
            style={dynamicStyles}
            title={isSidebarOpen ? "Hide World Bible" : "Show World Bible"}
            aria-label="Toggle Sidebar"
        >
            {isSidebarOpen ? '›' : '‹'}
        </button>
    );
}
