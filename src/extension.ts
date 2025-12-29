// VEIL Extension - Main Entry Point
// Visual Environment Information Lock
// Detects and visually masks sensitive information in VS Code

import * as vscode from 'vscode';
import { detectionEngine } from './detection/detector';
import { maskingEngine } from './masking/maskingEngine';
import { revealManager } from './masking/revealManager';
import { decorationProvider } from './masking/decorationProvider';
import { screenShareMode } from './modes/screenShareMode';
import { statusBarManager } from './ui/statusBar';
import { settingsManager } from './ui/settings';
import { registerCommands } from './ui/commands';
import { EXTENSION_NAME } from './utils/constants';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('VEIL extension is activating...');

    // Register commands
    registerCommands(context);

    // Register event handlers
    registerEventHandlers(context);

    // Scan all open documents
    scanAllOpenDocuments();

    // Subscribe to settings changes
    context.subscriptions.push(
        settingsManager.onSettingsChanged(() => {
            detectionEngine.loadSettings();
            maskingEngine.loadSettings();
            screenShareMode.loadSettings();
            decorationProvider.refresh();
            maskingEngine.refreshAllEditors();
            statusBarManager.update();
        })
    );

    // Add disposables
    context.subscriptions.push(
        statusBarManager.getStatusBarItem(),
        { dispose: () => revealManager.dispose() },
        { dispose: () => decorationProvider.dispose() },
        { dispose: () => settingsManager.dispose() }
    );

    console.log('VEIL extension activated successfully!');

    // Show welcome message on first activation
    showWelcomeMessage(context);
}

/**
 * Register event handlers for document changes
 */
function registerEventHandlers(context: vscode.ExtensionContext): void {
    // Handle document open
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            if (shouldScanDocument(document)) {
                const matches = detectionEngine.scanDocument(document);

                // Apply masks if there's an active editor for this document
                const editor = vscode.window.visibleTextEditors.find(
                    e => e.document === document
                );
                if (editor) {
                    maskingEngine.applyMasks(editor);
                    statusBarManager.showSecretsFoundNotification(matches.length);
                }
            }
        })
    );

    // Handle document change
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (shouldScanDocument(event.document)) {
                detectionEngine.scanDocument(event.document);

                const editor = vscode.window.visibleTextEditors.find(
                    e => e.document === event.document
                );
                if (editor) {
                    maskingEngine.applyMasks(editor);
                }
            }
        })
    );

    // Handle active editor change
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && shouldScanDocument(editor.document)) {
                // Scan if not already scanned
                const uri = editor.document.uri.toString();
                if (!detectionEngine.getDocumentState(uri)) {
                    detectionEngine.scanDocument(editor.document);
                }

                maskingEngine.applyMasks(editor);
                statusBarManager.update();
            } else {
                statusBarManager.update();
            }
        })
    );

    // Handle visible editors change
    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(editors => {
            for (const editor of editors) {
                if (shouldScanDocument(editor.document)) {
                    const uri = editor.document.uri.toString();
                    if (!detectionEngine.getDocumentState(uri)) {
                        detectionEngine.scanDocument(editor.document);
                    }
                    maskingEngine.applyMasks(editor);
                }
            }
            statusBarManager.update();
        })
    );

    // Handle document close - clean up state
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(document => {
            detectionEngine.clearDocumentState(document.uri.toString());
        })
    );
}

/**
 * Check if document should be scanned
 */
function shouldScanDocument(document: vscode.TextDocument): boolean {
    // Skip non-file documents
    if (document.uri.scheme !== 'file') {
        return false;
    }

    // Skip very large files (>1MB)
    const text = document.getText();
    if (text.length > 1000000) {
        return false;
    }

    // Skip binary files (check for null bytes)
    if (text.includes('\0')) {
        return false;
    }

    return true;
}

/**
 * Scan all currently open documents
 */
function scanAllOpenDocuments(): void {
    for (const document of vscode.workspace.textDocuments) {
        if (shouldScanDocument(document)) {
            detectionEngine.scanDocument(document);
        }
    }

    // Apply masks to visible editors
    for (const editor of vscode.window.visibleTextEditors) {
        if (shouldScanDocument(editor.document)) {
            maskingEngine.applyMasks(editor);
        }
    }

    statusBarManager.update();
}

/**
 * Show welcome message on first activation
 */
function showWelcomeMessage(context: vscode.ExtensionContext): void {
    const hasShownWelcome = context.globalState.get<boolean>('veil.hasShownWelcome', false);

    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            '🔒 VEIL is now protecting your secrets! Use Ctrl+Shift+V to toggle, Ctrl+Shift+S for Screen Share Mode.',
            'Open Settings',
            'Got it!'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('veil.openSettings');
            }
        });

        context.globalState.update('veil.hasShownWelcome', true);
    }
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    console.log('VEIL extension deactivated');
}
