// Reveal manager for hover and temporary reveal functionality

import * as vscode from 'vscode';
import { detectionEngine } from '../detection/detector';
import { maskingEngine } from './maskingEngine';
import { EXTENSION_NAME } from '../utils/constants';

/**
 * Manages hover-to-reveal and temporary reveal functionality
 */
export class RevealManager implements vscode.HoverProvider {
    private temporaryReveals: Map<string, NodeJS.Timeout> = new Map();
    private disposables: vscode.Disposable[] = [];

    constructor() {
        // Register hover provider for all languages
        this.disposables.push(
            vscode.languages.registerHoverProvider('*', this)
        );
    }

    /**
     * Provide hover content for sensitive matches
     */
    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.Hover | undefined {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        const hoverToReveal = config.get<boolean>('hoverToReveal', true);

        if (!hoverToReveal || maskingEngine.getIsScreenShareMode()) {
            return undefined;
        }

        const uri = document.uri.toString();
        const matches = detectionEngine.getMatches(uri);

        // Find match at current position
        const match = matches.find(m => m.range.contains(position));

        if (!match || !match.isMasked) {
            return undefined;
        }

        // Create hover content with peek
        const content = new vscode.MarkdownString();
        content.isTrusted = true;
        content.supportHtml = true;

        content.appendMarkdown(`### 🔐 ${match.type}\n\n`);

        if (match.keyName) {
            content.appendMarkdown(`**Variable:** \`${match.keyName}\`\n\n`);
        }

        content.appendMarkdown(`**Confidence:** ${match.confidence}%\n\n`);
        content.appendMarkdown(`---\n\n`);
        content.appendMarkdown(`**Value (peek):**\n\n`);
        content.appendCodeblock(this.obfuscateForPeek(match.originalValue));
        content.appendMarkdown(`\n\n`);
        content.appendMarkdown(`*Click the eye icon in the gutter to toggle visibility*`);

        return new vscode.Hover(content, match.range);
    }

    /**
     * Obfuscate value for peek (show partial)
     */
    private obfuscateForPeek(value: string): string {
        if (value.length <= 10) {
            return value.substring(0, 2) + '●'.repeat(value.length - 2);
        }

        const showStart = 4;
        const showEnd = 4;
        const middle = '●'.repeat(Math.min(12, value.length - showStart - showEnd));

        return value.substring(0, showStart) + middle + value.substring(value.length - showEnd);
    }

    /**
     * Temporarily reveal a secret
     */
    public temporaryReveal(uri: string, matchId: string): void {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        const duration = config.get<number>('revealDuration', 5000);

        // Clear existing timeout if any
        const existingTimeout = this.temporaryReveals.get(matchId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Reveal the match
        detectionEngine.toggleMatchMask(uri, matchId);
        maskingEngine.refreshAllEditors();

        // Set timeout to re-mask
        const timeout = setTimeout(() => {
            const state = detectionEngine.getDocumentState(uri);
            if (state) {
                const match = state.matches.find(m => m.id === matchId);
                if (match && !match.isMasked) {
                    detectionEngine.toggleMatchMask(uri, matchId);
                    maskingEngine.refreshAllEditors();
                }
            }
            this.temporaryReveals.delete(matchId);
        }, duration);

        this.temporaryReveals.set(matchId, timeout);
    }

    /**
     * Reveal all secrets temporarily
     */
    public temporaryRevealAll(uri: string): void {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        const duration = config.get<number>('revealDuration', 5000);

        // Reveal all
        detectionEngine.revealAll(uri);
        maskingEngine.refreshAllEditors();

        // Set timeout to re-mask
        setTimeout(() => {
            detectionEngine.maskAll(uri);
            maskingEngine.refreshAllEditors();
        }, duration);
    }

    /**
     * Clear all temporary reveals
     */
    public clearAllTemporaryReveals(): void {
        for (const timeout of this.temporaryReveals.values()) {
            clearTimeout(timeout);
        }
        this.temporaryReveals.clear();
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.clearAllTemporaryReveals();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }
}

/**
 * Export singleton instance
 */
export const revealManager = new RevealManager();
