// Masking engine for applying visual masks to VS Code editors

import * as vscode from 'vscode';
import { SensitiveMatch } from '../utils/types';
import { detectionEngine } from '../detection/detector';
import { decorationProvider } from './decorationProvider';
import { EXTENSION_NAME, URL_PATTERN } from '../utils/constants';

/**
 * Masking Engine that applies visual decorations to hide sensitive content
 */
export class MaskingEngine {
    private isEnabled: boolean = true;
    private isScreenShareMode: boolean = false;

    constructor() {
        this.loadSettings();
    }

    /**
     * Load settings from configuration
     */
    public loadSettings(): void {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        this.isEnabled = config.get<boolean>('enabled', true);
        this.isScreenShareMode = config.get<boolean>('screenShareMode', false);
    }

    /**
     * Apply masks to the active editor
     */
    public applyMasks(editor: vscode.TextEditor): void {
        console.log('VEIL: applyMasks called, isEnabled:', this.isEnabled);

        if (!this.isEnabled) {
            this.clearMasks(editor);
            return;
        }

        const document = editor.document;
        const uri = document.uri.toString();

        // Get matches from detection engine
        const matches = detectionEngine.getMatches(uri);
        console.log('VEIL: Got matches:', matches.length, 'matches');
        console.log('VEIL: Match states:', matches.map(m => ({ id: m.id.slice(-20), isMasked: m.isMasked })));

        if (matches.length === 0) {
            this.clearMasks(editor);
            return;
        }

        // Separate matches by mask state
        const maskedDecorations: vscode.DecorationOptions[] = [];
        const revealedDecorations: vscode.DecorationOptions[] = [];
        const screenShareDecorations: vscode.DecorationOptions[] = [];

        for (const match of matches) {
            if (this.isScreenShareMode) {
                // In screen share mode, always mask with stronger visual
                const maskContent = decorationProvider.generateMaskString(match.originalValue.length);
                screenShareDecorations.push({
                    range: match.range,
                    renderOptions: {
                        before: {
                            contentText: maskContent,
                            color: '#ff4757',
                            fontWeight: 'bold'
                        },
                        after: {
                            contentText: '  🔒',
                            color: '#ff4757',
                            fontWeight: 'bold'
                        }
                    },
                    hoverMessage: new vscode.MarkdownString('🔒 **Screen Share Mode Active**\n\nSecrets are hidden for your protection.')
                });
            } else if (match.isMasked) {
                // Normal masked state - with toggle indicator at end
                const maskContent = decorationProvider.generateMaskString(match.originalValue.length);
                maskedDecorations.push({
                    range: match.range,
                    renderOptions: {
                        before: {
                            contentText: maskContent,
                            color: '#ff6b6b'
                        },
                        after: {
                            contentText: ' 👁',
                            color: '#888888'
                        }
                    },
                    hoverMessage: this.createHoverMessage(match)
                });
            } else {
                // Revealed state - with toggle indicator at end
                revealedDecorations.push({
                    range: match.range,
                    renderOptions: {
                        after: {
                            contentText: ' 🔓',
                            color: '#51cf66'
                        }
                    },
                    hoverMessage: this.createRevealedHoverMessage(match)
                });
            }
        }

        // Apply URL masking in screen share mode
        if (this.isScreenShareMode) {
            const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
            if (config.get<boolean>('maskUrls', true)) {
                this.addUrlMasks(editor, screenShareDecorations);
            }
        }

        // Apply decorations
        editor.setDecorations(decorationProvider.getMaskedDecorationType(), maskedDecorations);
        editor.setDecorations(decorationProvider.getRevealedDecorationType(), revealedDecorations);
        editor.setDecorations(decorationProvider.getScreenShareDecorationType(), screenShareDecorations);
    }

    /**
     * Add URL masks for screen share mode
     */
    private addUrlMasks(editor: vscode.TextEditor, decorations: vscode.DecorationOptions[]): void {
        const text = editor.document.getText();
        URL_PATTERN.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = URL_PATTERN.exec(text)) !== null) {
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(match.index + match[0].length);
            const range = new vscode.Range(startPos, endPos);

            // Check if this URL is already covered by another match
            const alreadyCovered = decorations.some(d =>
                d.range.contains(range) || range.contains(d.range)
            );

            if (!alreadyCovered) {
                const maskedUrl = decorationProvider.generatePartialMask(match[0]);
                decorations.push({
                    range,
                    renderOptions: {
                        before: {
                            contentText: maskedUrl,
                            color: '#ffd43b'
                        }
                    },
                    hoverMessage: new vscode.MarkdownString('🔗 **URL partially hidden in Screen Share Mode**')
                });
            }
        }
    }

    /**
     * Create hover message for masked content
     */
    private createHoverMessage(match: SensitiveMatch): vscode.MarkdownString {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        const hoverToReveal = config.get<boolean>('hoverToReveal', true);

        const message = new vscode.MarkdownString();
        message.isTrusted = true;
        message.supportHtml = true;

        message.appendMarkdown(`🔒 **${match.type}**\n\n`);

        if (match.keyName) {
            message.appendMarkdown(`Variable: \`${match.keyName}\`\n\n`);
        }

        message.appendMarkdown(`Confidence: ${match.confidence}%\n\n`);

        if (hoverToReveal) {
            message.appendMarkdown(`---\n\n`);
            message.appendMarkdown(`*Peek:* \`${this.obfuscateValue(match.originalValue)}\`\n\n`);
        }

        message.appendMarkdown(`---\n\n`);
        message.appendMarkdown(`**Press \`Ctrl+.\` to reveal**`);

        return message;
    }

    /**
     * Create hover message for revealed content
     */
    private createRevealedHoverMessage(match: SensitiveMatch): vscode.MarkdownString {
        const message = new vscode.MarkdownString();
        message.isTrusted = true;
        message.supportHtml = true;

        message.appendMarkdown(`🔓 **${match.type}** (Revealed)\n\n`);

        if (match.keyName) {
            message.appendMarkdown(`Variable: \`${match.keyName}\`\n\n`);
        }

        message.appendMarkdown(`---\n\n`);
        message.appendMarkdown(`**Press \`Ctrl+.\` to hide**`);

        return message;
    }

    /**
     * Obfuscate value for peek display (show first/last few chars)
     */
    private obfuscateValue(value: string): string {
        if (value.length <= 8) {
            return '●'.repeat(value.length);
        }

        const showChars = 3;
        const start = value.substring(0, showChars);
        const middle = '●'.repeat(Math.min(10, value.length - showChars * 2));
        const end = value.substring(value.length - showChars);

        return `${start}${middle}${end}`;
    }

    /**
     * Clear all masks from editor
     */
    public clearMasks(editor: vscode.TextEditor): void {
        editor.setDecorations(decorationProvider.getMaskedDecorationType(), []);
        editor.setDecorations(decorationProvider.getRevealedDecorationType(), []);
        editor.setDecorations(decorationProvider.getScreenShareDecorationType(), []);
    }

    /**
     * Toggle extension enabled state
     */
    public toggle(): boolean {
        this.isEnabled = !this.isEnabled;
        return this.isEnabled;
    }

    /**
     * Set enabled state
     */
    public setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    /**
     * Get enabled state
     */
    public getIsEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Toggle screen share mode
     */
    public toggleScreenShareMode(): boolean {
        this.isScreenShareMode = !this.isScreenShareMode;
        return this.isScreenShareMode;
    }

    /**
     * Set screen share mode
     */
    public setScreenShareMode(enabled: boolean): void {
        this.isScreenShareMode = enabled;
    }

    /**
     * Get screen share mode state
     */
    public getIsScreenShareMode(): boolean {
        return this.isScreenShareMode;
    }

    /**
     * Refresh all open editors
     */
    public refreshAllEditors(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            detectionEngine.scanDocument(editor.document);
            this.applyMasks(editor);
        }
    }
}

/**
 * Export singleton instance
 */
export const maskingEngine = new MaskingEngine();
