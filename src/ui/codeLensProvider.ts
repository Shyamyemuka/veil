// CodeLens provider for per-secret toggle buttons

import * as vscode from 'vscode';
import { detectionEngine } from '../detection/detector';
import { screenShareMode } from '../modes/screenShareMode';

/**
 * CodeLens provider that adds clickable toggle buttons for each detected secret
 */
export class SecretToggleCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        // Refresh code lenses when settings change
        vscode.workspace.onDidChangeConfiguration(() => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    /**
     * Refresh code lenses for all editors
     */
    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Provide code lenses for the document
     */
    public provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];

        // Don't show toggles in screen share mode
        if (screenShareMode.getIsActive()) {
            return codeLenses;
        }

        const uri = document.uri.toString();
        const state = detectionEngine.getDocumentState(uri);

        if (!state || state.matches.length === 0) {
            return codeLenses;
        }

        // Create a code lens for each detected secret
        for (const match of state.matches) {
            const range = new vscode.Range(
                match.range.start.line,
                0,
                match.range.start.line,
                0
            );

            const isMasked = match.isMasked;
            const title = isMasked ? '👁 Reveal' : '🔒 Hide';
            const tooltip = isMasked
                ? `Click to reveal this secret (${match.keyName || match.type})`
                : `Click to hide this secret (${match.keyName || match.type})`;

            codeLenses.push(new vscode.CodeLens(range, {
                title,
                tooltip,
                command: 'veil.toggleMatch',
                arguments: [match.id]
            }));
        }

        return codeLenses;
    }
}

/**
 * Singleton instance
 */
export const secretToggleCodeLensProvider = new SecretToggleCodeLensProvider();
