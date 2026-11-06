# skill_game_design.md: Core Loop and Player Experience Rules

## 1. Core principle: player experience comes before ease of building

When the choice is between "more fun for the player" and "easier for us to build," **choose fun**, then look for the cheapest way to deliver it.

- Fewer features, polished, beat many features, rough.
- Prototype with disposable code before committing to real code.
- Get small details right: transitions, alignment, spacing, feedback, error states.
- Every feature must serve the core loop, or at least stay out of its way.

The AI advises and flags problems; **the developer makes the final call.**

## 2. Core loop rules

Before building a new feature, answer:

1. **What is the core loop?** What does the player repeat? (e.g. shoot, collect, upgrade, shoot again.)
2. **How does this feature serve the loop?** If it does not, cut it (YAGNI).
3. **Is the feedback clear?** Does the player know immediately whether they succeeded or failed?

## 3. Feature trade-offs

For each new idea, ask:

- Will it make the game more fun, or do we just want to build it?
- Can it be finished in **one week**? If not, split it or cut it.
- Is there a simpler version? (Instead of a complex inventory, maybe "carry up to 3 items.")
- What does it cost in testing, art, and sound, not only in code?

Use `/cut` to run this scope check on the whole project at any time.

## 4. Two phases, two sets of rules

This resolves the tension between "move fast" and "polish everything."

### [Prototype] phase: is the idea fun?

- Build it rough. Rectangles, placeholder sounds, and paper sketches are fine.
- Prototype code is **disposable**. It does not need to be pretty or optimized, but it must still be readable.
- Test fast and fail fast. If the idea is not fun after a short test, drop it without regret.
- Do **not** spend time on art, menus, or polish.
- Exit condition: you can play one full session of the core loop, and you want to play it again.

### [Polish] phase: make the proven idea feel great

- Now apply the polish checklist (section 5).
- Fix technical debt as you meet it. Rebuild disposable prototype code into clean code before piling features on top.
- Exit condition: a stranger can play a session and enjoy it without explanation.

The AI must state which phase the project is in when planning work. If unsure, ask.

## 5. Polish checklist

- 3 polished features beat 10 rough ones.
- Check every interaction:
  - Does a button react instantly when pressed (color, sound, movement)?
  - Does movement feel smooth?
  - Does the screen load fast enough?
  - Is every error message understandable to a non-technical player?
  - Is there a clear way to pause, restart, and quit?
- Check the "feel" items: screen shake on hits, small particles, sound on every action, short animations on pickups and level-ups.

## 6. Sound and music

Sound is half of game feel and is often forgotten.

- Add a sound effect to every important action (jump, hit, pickup, win, fail, button click).
- Keep SFX short and consistent in volume. Provide a mute button and remember the setting.
- Music should loop without a noticeable gap and never be required to progress (see graceful degradation in `skill_architecture.md`).
- Use only audio you made, generated with a tool whose terms allow game use, or that carries a license permitting your use. Keep a note of the source and license for each file.
- Audio often does not play until the player's first click or tap in a browser. Design the start screen around this.

## 7. Playtesting with real players

- **Play it yourself regularly.** If you are bored, players will be too.
- **Let others try it without explanation.** Watch silently; do not help.
- **Note where players get stuck.** Stuck for more than 30 seconds means redesign.
- Test on the real target device (phone, small laptop), not only your own screen.

### Playtest note template

```
Date / tester:
Device:
Did they understand the goal in 10 seconds?  yes / no
Where did they get stuck or confused?
What made them smile or react?
What did they ask?
When did they want to stop (if at all)?
Top 3 changes to make:
```

## 8. Fun check

Before adding any feature, the AI asks:

1. Does this make the core loop more fun?
2. Will the player understand how to use it within 10 seconds?
3. Is there a simpler way that gets the same result?

## 9. Anti-patterns

- Adding a feature just because other games have it ("they have crafting, so we need crafting").
- Building systems more complex than the game needs (an NPC relationship system that does not affect gameplay).
- Waiting for the game to be "perfect" before releasing. Release a playable version, then improve.
- Using technical words in the player-facing UI.
- Letting the AI or a tutorial dictate the game's direction. Options and advice are welcome; the decision is the developer's.
