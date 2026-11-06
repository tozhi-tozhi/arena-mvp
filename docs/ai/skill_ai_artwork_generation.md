# skill_ai_artwork_generation.md: Asset Production Pipeline (Web-First)
This file covers how to produce, clean, name, and store game assets. For the art style and prompt writing rules, see `skill_visual_direction.md`.

## 1. Core principle: from prompt to engine-ready in a few clicks
- **Zero-install by default.** Use web-based tools instead of software that must be installed (for example, Photopea instead of Photoshop).
- **AI does the heavy lifting, you do light touch-ups.** Generate images that are nearly finished, then tidy them with web tools.
- **Consistency over perfection.** Images do not have to be stunning, but size, angle, and style must match across the whole game.
- **Free first, paid only by approval.** If a paid tool would clearly save significant time, the AI must say so, give the cost, and offer a free alternative. The developer decides.

## 2. Generation workflow
**Step 1: Technical specs**
Decide these before generating anything:
- Frame size: for example 64x64 px for pixel art, 512x512 for HD. Prefer power-of-two or consistent sizes across similar assets.
- Background: always request `plain white background` or a solid color, so it is easy to remove. Avoid green or white if the character contains the same color.
- Camera angle: isometric, side view, or top-down. Keep the same across the entire game.
- Aspect ratio and orientation: match where the asset will appear.

**Step 2: Generate with AI**
- Use the 4-layer prompt from `skill_visual_direction.md`.
- For animation, describe each frame's pose explicitly (Frame 1: left foot forward; Frame 2: both feet together; Frame 3: right foot forward; Frame 4: both feet together). AI image tools often struggle with consistent animation frames, so expect to generate several attempts and choose the best, or draw simple frames by hand in a pixel editor.
- Generate 2 to 4 variations, pick one, and use it as the reference for the rest.

**Step 3: Remove the background and clean up**
- Remove the background: use a web tool such as remove.bg or Adobe Express's background remover (free tiers). Check the current free-tier limits and output resolution before relying on them.
- For pixel art, avoid auto-removal that blurs edges. Prefer a magic-wand or fill-based removal in Photopea or Piskel to keep edges crisp.
- Check edges: zoom in and look for leftover background fringes (halos). Fix them or regenerate.
- Resize correctly: for pixel art, use "nearest neighbor" scaling; smooth scaling blurs the pixels.

**Step 4: Sprite sheets (optional)**
- Use a web tool such as Piskel or Ezgif to combine frames or cut a sheet.
- Key rule: every frame uses the same canvas size with consistent padding, and the character's feet stay at the same position. Otherwise the animation jitters.
- Export as PNG to keep transparency. Note the frame size and frame count in the filename or the Asset Inventory so the code can slice it correctly.

## 3. Color and style consistency
- **Palette lock.** For pixel art, fix the color count (e.g. 16) and use the same palette in every image. Tools like Piskel or Photopea can force an image onto a palette.
- **Outline rule.** If characters have an outline, put it in every prompt (for example, "thick black outline").
- **Light direction.** Light always comes from the same direction (for example, the top left).

## 4. File naming and storage
- Naming pattern: `type_name_action_frame.ext`, in lowercase with underscores, no spaces or Thai characters (they can break file paths on some systems).
- Examples: `char_hero_idle_01.png`, `enemy_slime_attack_02.png`, `bg_forest_layer1.png`, `ui_button_play.png`, `sfx_coin_pickup.ogg`.
- Folder structure:
/assets
/characters
/enemies
/backgrounds
/ui
/audio
/sfx
/music
- Keep a simple `assets_log` (a text file or spreadsheet) listing each asset's file name, the prompt or tool used, the date, and the license or terms of use.

## 5. Formats and file size
- Use PNG for sprites and UI (transparency, sharp edges), JPG or WebP for large photographic backgrounds.
- Keep the total game size small for web play. Compress images (for example with a free web compressor) and avoid unnecessarily large files.
- Test loading on a slow connection or a phone.

## 6. Legal and license notes
- Do not use or modify copyrighted art, characters, or sprites from other games.
- Check each tool's terms before commercial release. Free plans of AI image tools may limit commercial use or require attribution. Record the terms in the assets log.
- Fonts, music, and sound effects have licenses too. Keep a note of each source.
- If you plan to sell the game, re-check the license of every asset before release.

## 7. Verification checklist
Before an asset goes into the game, the AI asks:
- Is the background actually transparent (where needed)?
- Does the size match the plan?
- Does the style match the other assets?
- For animation: do the frames flow smoothly when played in order?
- Is the file named correctly and saved in the right folder?
- Is its source and license recorded?

## 8. Anti-patterns
- Generating images with complex backgrounds that cannot be removed (for example, a wood-grain background that blends with the character).
- Changing canvas size midway (first frame 64x64, second frame 70x60).
- Using copyrighted images from other games as a base.
- Recommending paid or subscription tools without asking.
- Smoothing or blurring pixel art when scaling.
- Naming files "final", "final2", "final_really" instead of using the naming pattern.

## 9. Free web tools (verify current terms before use)
Free plans and limits change often. Treat this list as a starting point, not a promise.

| Purpose | Examples |
| --- | --- |
| Generate images | Bing Image Creator, Leonardo.ai (free tier), Stable Diffusion online services |
| Remove backgrounds | remove.bg, Adobe Express background remover |
| Edit and combine | Photopea (browser-based image editor), Piskel (pixel art editor) |
| Convert and slice | Ezgif, CloudConvert |
| Compress | Squoosh, TinyPNG |

## 10. AI Sprite Sheet Consistency (Lessons Learned from Gray Gig)
AI image generators struggle with consistent multi-frame sprites when prompted separately. Use this proven workflow instead:

### Rule: One Image, Multiple Frames
- **Never generate animation frames as separate images.** AI cannot maintain identical proportions, outlines, and palette across multiple generations.
- **Always prompt for a horizontal sprite sheet in a single image.** Describe each frame's pose explicitly within the same prompt.
- **Use square aspect ratio (`--ar 1:1`)** rather than wide ratios. Wide ratios cause AI to compress or distort individual frames. Square gives you full canvas height per frame.

### Prompt Template for Consistent Sheets
16-bit pixel art sprite sheet, [N] frames arranged horizontally on plain white background.
Frame 1: [pose description]. Frame 2: [pose description]. Frame 3: [pose description].
All frames must have EXACTLY same height and width, consistent character proportions,
thick black outline, limited [N]-color palette ([list colors]).
NO grid lines, NO borders, NO boxes between frames. Pure white background only.
Clean pixel edges, no text, no watermark. Game sprite sheet format. --ar 1:1

### Critical Pose Descriptions
Do not use vague terms like "walking." Specify body parts:
- ✅ "LEFT leg planted firmly, RIGHT leg lifted behind body"
- ❌ "Walking pose"
- ✅ "Both legs spread wide, LEFT foot forward touching ground, RIGHT heel raised high"
- ❌ "Mid-stride walking"

### Post-Processing Workflow (Web-First)
1. Import into **Piskel** (https://www.piskelapp.com) → Select "Import as spritesheet"
2. Set Frame size = Total Width ÷ N frames (e.g., 1024px ÷ 4 = 256px width)
3. Verify alignment visually before cutting
4. Export as "One file per frame" → PNG with transparency
5. Remove background using Magic Wand in Piskel/Photopea (NOT auto-remove tools that blur pixel edges)

### Anti-Patterns (From Experience)
| Mistake | Why It Fails | Fix |
| --- | --- | --- |
| Generating 4 separate images | Proportions change every time | Single sheet, one prompt |
| Using --ar 4:1 for sheets | AI squishes frames together | Use --ar 1:1, crop later |
| Asking AI for "grid lines" | Lines become part of artwork | Cut by pixel math in Piskel |
| Auto background removal | Blurs pixel art edges | Magic Wand / manual cutout |
| Vague pose descriptions | AI guesses inconsistently | Specify limb positions exactly |
| CSS art for main scenes | Looks flat and unprofessional | Use AI-generated pixel art |

## 11. Parallax Without Engine (Lessons Learned from Gray Gig)
You can create depth in 2D scenes without a game engine or complex libraries.

### The 3-Layer Technique
1. **Layer 1 (Back):** Wall + window (moves slowest)
2. **Layer 2 (Middle):** Furniture + character (medium speed)
3. **Layer 3 (Front):** Foreground objects like table edges (moves fastest)

### Implementation (CSS + Mouse Move)
```css
/* Example: parallax on mouse move */
.parallax-container {
  position: relative;
  overflow: hidden;
}
.parallax-layer {
  position: absolute;
  transition: transform 0.1s ease-out;
}
// Simple mouse parallax
container.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 2;
  const y = (e.clientY / window.innerHeight - 0.5) * 2;
  
  layer1.style.transform = `translate(${x * 5}px, ${y * 5}px)`;
  layer2.style.transform = `translate(${x * 10}px, ${y * 10}px)`;
  layer3.style.transform = `translate(${x * 15}px, ${y * 15}px)`;
});
When to Use
✅ HomeScreen room scene
✅ Event cutscenes
✅ Any scene where the player "stands in" a location
❌ Don't overuse — parallax on every screen feels gimmicky
Asset Preparation
Cut your background image into 3 separate PNG files (layer1, layer2, layer3)
Character PNG goes between layer2 and layer3
Each layer should be slightly larger than the viewport to allow movement without showing edges

---

## 2. `ai/master_prompt.md` (ส่วน 8-9 ที่อัปเดต)

```markdown
8. Decision Log
| Date | Decision | Reason | Impact |
| --- | --- | --- | --- |
| 2026-11-04 | React + Vite + Zustand | เบา, state management ดี | โค้ดแยกส่วนชัดเจน |
| 2026-11-04 | FSM เปลี่ยนหน้าจอ | ป้องกันบั๊กข้ามจอ | fsm.ts บังคับทิศทาง |
| 2026-11-04 | Repomix แพ็คโค้ดส่ง AI | AI เห็นทั้งโปรเจกต์ | ใส่ .gitignore |
| 2026-11-05 | Gig Outcome Roulette | ความไม่แน่นอน | 5 แบบ, weight ตาม risk |
| 2026-11-05 | ระบบหนี้ + Joe | เส้นตายมีพลวัต | DebtState + mood |
| 2026-11-05 | QTE+RNG แนวทาง B | ฝีมือมีผล | rollGigOutcome รับ score |
| 2026-11-05 | Visual Feedback + QTE | ยกระดับ game feel | shake/flash/beep |
| 2026-11-05 | ไม่ทำ Push-your-luck | QTE พอแล้ว | ตัดออก |
| 2026-11-05 | Countdown Event | กดดันเวลา | timeLimit + timeout |
| 2026-11-05 | Gig Board ไม่ reroll | ปิดช่องโหว่ | dailyGigIds ใน store |
| 2026-11-05 | Heat 100 = แพ้ | Heat มีน้ำหนักจริง | ตัวเตือนก่อนรับงาน |
| 2026-11-05 | Story + Epilogue | ตัวเลือกมีผลยาว | flags + 7 เรื่อง + epilogue |
| 2026-11-05 | สไตล์ภาพ: pixel art ทั้งเกม | 5 gig bg เป็น pixel แล้ว, consistency > flat card | Joe+Room ต้องเป็น pixel |
| 2026-11-05 | สมดุลทดสอบแล้ว OK | session นี้ | ตัวเลขปัจจุบันใช้ได้ |
| 2026-11-05 | HomeScreen ผิด — Joe อยู่ในห้องเรา | ไม่เมคเซนส์, Joe ควรอยู่ Event เท่านั้น | ต้อง redesign HomeScreen |
| 2026-11-05 | ลำดับทำผิด — ทำ cutscene ก่อนมีบ้าน | ควรทำ Player+Room ก่อน | ตั้งแผน 5 phase ใหม่ |
| 2026-11-05 | รื้อ Joe+Room ใหม่ | 风格 clash, ลำดับผิด | เก็บ 5 gig bg, รื้อแค่ Joe+Room |
| 2026-11-05 | HomeScreen minimal + visual-first | UI เดิมรก, text เยอะเกินไป | ใช้ icon + progress bar แทนคำบรรยาย |
| 2026-11-05 | เพิ่ม GigResultScreen | ผู้เล่นไม่เห็นผลลัพธ์งาน | หลังจบงานต้องเห็นสรุปแบบเต็มจอก่อนกลับ home |
| 2026-11-05 | แก้ gigSystem.ts → gigResult | activeGig ไป home ทันที ทำให้ไม่เห็นสรุป | เปลี่ยนปลายทางเป็น gigResult, เก็บ event ใน pendingEvent |
| 2026-11-05 | เลือก Player Identity แบบ B (เห็นหน้า) | ไม่เอาเงาดำ ไม่เอา first-person | ต้องเจนรูปตัวละครเต็มตัว ยืนในห้อง |
| 2026-11-05 | ใช้ AI Gen รูปแทน CSS Art | CSS Art ดูง่อย ไม่สวยเท่า Pixel Art จริง | ต้องใช้ Prompt เจนรูปห้องและตัวละคร แล้วไดคัทใส่เกม |
| 2026-11-05 | Parallax 3 ชั้น (จะทำ) | ฉากมีมิติ ไม่ใช่ภาพแบนๆ | รอ asset เสร็จก่อน: room layer1 + player + room layer2 |
| 2026-11-05 | Web-First Asset Pipeline | ผู้ใช้ไม่มีความรู้กราฟิก | เจนด้วย Bing/Leonardo → ไดคัทด้วย Photopea → วางโค้ด |
| 2026-11-05 | AI Sprite Sheet = One Image Multi-Frame + Piskel Cut | Separate gen fails consistency; square AR beats wide AR | skill_ai_artwork_generation.md §10 |
| 2026-11-05 | Parallax Without Engine | Depth without heavy libraries | CSS + mouse move, 3-layer technique |

9. Style Guide
| Item | Value |
| --- | --- |
| Palette (hex codes) | UI: Dark theme (Emerald/Green + Neutral Dark) / ภาพ: pixel art 12-16 สี [รอล็อก hex กลาง] |
| Art style | Pixel art ทั้งเกม — Joe, Room, Event, Walker, Player ทุกอย่างเป็น pixel เพื่อ consistency กับ 5 gig bg ที่มีแล้ว |
| Camera angle | Side view สำหรับฉากห้องและตัวละคร, 2D UI แนวตั้ง 9:16 |
| Font | Noto Sans Thai |
| Mood keywords | Dark, Gritty, Slightly humorous, Cyberpunk-tech (UI) |
| Tool | Qwen (credit หมด), Bing Image Creator / Leonardo.ai (ฟรี 100%, ได้ JPG/PNG) |
| Do-not-use list | Flat card style (风格 clash กับ pixel), JFIF format, gradients ในภาพ, CSS Art สำหรับฉากหลัก (ใช้เฉพาะ UI และ micro-animations) |
| Asset Pipeline | Web-First: เจนรูป → ไดคัท (Photopea/remove.bg) → ตั้งชื่อตาม pattern → วางใน /public/assets/ |
| Sprite Sheet Rule | One image, multiple frames, square AR, no grid lines, Piskel for cutting |
| Parallax Rule | 3-layer technique for depth, CSS + mouse move, no heavy libraries |

5 gig backgrounds ที่มีแล้ว — เป็น anchor ของ风格ทั้งเกม:
`gig_alley.png` (Tier 1), `gig_market.png` (Tier 2), `gig_warehouse.png` (Tier 3), `gig_rooftop.png` (Tier 4), `gig_dock.png` (Tier 5)