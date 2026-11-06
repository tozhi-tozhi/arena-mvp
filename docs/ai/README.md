# Solo Dev Game Skill Pack: Index

A set of instruction files for building a game with AI as your main tool (100% vibe coding). Give the AI the **master prompt** at the start of every project, then attach the skill files that match the task.

## Which file to use, and when

| Task | Attach this file |
|---|---|
| Starting a project, brainstorming, updating status | `master_prompt.md` (always) |
| Starting a new chat or resuming after a break | `skill_session_manager.md` |
| Writing or fixing code | `skill_vibe_coding.md` |
| Choosing tools, structure, hosting, saving data | `skill_architecture.md` |
| Deciding what to build, balancing, polishing, playtesting | `skill_game_design.md` |
| Defining the look of the game, writing image prompts | `skill_visual_direction.md` |
| Producing, cleaning, naming, and storing image assets | `skill_ai_artwork_generation.md` |

## Precedence (when two files seem to disagree)

1. **Your latest explicit instruction** in the chat wins over everything.
2. `master_prompt.md` (your vision, decisions, and Decision Log) wins over any skill file.
3. Among skill files, the more specific one wins: asset questions go to `skill_ai_artwork_generation.md`, art style questions go to `skill_visual_direction.md`, and so on.
4. Rules marked **[Prototype]** or **[Polish]** apply only in that project phase (see `skill_game_design.md`, section 4).

## Standard shape of every coding answer

1. **Plan** in 2 to 4 plain sentences.
2. **Code** that can be copy-pasted and run as is.
3. **How to test** it in the browser, step by step.
4. **Where to edit** common things (colors, sizes, speeds).
5. **Next step**, offered as a suggestion for you to approve.

## File conventions

- All files are Markdown (`.md`).
- Placeholders in `[square brackets]` are for you to fill in.
- Review this pack whenever a tool or free plan mentioned in it changes.
