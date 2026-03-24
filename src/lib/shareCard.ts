/**
 * shareCard.ts
 * 
 * Pure utility for generating branded social milestone images using HTML5 Canvas.
 * Optimized for OpenGraph (1200x630px).
 */

export interface ShareCardOptions {
    projectName: string;
    projectCoverColor?: string;
    milestoneType: 'word_count' | 'streak' | 'badge' | 'draft_complete' | 'session';
    milestoneValue: string | number;
    milestoneLabel: string;
    writerName?: string;
}

export async function generateShareCard(options: ShareCardOptions): Promise<Blob> {
    const {
        projectName,
        projectCoverColor = '#4A6FA5',
        milestoneValue,
        milestoneLabel,
        writerName
    } = options;

    const width = 1200;
    const height = 630;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not get 2D context');
    }

    // 1. Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // 2. Accent Stripe (Left edge, 8px)
    ctx.fillStyle = projectCoverColor;
    ctx.fillRect(0, 0, 8, height);

    // 3. Branding (Bottom)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '24px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Made with MythForge', width / 2, height - 70);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '20px Inter, -apple-system, sans-serif';
    ctx.fillText('https://mythforge.app', width / 2, height - 40);

    // 4. Project Name (Top)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'italic 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(projectName, width / 2, 80);

    // 5. Milestone Value (Center)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(milestoneValue), width / 2, height / 2 + 20);

    // 6. Milestone Label (Below Value)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '36px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(milestoneLabel.toUpperCase(), width / 2, height / 2 + 80);

    // 7. Writer Name (Optional, top right)
    if (writerName) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '24px Inter, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(writerName, width - 40, 50);
    }

    // 8. Return as Blob
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Canvas toBlob failed'));
            }
        }, 'image/png');
    });
}
