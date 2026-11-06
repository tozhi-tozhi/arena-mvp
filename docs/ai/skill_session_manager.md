# skill_session_manager.md: Session and Context Management

## 1. Core idea: the AI must always know where we are

- **Stateless by design.** The AI does not reliably remember earlier chats. These files and your Session Context are its external memory.
- **Single source of truth.** `master_prompt.md` and the skill files outrank the AI's memory of earlier conversations. If the AI contradicts them, point it back to the files.
- **Update before acting.** Refresh the Session Context before starting any new piece of work.

## 2. Session Context block

Paste this at the very top of the first message in every new chat, and after any long break.

```markdown
Current state:      [e.g. Phase 1, Core Gameplay]
Done and working:   [features that run without errors]
In progress:        [what is being built or fixed right now]
Blockers:           [bugs or open questions that are stuck]
Goal of this chat:  [what I want finished in this session]
Recent decisions:   [last 3 entries from the Decision Log]
```

### Filled-in example

```markdown
Current state:      Phase 1, Core Gameplay
Done and working:   Player moves with arrow keys; one enemy spawns every 3 seconds
In progress:        Player shooting (bullet appears but does not hit the enemy)
Blockers:           Bullet passes through the enemy; hit detection not working
Goal of this chat:  Make bullets destroy the enemy and add a score counter
Recent decisions:   2026-11-04: use plain Canvas, no engine (simpler to understand)
```

## 3. Decision Log

Every decision that would be painful to rediscover goes into the Decision Log in `master_prompt.md`.

Log a decision when it:
- picks a tool, engine, or hosting service;
- adds, cuts, or changes a feature;
- sets art style, palette, or camera angle;
- changes the scope or the plan.

Each entry has four parts: **date, decision, reason, impact.** The AI should offer to write the entry whenever a decision is made, using `/decide`.

## 4. Session routine

**Start of a session**
1. Paste `master_prompt.md` and the relevant skill files.
2. Paste the Session Context block.
3. State the goal in one sentence.

**During a session**
- Stay on the stated goal. If a new idea appears, write it on a "Later" list instead of building it now.
- After each working feature, save a version (see `/backup`).

**End of a session** (ask the AI: `/status`)
1. The AI rewrites the Session Context with the new state.
2. The AI lists any new Decision Log entries.
3. The AI suggests the first task for next time.
4. You copy these into your master prompt file and save it.

## 5. Handling long chats

When a conversation gets long, the AI may start forgetting earlier rules or repeating mistakes.

Signs:
- It ignores the explanation level or a rule from the master prompt.
- It re-suggests something you already rejected.
- It rewrites code you did not ask it to touch.

What to do: run `/status`, then start a **new chat** with the updated master prompt and Session Context.

## 6. Anti-patterns

- Do not rely on "you said so earlier". If it matters, it belongs in a file.
- Do not start a new chat without the Session Context.
- Do not let the AI quietly change a decision. Any change goes through `/decide`.
- Do not skip the end-of-session `/status`. It is what makes the next session fast.
