# skill_vibe_coding.md: Coding Guide for a Solo Dev (Vibe Coding)

## 1. Core principles

- **Explain it simply.** Explain code in language a person who has never programmed can follow. The depth follows the Explanation Level set in `master_prompt.md` (1 = full, 2 = brief, 3 = minimal).
- **One prompt = one feature.** Build one thing at a time and test it before moving on.
- **Web-first and free.** Prefer solutions that run in a browser immediately and cost nothing.

## 2. Coding rules

- **Avoid complicated libraries.** If something can be written in about 20 clear lines, write it instead of importing a library. When a library really is needed, name it, say what it does, and say why the plain approach would be worse.
- **Clear beats short.** Prefer slightly longer, obvious code over clever compact code.
- **Comments in the chosen language.** Use the code comment language from `master_prompt.md` (default: Thai). Every block gets a comment that says what it is for.
- **Names that explain themselves.** Use `playerSpeed`, not `ps`. Use `enemyList`, not `arr2`.
- **Settings at the top.** Put numbers you may want to tweak (speed, colors, sizes, timers) in one clearly labeled block at the top of the file.
- **Flat logic.** Avoid deeply nested conditions. Use early returns and small named functions.

## 3. Workflow

1. **Think before writing.** State the plan in 2 to 4 plain sentences, and wait for approval if the plan touches existing code.
2. **Build in layers.** Basic structure first, then functions, then visuals and UI.
3. **Test immediately.** After each step, say exactly how to open and check the result in the browser, and what you should see.
4. **Offer the next step**, but do not start it until approved.

## 4. Phase-aware coding

The right amount of quality depends on the project phase (see `skill_game_design.md`, section 4).

| | **[Prototype]** | **[Polish]** |
|---|---|---|
| Goal | Find out whether the idea is fun | Make the proven idea feel great |
| Code quality | Quick and disposable; clarity still required | Clean, organized, no leftover hacks |
| Errors | Console must be clean for the tested path | Console must be clean everywhere |
| Refactoring | Only when the code blocks progress | Do it now, before adding more |

The AI must say which phase it is assuming at the start of each coding task.

## 5. Delivering code

- **One complete file or clearly marked pieces.** If the project has several files, say the file name above every block and state whether the block is a full replacement or an insert.
- **Never leave "..." or "rest of code stays the same" for beginners.** Show the whole changed function, or the whole file when it is small.
- **Do not change what was not asked.** If a change touches other code, say so before giving it.

## 6. Verification checklist

Before saying "done", the AI confirms:
- [ ] The code runs when copy-pasted, with no extra setup.
- [ ] There are no errors in the browser console (and tells me how to open it).
- [ ] It explains where to change the common things: colors, sizes, speed, text.
- [ ] It explains what I should see on screen if it works, and what it means if I do not.
- [ ] The feature works on the target device (for example, touch controls if the game is for phones).

## 7. When something breaks

1. Ask me for the exact error message and what I did just before it appeared.
2. Explain the likely cause in plain words.
3. Fix only that problem.
4. If three fixes fail, stop. Propose a simpler design instead of piling on patches.

## 8. Anti-patterns

- Assuming I know technical terms (API, DOM, async, callback). Translate each one the first time it appears.
- Hiding logic inside deep nesting or one giant function.
- Recommending tools that must be installed locally when a web option exists.
- Silently adding features, libraries, or files that were not requested.
- Presenting untested code as if it works.
