// Screen share mode handler

import * as vscode from 'vscode';
import { detectionEngine } from '../detection/detector';
import { maskingEngine } from '../masking/maskingEngine';
import { EXTENSION_NAME, COLORS } from '../utils/constants';

/**
 * Screen Share Mode Manager
 * Provides instant, aggressive masking for streaming/presenting
 */
export class ScreenShareMode {
    private isActive: boolean = false;
    private originalStates: Map<string, Map<string, boolean>> = new Map();

    constructor() {
        this.loadSettings();
    }

    /**
     * Load settings from configuration
     */
    public loadSettings(): void {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        this.isActive = config.get<boolean>('screenShareMode', false);
    }

    /**
     * Toggle screen share mode
     */
    public async toggle(): Promise<boolean> {
        if (this.isActive) {
            await this.deactivate();
        } else {
            await this.activate();
        }
        return this.isActive;
    }

    /**
     * Activate screen share mode
     */
    public async activate(): Promise<void> {
        // Save current reveal states before forcing all masked
        this.saveCurrentStates();

        this.isActive = true;
        maskingEngine.setScreenShareMode(true);

        // Update configuration
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        await config.update('screenShareMode', true, vscode.ConfigurationTarget.Global);

        // Force mask all open documents
        for (const editor of vscode.window.visibleTextEditors) {
            const uri = editor.document.uri.toString();
            detectionEngine.maskAll(uri);
        }

        // Refresh all editors
        maskingEngine.refreshAllEditors();

        // Show notification
        vscode.window.showInformationMessage(
            '🔴 Screen Share Mode ACTIVE - All secrets are now hidden',
            'Deactivate'
        ).then(selection => {
            if (selection === 'Deactivate') {
                this.toggle();
            }
        });
    }

    /**
     * Deactivate screen share mode
     */
    public async deactivate(): Promise<void> {
        this.isActive = false;
        maskingEngine.setScreenShareMode(false);

        // Update configuration
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        await config.update('screenShareMode', false, vscode.ConfigurationTarget.Global);

        // Restore previous reveal states
        this.restoreSavedStates();

        // Refresh all editors
        maskingEngine.refreshAllEditors();

        // Show notification
        vscode.window.showInformationMessage('Screen Share Mode deactivated');
    }

    /**
     * Save current reveal states for all documents
     */
    private saveCurrentStates(): void {
        this.originalStates.clear();

        for (const editor of vscode.window.visibleTextEditors) {
            const uri = editor.document.uri.toString();
            const state = detectionEngine.getDocumentState(uri);

            if (state) {
                const matchStates = new Map<string, boolean>();
                for (const match of state.matches) {
                    matchStates.set(match.id, match.isMasked);
                }
                this.originalStates.set(uri, matchStates);
            }
        }
    }

    /**
     * Restore saved reveal states
     */
    private restoreSavedStates(): void {
        for (const [uri, matchStates] of this.originalStates) {
            const state = detectionEngine.getDocumentState(uri);
            if (state) {
                for (const match of state.matches) {
                    const originalMasked = matchStates.get(match.id);
                    if (originalMasked !== undefined && originalMasked !== match.isMasked) {
                        detectionEngine.toggleMatchMask(uri, match.id);
                    }
                }
            }
        }
        this.originalStates.clear();
    }

    /**
     * Get active state
     */
    public getIsActive(): boolean {
        return this.isActive;
    }

    /**
     * Set active state directly
     */
    public setActive(active: boolean): void {
        this.isActive = active;
    }
}

/**
 * Export singleton instance
 */
export const screenShareMode = new ScreenShareMode();
