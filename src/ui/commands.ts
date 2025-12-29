// Command handlers for VEIL extension

import * as vscode from 'vscode';
import { detectionEngine } from '../detection/detector';
import { maskingEngine } from '../masking/maskingEngine';
import { revealManager } from '../masking/revealManager';
import { screenShareMode } from '../modes/screenShareMode';
import { statusBarManager } from './statusBar';
import { settingsManager } from './settings';
import { customRulesManager } from '../detection/customRules';
import { EXTENSION_NAME } from '../utils/constants';

/**
 * Command IDs
 */
export const COMMANDS = {
    TOGGLE: 'veil.toggle',
    SCREEN_SHARE_MODE: 'veil.screenShareMode',
    REVEAL_ALL: 'veil.revealAll',
    MASK_ALL: 'veil.maskAll',
    TOGGLE_FILE: 'veil.toggleFile',
    TOGGLE_MATCH: 'veil.toggleMatch',
    TOGGLE_AT_CURSOR: 'veil.toggleAtCursor',
    ADD_PATTERN: 'veil.addPattern',
    ADD_HIDDEN_VARIABLE: 'veil.addHiddenVariable',
    ADD_HIDDEN_STRING: 'veil.addHiddenString',
    OPEN_SETTINGS: 'veil.openSettings',
    TEMPORARY_REVEAL: 'veil.temporaryReveal'
};

/**
 * Register all commands for VEIL extension
 */
export function registerCommands(context: vscode.ExtensionContext): void {
    // Toggle extension enabled/disabled
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.TOGGLE, async () => {
            const isEnabled = maskingEngine.toggle();

            // Update configuration
            const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
            await config.update('enabled', isEnabled, vscode.ConfigurationTarget.Global);

            // Refresh
            detectionEngine.loadSettings();
            maskingEngine.refreshAllEditors();
            statusBarManager.update();

            vscode.window.showInformationMessage(
                `VEIL ${isEnabled ? 'enabled' : 'disabled'}`
            );
        })
    );

    // Toggle screen share mode
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.SCREEN_SHARE_MODE, async () => {
            await screenShareMode.toggle();
            statusBarManager.update();
        })
    );

    // Reveal all secrets in current file
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.REVEAL_ALL, () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && !screenShareMode.getIsActive()) {
                const uri = editor.document.uri.toString();
                detectionEngine.revealAll(uri);
                maskingEngine.applyMasks(editor);
                statusBarManager.update();
            } else if (screenShareMode.getIsActive()) {
                vscode.window.showWarningMessage(
                    'Cannot reveal secrets while Screen Share Mode is active'
                );
            }
        })
    );

    // Mask all secrets in current file
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.MASK_ALL, () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const uri = editor.document.uri.toString();
                detectionEngine.maskAll(uri);
                maskingEngine.applyMasks(editor);
                statusBarManager.update();
            }
        })
    );

    // Toggle masking for current file
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.TOGGLE_FILE, () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && !screenShareMode.getIsActive()) {
                const uri = editor.document.uri.toString();
                const isMasked = detectionEngine.toggleFileMask(uri);
                maskingEngine.applyMasks(editor);
                statusBarManager.update();

                vscode.window.setStatusBarMessage(
                    `File secrets ${isMasked ? 'masked' : 'revealed'}`,
                    2000
                );
            }
        })
    );

    // Toggle specific match (used from hover message links)
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.TOGGLE_MATCH, (...args: unknown[]) => {
            console.log('VEIL: toggleMatch called with args:', args);

            // Handle both array format [["id"]] and direct string format
            let matchId: string;
            if (Array.isArray(args[0])) {
                matchId = args[0][0] as string;
            } else if (typeof args[0] === 'string') {
                matchId = args[0];
            } else {
                console.log('VEIL: Invalid matchId argument:', args);
                return;
            }

            console.log('VEIL: Parsed matchId:', matchId);

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                console.log('VEIL: No active editor');
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            if (screenShareMode.getIsActive()) {
                vscode.window.showWarningMessage('Cannot toggle secrets while Screen Share Mode is active');
                return;
            }

            const uri = editor.document.uri.toString();

            // Handle matchId that might be double-quoted from JSON.stringify
            let cleanMatchId = matchId;
            if (typeof matchId === 'string' && matchId.startsWith('"') && matchId.endsWith('"')) {
                cleanMatchId = matchId.slice(1, -1);
            }

            console.log('VEIL: Toggling mask for:', cleanMatchId);
            const newState = detectionEngine.toggleMatchMask(uri, cleanMatchId);
            console.log('VEIL: New mask state:', newState);

            maskingEngine.applyMasks(editor);
            statusBarManager.update();

            vscode.window.showInformationMessage(
                `Secret ${newState ? 'masked' : 'revealed'}`
            );
        })
    );

    // Toggle secret at cursor position (keyboard accessible)
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.TOGGLE_AT_CURSOR, () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            if (screenShareMode.getIsActive()) {
                vscode.window.showWarningMessage('Cannot toggle secrets while Screen Share Mode is active');
                return;
            }

            const uri = editor.document.uri.toString();
            const cursorPos = editor.selection.active;

            console.log('VEIL: toggleAtCursor - cursor at line', cursorPos.line, 'char', cursorPos.character);

            // Find match at cursor position
            let state = detectionEngine.getDocumentState(uri);

            // If no state, rescan the document first
            if (!state || state.matches.length === 0) {
                console.log('VEIL: No state found, rescanning document...');
                detectionEngine.scanDocument(editor.document);
                state = detectionEngine.getDocumentState(uri);
            }

            if (!state || state.matches.length === 0) {
                vscode.window.showInformationMessage('No secrets detected in this file');
                return;
            }

            console.log('VEIL: Found', state.matches.length, 'matches in document');
            console.log('VEIL: Match lines:', state.matches.map(m => m.range.start.line));

            // First try: find match that contains cursor
            let matchAtCursor = state.matches.find(m => m.range.contains(cursorPos));

            // Second try: find match on same line as cursor
            if (!matchAtCursor) {
                matchAtCursor = state.matches.find(m => m.range.start.line === cursorPos.line);
            }

            if (matchAtCursor) {
                console.log('VEIL: Found match:', matchAtCursor.id, 'isMasked:', matchAtCursor.isMasked);
                // Toggle this specific match
                const newState = detectionEngine.toggleMatchMask(uri, matchAtCursor.id);
                console.log('VEIL: New mask state:', newState);
                maskingEngine.applyMasks(editor);
                statusBarManager.update();
                vscode.window.showInformationMessage(
                    `Secret ${newState ? 'masked' : 'revealed'}`
                );
            } else {
                console.log('VEIL: No match found at cursor position or on line', cursorPos.line);
                vscode.window.showInformationMessage('No secret found on this line. Move cursor to a line with a masked value.');
            }
        })
    );
    // Add custom pattern
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_PATTERN, async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter a name for this pattern',
                placeHolder: 'e.g., Internal API Key'
            });

            if (!name) {
                return;
            }

            const pattern = await vscode.window.showInputBox({
                prompt: 'Enter the regex pattern',
                placeHolder: 'e.g., internal_api_[a-z0-9]{32}',
                validateInput: (value) => {
                    try {
                        new RegExp(value);
                        return null;
                    } catch (e) {
                        return 'Invalid regex pattern';
                    }
                }
            });

            if (!pattern) {
                return;
            }

            const description = await vscode.window.showInputBox({
                prompt: 'Enter a description (optional)',
                placeHolder: 'e.g., Company internal API keys'
            });

            await customRulesManager.addCustomPattern(name, pattern, description);
            detectionEngine.loadSettings();
            maskingEngine.refreshAllEditors();

            vscode.window.showInformationMessage(`Custom pattern "${name}" added`);
        })
    );

    // Add hidden variable
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_HIDDEN_VARIABLE, async () => {
            const variable = await vscode.window.showInputBox({
                prompt: 'Enter the variable name to always hide',
                placeHolder: 'e.g., MY_SECRET_TOKEN'
            });

            if (variable) {
                await customRulesManager.addHiddenVariable(variable);
                detectionEngine.loadSettings();
                maskingEngine.refreshAllEditors();

                vscode.window.showInformationMessage(`Variable "${variable}" will now be hidden`);
            }
        })
    );

    // Add hidden string
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.ADD_HIDDEN_STRING, async () => {
            const str = await vscode.window.showInputBox({
                prompt: 'Enter the string to always hide',
                placeHolder: 'e.g., my-secret-project-id'
            });

            if (str) {
                await customRulesManager.addHiddenString(str);
                detectionEngine.loadSettings();
                maskingEngine.refreshAllEditors();

                vscode.window.showInformationMessage(`String will now be hidden`);
            }
        })
    );

    // Open settings
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.OPEN_SETTINGS, () => {
            settingsManager.openSettings();
        })
    );

    // Temporary reveal (with timeout)
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMANDS.TEMPORARY_REVEAL, (matchId?: string) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && !screenShareMode.getIsActive()) {
                const uri = editor.document.uri.toString();

                if (matchId) {
                    revealManager.temporaryReveal(uri, matchId);
                } else {
                    revealManager.temporaryRevealAll(uri);
                }
            }
        })
    );
}

/**
 * Get command disposables count
 */
export function getCommandCount(): number {
    return Object.keys(COMMANDS).length;
}
