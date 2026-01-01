// Decoration provider for VS Code visual masking

import * as vscode from 'vscode';
import { COLORS, DEFAULT_MASK_CHAR, EXTENSION_NAME } from '../utils/constants';

/**
 * Decoration types for different masking states
 */
export class DecorationProvider {
    private maskedDecorationType: vscode.TextEditorDecorationType;
    private revealedDecorationType: vscode.TextEditorDecorationType;
    private screenShareDecorationType: vscode.TextEditorDecorationType;
    private gutterIconMasked: string;
    private gutterIconRevealed: string;
    private maskChar: string;

    constructor() {
        this.maskChar = this.getMaskCharacter();
        this.gutterIconMasked = this.createGutterIconSvg(true);
        this.gutterIconRevealed = this.createGutterIconSvg(false);

        this.maskedDecorationType = this.createMaskedDecorationType();
        this.revealedDecorationType = this.createRevealedDecorationType();
        this.screenShareDecorationType = this.createScreenShareDecorationType();
    }

    /**
     * Get mask character from settings
     */
    private getMaskCharacter(): string {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        return config.get<string>('maskCharacter', DEFAULT_MASK_CHAR);
    }

    /**
     * Create SVG for gutter icon - bolder design for visibility
     */
    private createGutterIconSvg(isMasked: boolean): string {
        if (isMasked) {
            // Red eye-off icon with background for visibility
            return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#ff6b6b" opacity="0.3"/><path d="M2 2L14 14M4 6C5 4.5 6.5 3.5 8 3.5C11 3.5 13 8 13 8C12.5 9 12 9.7 11.3 10.3M6.7 5.7C7 5.6 7.5 5.5 8 5.5C10 5.5 11 8 11 8C10.8 8.5 10.5 9 10 9.3M8 10.5C6.5 10.5 5.5 9 5.5 9" stroke="#ff6b6b" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`)}`;
        } else {
            // Green eye icon with background
            return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#51cf66" opacity="0.3"/><path d="M3 8C3 8 5 4.5 8 4.5C11 4.5 13 8 13 8C13 8 11 11.5 8 11.5C5 11.5 3 8 3 8Z" stroke="#51cf66" stroke-width="1.5" fill="none"/><circle cx="8" cy="8" r="2" fill="#51cf66"/></svg>`)}`;
        }
    }

    /**
     * Create decoration type for masked content
     * Uses opacity to hide original text while showing the mask overlay
     */
    private createMaskedDecorationType(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            // Hide the original text - make it transparent with opacity
            opacity: '0',
            gutterIconPath: vscode.Uri.parse(this.gutterIconMasked),
            gutterIconSize: '80%'
        });
    }

    /**
     * Create decoration type for revealed content
     */
    private createRevealedDecorationType(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(81, 207, 102, 0.1)',
            border: '1px dashed rgba(81, 207, 102, 0.4)',
            borderRadius: '3px',
            gutterIconPath: vscode.Uri.parse(this.gutterIconRevealed),
            gutterIconSize: '80%'
        });
    }

    /**
     * Create decoration type for screen share mode (more aggressive masking)
     */
    private createScreenShareDecorationType(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 71, 87, 0.25)',
            border: '2px solid rgba(255, 71, 87, 0.5)',
            borderRadius: '3px',
            // Hide the original text - make it transparent with opacity
            opacity: '0'
        });
    }

    /**
     * Generate mask string for a value
     */
    public generateMaskString(length: number): string {
        return this.maskChar.repeat(length);
    }

    /**
     * Generate partial mask (for URLs in screen share mode)
     */
    public generatePartialMask(original: string): string {
        // For URLs, show protocol and hide domain
        const urlMatch = original.match(/^(https?:\/\/)([^/]+)(\/.*)?$/);
        if (urlMatch) {
            const protocol = urlMatch[1];
            const domain = urlMatch[2];
            const path = urlMatch[3] || '';

            // Mask the main part of the domain
            const domainParts = domain.split('.');
            if (domainParts.length >= 2) {
                const maskedDomain = domainParts.map((part, i) => {
                    // Keep TLD and common service names visible
                    if (i === domainParts.length - 1 ||
                        ['com', 'org', 'io', 'co', 'api', 'supabase', 'firebase', 'aws', 'azure'].includes(part)) {
                        return part;
                    }
                    return '***';
                }).join('.');
                return `${protocol}${maskedDomain}${path}`;
            }
        }

        return this.generateMaskString(original.length);
    }

    /**
     * Get the masked decoration type
     */
    public getMaskedDecorationType(): vscode.TextEditorDecorationType {
        return this.maskedDecorationType;
    }

    /**
     * Get the revealed decoration type
     */
    public getRevealedDecorationType(): vscode.TextEditorDecorationType {
        return this.revealedDecorationType;
    }

    /**
     * Get the screen share decoration type
     */
    public getScreenShareDecorationType(): vscode.TextEditorDecorationType {
        return this.screenShareDecorationType;
    }

    /**
     * Refresh decoration types (after settings change)
     */
    public refresh(): void {
        this.maskChar = this.getMaskCharacter();

        // Dispose old decorations
        this.maskedDecorationType.dispose();
        this.revealedDecorationType.dispose();
        this.screenShareDecorationType.dispose();

        // Recreate with new settings
        this.gutterIconMasked = this.createGutterIconSvg(true);
        this.gutterIconRevealed = this.createGutterIconSvg(false);
        this.maskedDecorationType = this.createMaskedDecorationType();
        this.revealedDecorationType = this.createRevealedDecorationType();
        this.screenShareDecorationType = this.createScreenShareDecorationType();
    }

    /**
     * Dispose all decoration types
     */
    public dispose(): void {
        this.maskedDecorationType.dispose();
        this.revealedDecorationType.dispose();
        this.screenShareDecorationType.dispose();
    }
}

/**
 * Export singleton instance
 */
export const decorationProvider = new DecorationProvider();
