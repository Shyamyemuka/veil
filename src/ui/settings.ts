// Settings management for VEIL extension

import * as vscode from 'vscode';
import { VeilSettings, CustomPattern } from '../utils/types';
import { EXTENSION_NAME, DEFAULT_MASK_CHAR, DEFAULT_REVEAL_DURATION } from '../utils/constants';

/**
 * Settings Manager for VEIL extension
 */
export class SettingsManager {
    private disposables: vscode.Disposable[] = [];
    private onSettingsChangedEmitter = new vscode.EventEmitter<VeilSettings>();

    /**
     * Event fired when settings change
     */
    public readonly onSettingsChanged = this.onSettingsChangedEmitter.event;

    constructor() {
        // Watch for configuration changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration(EXTENSION_NAME)) {
                    this.onSettingsChangedEmitter.fire(this.getSettings());
                }
            })
        );
    }

    /**
     * Get all settings
     */
    public getSettings(): VeilSettings {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);

        return {
            enabled: config.get<boolean>('enabled', true),
            screenShareMode: config.get<boolean>('screenShareMode', false),
            maskCharacter: config.get<string>('maskCharacter', DEFAULT_MASK_CHAR),
            hoverToReveal: config.get<boolean>('hoverToReveal', true),
            revealDuration: config.get<number>('revealDuration', DEFAULT_REVEAL_DURATION),
            maskUrls: config.get<boolean>('maskUrls', true),
            customPatterns: config.get<CustomPattern[]>('customPatterns', []),
            hiddenVariables: config.get<string[]>('hiddenVariables', []),
            hiddenStrings: config.get<string[]>('hiddenStrings', [])
        };
    }

    /**
     * Update a setting
     */
    public async updateSetting<K extends keyof VeilSettings>(
        key: K,
        value: VeilSettings[K],
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        await config.update(key, value, target);
    }

    /**
     * Add a custom pattern
     */
    public async addCustomPattern(pattern: CustomPattern): Promise<void> {
        const settings = this.getSettings();
        const patterns = [...settings.customPatterns, pattern];
        await this.updateSetting('customPatterns', patterns);
    }

    /**
     * Remove a custom pattern
     */
    public async removeCustomPattern(name: string): Promise<void> {
        const settings = this.getSettings();
        const patterns = settings.customPatterns.filter(p => p.name !== name);
        await this.updateSetting('customPatterns', patterns);
    }

    /**
     * Add a hidden variable
     */
    public async addHiddenVariable(variable: string): Promise<void> {
        const settings = this.getSettings();
        if (!settings.hiddenVariables.includes(variable)) {
            const variables = [...settings.hiddenVariables, variable];
            await this.updateSetting('hiddenVariables', variables);
        }
    }

    /**
     * Remove a hidden variable
     */
    public async removeHiddenVariable(variable: string): Promise<void> {
        const settings = this.getSettings();
        const variables = settings.hiddenVariables.filter(v => v !== variable);
        await this.updateSetting('hiddenVariables', variables);
    }

    /**
     * Add a hidden string
     */
    public async addHiddenString(str: string): Promise<void> {
        const settings = this.getSettings();
        if (!settings.hiddenStrings.includes(str)) {
            const strings = [...settings.hiddenStrings, str];
            await this.updateSetting('hiddenStrings', strings);
        }
    }

    /**
     * Remove a hidden string
     */
    public async removeHiddenString(str: string): Promise<void> {
        const settings = this.getSettings();
        const strings = settings.hiddenStrings.filter(s => s !== str);
        await this.updateSetting('hiddenStrings', strings);
    }

    /**
     * Open VEIL settings in VS Code settings editor
     */
    public openSettings(): void {
        vscode.commands.executeCommand(
            'workbench.action.openSettings',
            `@ext:veil-extension.veil`
        );
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.onSettingsChangedEmitter.dispose();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }
}

/**
 * Export singleton instance
 */
export const settingsManager = new SettingsManager();
