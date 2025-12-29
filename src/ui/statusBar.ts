// Status bar integration for VEIL extension

import * as vscode from 'vscode';
import { detectionEngine } from '../detection/detector';
import { maskingEngine } from '../masking/maskingEngine';
import { screenShareMode } from '../modes/screenShareMode';
import { STATUS_BAR_PRIORITY, COLORS } from '../utils/constants';

/**
 * Status Bar Manager for VEIL extension
 */
export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private screenShareItem: vscode.StatusBarItem;

    constructor() {
        // Main VEIL status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            STATUS_BAR_PRIORITY
        );
        this.statusBarItem.command = 'veil.toggle';
        this.statusBarItem.tooltip = 'Click to toggle VEIL';

        // Screen share mode indicator
        this.screenShareItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            STATUS_BAR_PRIORITY + 1
        );
        this.screenShareItem.command = 'veil.screenShareMode';
        this.screenShareItem.tooltip = 'Click to toggle Screen Share Mode';

        this.update();
        this.statusBarItem.show();
    }

    /**
     * Update status bar display
     */
    public update(): void {
        const isEnabled = maskingEngine.getIsEnabled();
        const isScreenShare = screenShareMode.getIsActive();

        // Get current document stats
        const editor = vscode.window.activeTextEditor;
        let secretCount = 0;
        let maskedCount = 0;

        if (editor) {
            const uri = editor.document.uri.toString();
            secretCount = detectionEngine.getSecretCount(uri);
            maskedCount = detectionEngine.getMaskedCount(uri);
        }

        // Update main status bar
        if (!isEnabled) {
            this.statusBarItem.text = '$(eye-closed) VEIL: Off';
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.color = '#888888';
        } else if (secretCount > 0) {
            const icon = maskedCount === secretCount ? '$(shield)' : '$(eye)';
            this.statusBarItem.text = `${icon} VEIL: ${maskedCount}/${secretCount}`;
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.color = maskedCount === secretCount ? COLORS.masked : COLORS.revealed;
        } else {
            this.statusBarItem.text = '$(shield) VEIL';
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.color = undefined;
        }

        // Update screen share indicator
        if (isScreenShare) {
            this.screenShareItem.text = '$(broadcast) LIVE';
            this.screenShareItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.screenShareItem.color = '#ffffff';
            this.screenShareItem.tooltip = '🔴 Screen Share Mode ACTIVE - Click to deactivate';
            this.screenShareItem.show();
        } else {
            this.screenShareItem.hide();
        }
    }

    /**
     * Show notification about secrets found
     */
    public showSecretsFoundNotification(count: number): void {
        if (count > 0) {
            vscode.window.setStatusBarMessage(
                `🔒 VEIL: Found ${count} secret${count > 1 ? 's' : ''} in this file`,
                3000
            );
        }
    }

    /**
     * Get the main status bar item
     */
    public getStatusBarItem(): vscode.StatusBarItem {
        return this.statusBarItem;
    }

    /**
     * Dispose status bar items
     */
    public dispose(): void {
        this.statusBarItem.dispose();
        this.screenShareItem.dispose();
    }
}

/**
 * Export singleton instance
 */
export const statusBarManager = new StatusBarManager();
