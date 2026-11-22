#!/usr/bin/env node
// UserPromptSubmit: read what the user says so the desk keeps itself in order.
//  - journal every prompt (.desk/.journal.jsonl, git-ignored) for the end-of-session retro;
//  - bump × / @ on desk items the user refers to (that is how importance is learned);
//  - when the prompt is a correction, an urgency, a "remember", or an approval, tell the agent what to file where.
// Kit-managed: do not edit.
import fs from 'node:fs';
import path from 'node:path';
import { readStdinJson, projectDir, emitContext, readState, detectSignals, bumpMatches, journal, listReview, parseItems, read, DESK, ZONES } from './_lib.mjs';

const input = await readStdinJson();
const root = projectDir(input);
if (!fs.existsSync(path.join(root, DESK))) process.exit(0);
const prompt = String(input.prompt ?? '');
if (!prompt.trim() || prompt.trim().startsWith('/')) process.exit(0);

const state = readState(root);
const signals = detectSignals(prompt);
const bumped = bumpMatches(root, { text: prompt });
journal(root, { s: state.session, signals, bumped, text: prompt.slice(0, 1000) });

const now = parseItems(read(path.join(root, DESK, ZONES.now))).items[0];
const hints = [];
if (signals.includes('correction'))
  hints.push('This reads as a correction. Fix it first; then record the lesson in notebook.md (bump × if the same lesson exists).');
if (signals.includes('remember'))
  hints.push('The user wants this kept: a fact/decision → memory.md (above the line); a way of working → draft a proposal and ask in one sentence.');
if (signals.includes('urgent'))
  hints.push(now ? `Urgent. If this is not ${now.id}, put it at the top of queue.md as P0/P1; switch now only if the user means "now".` : 'Urgent → make it the task in now.md.');
const pending = listReview(root).filter((r) => !r.archived && r.kind === 'P' && r.status === 'pending');
if (signals.includes('approve') && pending.length)
  hints.push(`If this approves ${pending.map((p) => p.id).join(' / ')}, set "- Status: approved" and quote the user's words under it, then apply.`);
if (!now && !signals.includes('correction')) hints.push('No task in now.md: if this is a work request, write it there with a done-check before starting.');
if (bumped.length) hints.push(`Related desk items: ${bumped.join(', ')} — read them before acting.`);

if (hints.length) emitContext('UserPromptSubmit', `[desk] ${hints.join(' ')}`);
