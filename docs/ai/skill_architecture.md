# skill_architecture.md: Structure Rules for a Solo Dev (YAGNI)

## 1. Core principle: build only what is needed now (YAGNI)

- **Do not design for a million players.** Design for one player (you) having a smooth experience. Add complexity only when a real problem demands it.
- **Local-first.** The game should play and save progress in the player's own browser (LocalStorage or IndexedDB) with no outside server, unless there is a clear need.
- **Free and web-based.** Choose tools that host for free (GitHub Pages, Netlify, Vercel, itch.io) and run in the browser immediately.

## 2. Clarify before building

Before writing code for any new feature, the AI must ask or confirm these three things:

1. What problem does this feature solve for the game?
2. How will it affect the existing code?
3. Is there a **simpler** way? If so, choose the simplest.

If I cannot answer question 1, the default decision is to **not build it yet**.

## 3. Graceful degradation: the game must not crash

Real systems fail. A game should keep running anyway.

| Failure | Required behavior |
|---|---|
| An image does not load | Draw a colored rectangle instead and carry on |
| Audio cannot play (including browsers that block audio until the first click) | Skip the sound silently; never wait for it |
| Saving fails (storage full, private browsing) | Tell the player politely and retry; keep the game running |
| Saved data is missing or damaged | Start with default values; never crash on load |
| A setting or number is invalid | Fall back to a safe default |

## 4. Saving data safely

- Keep the saved data in **one object** with a `version` number, so later changes to the game do not break old saves.
- Save at natural moments (end of a level, on pause), not every frame.
- Provide a "reset save" button for testing.
- Remember: LocalStorage belongs to one browser on one device. Players who switch devices lose progress. This is acceptable in early phases; mention it to players if it matters.

## 5. Choosing tools (building blocks)

Never pick a tool just because it is "modern" or "industry standard."

- **Engine or framework:** start with plain HTML and JavaScript Canvas, or the simplest engine that fits the genre. Ask for a recommendation, explain why, and record it in the Decision Log.
- **Data and saving:** start with a JSON object in LocalStorage. If online features become necessary, consider Firebase or Supabase (free tiers) and re-read their current free-tier limits first.
- **State:** use plain variables or the simplest state mechanism the engine offers. Do not build elaborate state systems for a small game.
- **Project structure:** begin with few files. Split a file only when it is hard to navigate.

## 6. Iterate and adapt

- If the code becomes hard to understand or fix, **stop and refactor** before adding more. Complexity compounds.
- Changing your mind is normal. If an approach is not working, delete it and restart with a simpler one.
- Record the change in the Decision Log so the reason is not lost.

## 7. Multiplayer: the later, optional layer

When (and only when) single-player is complete and fun:

1. Start with local co-op on one device if the genre allows it.
2. For online play, use room-based sessions: create or join a room, play, room closes.
3. Give every piece of state one clear owner; the host or server decides on conflicts.
4. Use a free-tier service first and test with two browser windows before involving real players.
5. Expect cheating, disconnects, and lag. Decide up front what happens when a player drops out.

## 8. Anti-patterns

- Adding multiplayer, login, or a complex backend before the core game is fun to play from start to finish.
- Using architecture jargon (microservices, sharding, Kafka) in a small project.
- Building systems "we might need later" (speculative abstraction).
- Picking a heavy engine because a famous game used it.
- Storing anything sensitive (passwords, personal data) without a real security plan.
