// Copyright (c) 2016-2017 Vittorio Romeo
// License: Academic Free License ("AFL") v. 3.0
// AFL License page: http://opensource.org/licenses/AFL-3.0
// https://vittorioromeo.info | vittorio.romeo@outlook.com

'use strict';
import * as vscode from 'vscode';

// Bracket tables
const symbols_l = ['{', '[', '('];
const symbols_r = ['}', ']', ')'];

// Return the top of the stack
const peek = (stack) => stack.slice(-1)[0];

// Show unbalanced brackets error
const show_error_popup = () => vscode.window.showInformationMessage('Unbalanced brackets :(');

const show_error_popup2 = (l, r) => vscode.window.showInformationMessage(
    'Unbalanced brackets ' + l + ' and ' + r);

// Behavior for `search_scope` towards left
const left = 
{
    predicate: (i, _) => i >= 0,
    step: -1,
    my_symbols: symbols_l,
    other_symbols: symbols_r
};

// Behavior for `search_scope` towards right
const right = 
{
    predicate: (i, text) => i < text.length,
    step: 1,
    my_symbols: symbols_r,
    other_symbols: symbols_l
};

function search_scope(text: string, offset: number, direction, then)
{
    // Stack of other brackets
    let stack: number[] = [];

    // Look for bracket towards direction
    for (let i = offset; direction.predicate(i, text); i += direction.step) 
    {
        // Current character
        const c = text[i];
        
        let matching_other = direction.other_symbols.indexOf(c);
        if(matching_other !== -1) 
        {
            // Found bracket of "other" kind while looking for "my" bracket
            stack.push(matching_other);
            continue;
        }
        
        let matching_my = direction.my_symbols.indexOf(c);
        if (matching_my === -1) 
        {
            continue;
        }
        else if(stack.length > 0)
        {
            // Found "my" bracket
            if(peek(stack) === matching_my)
            {
                // Bracket of "my" kind matches top of stack
                stack.pop();
                continue;
            }
            else
            {
                // Failure
                show_error_popup();
                return;
            }
        }
        else
        {
            then(i, matching_my);
            return;
        }
    }

    // No matching brackets found, now searching for empty lines.
    // But if this is searching left, and already in a empty line, then stay here.
    if (direction.step < 0 && offset + 1 < text.length &&
        text[offset] == '\n' && text[offset + 1] == '\n') {
        then(offset, -1)
        return
    }
    let lasti: number = -1;
    for (let i = offset; direction.predicate(i, text); i += direction.step) {
        // Current character
        const c = text[i];
        if (lasti >= 0 && text[lasti] == '\n' && c == '\n') {
            then(i, -1)
            return
        }
        else {
            lasti = i
        }
    }
    if (lasti >= 0) {
        then(lasti, -1)
    }
}

export function activate(context: vscode.ExtensionContext) 
{
    const cmd_name = 'expand-selection-to-scope.expand';
    
    let disposable = vscode.commands.registerTextEditorCommand(cmd_name, (editor) => 
    {
        let document = editor.document;
        editor.selections = editor.selections.map((selection, selectionIdx) => 
        {
            const text = document.getText();

            let offset_l = document.offsetAt(selection.start);
            let offset_r = document.offsetAt(selection.end) - 1;

            // Try expanding selection to outer scope
            if(offset_l > 0 && offset_r < text.length - 1)
            {
                // Try to get surrounding brackets
                const s_l = symbols_l.indexOf(text[offset_l - 1]);
                const s_r = symbols_r.indexOf(text[offset_r + 1]);

                // Verify that both are brackets and match
                const both_brackets = s_l !== -1 && s_r !== -1;
                const equal = s_l === s_r;

                if(both_brackets && equal)
                {
                    // Expand selection
                    return new vscode.Selection(
                        document.positionAt(offset_l - 1), document.positionAt(offset_r + 2));
                }
            }

            // Search matching scopes, first to the left, then to the right
            search_scope(text, offset_l - 1, left, (il, match_l) => 
            {
                search_scope(text, offset_r + 1, right, (ir, match_r) => 
                {
                    if(match_l !== match_r)
                    {
                        show_error_popup2(match_l, match_r);
                        return selection;
                    }

                    // Select everything inside the scope
                    let l_pos = document.positionAt(il + 1);
                    let r_pos = document.positionAt(ir);
                    selection = new vscode.Selection(l_pos, r_pos);
                });
            });

            return selection;
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }