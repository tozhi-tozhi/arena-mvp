# skill_visual_direction.md: Art Direction and AI Image Prompting

This file covers **what the game should look like** and **how to write image prompts**. For producing, cleaning, naming, and storing the files, see `skill_ai_artwork_generation.md`.

## 1. Core principle: consistency beats one-off beauty

- **Consistency is king.** Every image must look like it belongs to the same world. No style drift (for example, a pixel-art character on a watercolor background).
- **The prompt is the DNA.** Keep the prompt structure fixed. Change only the **Subject**; keep Style, Lighting, Camera, and Technical parameters identical.
- **Make less, make it clean.** Create only the assets the core loop needs first (main character, basic enemy, main background). Do not make items you do not yet use.

## 2. Create the Style Guide first

Before generating any final art, fix these in the Style Guide section of `master_prompt.md`:

| Item | Example |
|---|---|
| Art style | 16-bit pixel art |
| Camera angle | Side view |
| Palette | 16 colors, hex codes listed |
| Outline | Thick black outline, or none |
| Light direction | From the top left |
| Mood keywords | Cozy, warm, slightly humorous |
| Do-not-use list | Realistic textures, gradients, text in images |

Generate 3 to 5 test images, choose the direction **together**, and only then lock it. Record the choice in the Decision Log.

## 3. The 4-Layer Prompt Framework

Every image prompt contains all four layers.

1. **Subject:** be specific. "A warrior holding a two-handed sword in a ready stance," not "a cool warrior."
2. **Style and medium:** name the technique. "16-bit pixel art," "low-poly 3D render," "flat vector illustration."
3. **Lighting and composition:** "soft light from the top left, side view, centered, plain white background." A plain background is essential for cutting out the subject.
4. **Technical parameters:** aspect ratio (e.g. `--ar 1:1`, `--ar 16:9`), size, quality tags (`highly detailed, clean edges`).

Parameter syntax differs by tool (`--ar` works in Midjourney; other tools use a dropdown or words like "square"). Use whatever the chosen tool expects.

### Template

```
[SUBJECT], [STYLE + MEDIUM], [LIGHT DIRECTION + CAMERA ANGLE],
plain white background, [PALETTE], [OUTLINE RULE], [ASPECT RATIO / SIZE]
Negative: blurry, noisy, deformed, extra limbs, watermark, text, background clutter
```

## 4. Consistency rules

- **Reference image.** Once you have a character you like, use that image as a reference (image-to-image or "style reference") for every other pose and variant.
- **Negative prompt.** Always include one (for example: ugly, deformed, noisy, blurry, extra limbs, watermark, text). Tools without a negative field should phrase it as "no ..." in the main prompt.
- **Palette lock.** Name the main colors with hex codes and require them in every image.
- **Fix at the right layer.** If the result is wrong, change the Style or Lighting layer. Do not re-roll with a completely new prompt.
- **Same structure, same seed.** Where the tool supports a seed value, reuse it for related images.

## 5. AI art workflow

1. **State the need:** what the asset is, where it is used in the game, and what size it must be.
2. **AI proposes 2 to 3 prompt options,** each with a sentence explaining how its feel differs.
3. **Test and adjust,** changing one layer at a time.
4. **Post-processing:** the AI always explains the next step, such as removing the background or building a sprite sheet (see `skill_ai_artwork_generation.md`).
5. **Log the winning prompt** next to the asset in the Asset Inventory, so future images can reuse it exactly.

## 6. Failure patterns

- **Vague prompts** ("pretty," "cool," "like a famous game"). The AI will guess. Describe concrete visual features instead.
- **Forgetting the background.** Always request `plain white background` or a solid color for sprites.
- **Switching style midway.** Re-rolling the whole prompt gives something that looks like a different game.
- **Wrong aspect ratio.** Check the ratio before generating, for example a vertical image for a horizontal UI.
- **Copying existing games, characters, or named living artists' styles for commercial work.** Describe the look in your own terms (shapes, colors, era, medium) instead of naming a protected character or a specific living artist.

## 7. Quality check

Before using an image, ask:

1. Does it match the Style Guide?
2. Can the background be removed, or can it be animated, without losing quality?
3. Are its size and proportions right for where it goes in the game?
4. Is it clearly readable at the smallest size it will be shown?
5. Does it look at home next to the other assets?
