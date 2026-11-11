# skill_effect_integration.md: External VFX Integration (PixelFX → Arena MVP)

Skill นี้ใช้เมื่อ Developer ต้องการนำเอฟเฟกต์จากคลังภายนอก โดยเฉพาะ **Patch PixelFX** มาใช้ในเกม Arena MVP เช่น เอฟเฟกต์โจมตี เวทมนตร์ ระเบิด การเกิด/ตาย การเก็บของ และเอฟเฟกต์ประกอบ UI

เป้าหมายคือ **ค้นหาเอฟเฟกต์ที่มีอยู่แล้ว → ดูตัวอย่างจริง → เลือกให้เข้ากับเกม → เชื่อมเข้ากับ Phaser อย่างปลอดภัย** ไม่ใช่คัดลอกโค้ดจำนวนมากเข้ามาโดยไม่ตรวจสอบ

---

## 1. Project context: อ่านของจริงก่อนเสมอ

ค่าต่อไปนี้เป็นข้อมูลจากโปรเจกต์ Arena MVP ที่ตรวจพบในปัจจุบัน แต่ต้องตรวจไฟล์จริงอีกครั้งก่อนแก้โค้ดทุกครั้ง เพราะโปรเจกต์อาจเปลี่ยนหลังจาก Skill นี้ถูกเขียน

- Engine: **Phaser 4.2.1** ตาม `package.json` ปัจจุบัน
- Language / build: TypeScript + Vite, ใช้ ES Modules (`"type": "module"`)
- Game viewport: `800 × 600` จาก `src/config.ts`
- Render setting: `pixelArt: true` ใน `src/main.ts`
- Draw order: ใช้ค่า `DEPTH` กลางจาก `src/config.ts`
- จุดที่มีระบบเอฟเฟกต์เดิม:
  - `src/systems/effects.ts` — เอฟเฟกต์ทั่วไป เช่น damage popup, burst, slash, thrust, afterimage, vignette และ ring
  - `src/systems/combatFx.ts` — เอฟเฟกต์ต่อสู้ เช่น `spawnArcSlash()`
  - `src/scenes/GameScene.ts` — จุดเรียกเอฟเฟกต์ระหว่าง gameplay

**ข้อควรระวังเรื่องเวอร์ชัน:** เอกสารเก่าบางส่วนใน `master_prompt.md` ระบุ Phaser 3 แต่ `package.json` ปัจจุบันระบุ Phaser 4.2.1 ให้ยึด `package.json`, lockfile และ API ที่ติดตั้งจริงเป็นหลัก ห้าม downgrade หรือเขียนโค้ดตาม tutorial ของ Phaser 3 โดยไม่ตรวจ compatibility

**ข้อควรระวังเรื่อง Art Direction:** เกมมีทิศทางภาพตัวละครแบบ 3D Claymation / Soft Plasticine แต่ PixelFX เป็นเอฟเฟกต์ Pixel Art ซึ่งอาจดูไม่เข้ากัน ให้ดูภาพจริงและทดสอบในฉากเกมก่อนเลือกใช้ ห้ามนำเข้ามาเพียงเพราะเอฟเฟกต์สวย หากสไตล์ขัดกัน ให้เสนอทางเลือก เช่น ใช้เฉพาะเอฟเฟกต์ที่เป็นแสง/ประกายขนาดเล็ก ปรับสีและขนาด หรือไม่ใช้เอฟเฟกต์นั้น

---

## 2. กฎหลักที่ห้ามละเมิด

1. **เอฟเฟกต์เป็นงานภาพเท่านั้น** ห้ามเปลี่ยน damage, hitbox, collision, attack range, cooldown, invincibility, movement, boss AI, loot หรือ gameplay state เพียงเพื่อให้เอฟเฟกต์ทำงาน
2. **ห้ามแทนที่ระบบเดิมแบบเหมาเข่ง** ต้องตรวจ `effects.ts`, `combatFx.ts` และจุดเรียกใช้ใน `GameScene.ts` ก่อนเสมอ ถ้าของเดิมทำงานอยู่แล้ว ให้เพิ่มเฉพาะสิ่งที่ขาด
3. **เริ่มทีละ 1 เอฟเฟกต์** ทำ prototype และทดสอบให้ผ่านก่อนนำเอฟเฟกต์อื่นเข้ามา ห้าม import ทั้ง 244 เอฟเฟกต์หรือทั้งหมวดโดยไม่มีเหตุผล
4. **ห้ามเพิ่ม dependency โดยไม่จำเป็น** โดยเฉพาะห้ามสั่ง `npm install pixelfx` โดยอัตโนมัติ ต้องตรวจสอบก่อนว่าแพ็กเกจมีอยู่จริง เวอร์ชันตรงกับ source ที่ใช้ และ export path ใช้งานได้
5. **ห้ามเปลี่ยน Phaser version, Vite, TypeScript หรือโครงสร้างโปรเจกต์** เพื่อให้เข้ากับไลบรารี หากมี incompatibility ให้หาวิธี adapter หรือ export asset ก่อน
6. **อย่าให้ภาพเอฟเฟกต์ทำหน้าที่แทน gameplay logic** เอฟเฟกต์แสดงภาพตอนโจมตีเท่านั้น ระบบคำนวณการโดนและสร้างความเสียหายยังเป็นของเกม
7. **ต้องมี fallback** หาก texture/animation โหลดไม่สำเร็จ เกมต้องยังเล่นได้ ไม่ crash และไม่ค้างรอเอฟเฟกต์
8. **ตรวจ license และที่มา** ก่อนนำไฟล์หรือโค้ดเข้าโปรเจกต์ โดยเฉพาะก่อนเผยแพร่หรือขายเกม

---

## 3. Workflow: ค้นหาก่อนสร้าง

เมื่อได้รับคำขอ เช่น “เพิ่มเอฟเฟกต์ระเบิด”, “ทำให้ท่าชาร์จดูอลังการขึ้น” หรือ “เพิ่มประกายตอนเก็บของ” ให้ทำตามลำดับนี้

### Step 1 — ระบุหน้าที่ของเอฟเฟกต์

สรุปให้ได้ว่าเอฟเฟกต์จะใช้ในเหตุการณ์ใด เช่น

- โจมตีโดนศัตรู / Critical Hit
- ชาร์จพลัง / ปล่อยสกิล
- กระแทกพื้น / Shockwave
- ยิงกระสุน / Projectile trail
- บอสเกิด / บอสตาย / เปลี่ยน Phase
- เก็บ Loot / เก็บ Resource / Heal
- สถานะติดตัว เช่น Burn, Freeze, Poison

ถ้าคำขอยังไม่ชัด ให้ถามเฉพาะรายละเอียดที่จำเป็นต่อภาพหรือจังหวะ ไม่ถามข้อมูลเชิงเทคนิคที่ AI ตรวจจากโค้ดหรือ metadata ได้เอง

### Step 2 — ตรวจระบบเดิมก่อน

ค้นหาใน `src/systems/effects.ts`, `src/systems/combatFx.ts` และ `src/scenes/GameScene.ts` ว่ามีฟังก์ชันหรือจุดเรียกใช้ที่ทำหน้าที่เดียวกันอยู่แล้วหรือไม่

- ถ้ามีอยู่แล้ว: พิจารณาปรับของเดิม หรือแทนเฉพาะภาพที่จำเป็น โดยคงชื่อฟังก์ชันและ contract เดิมให้มากที่สุด
- ถ้ายังไม่มี: เสนอเพิ่มฟังก์ชันใหม่ผ่าน wrapper กลาง แทนการเรียกใช้ไลบรารีกระจัดกระจายจากหลาย Scene
- ห้ามลบฟังก์ชันเดิมจนกว่าจะตรวจทุกจุดที่ import และเรียกใช้

### Step 3 — ค้นหาใน PixelFX

ใช้ repository ของ PixelFX เป็นแหล่งค้นหา โดยตรวจว่ามีโฟลเดอร์ `tools/` และ `docs/CATALOG.md` อยู่จริงก่อนรันคำสั่ง

```bash
node -v
node tools/list.mjs slash
node tools/list.mjs explosion
node tools/list.mjs fire
```

`node tools/list.mjs <คำค้น>` ใช้ค้นจาก ID, ชื่อ, tags และคำอธิบาย ส่วน `docs/CATALOG.md` ใช้ดูรายการตามหมวดหมู่

เลือกตัวเลือกเพียง 2–3 รายการที่ตรงกับหน้าที่ของเอฟเฟกต์ จากนั้นเปิดดู source และ metadata ของแต่ละตัว ห้ามเลือกจากชื่ออย่างเดียว

### Step 4 — Render และดูภาพจริง

สร้างภาพตัวอย่างก่อนนำเข้าเกม

```bash
node tools/render.mjs <category>/<effect-name> --zoom 3
```

คำสั่งนี้สร้างภาพ preview/contact sheet ไว้ใน `records/` ตามรูปแบบของ PixelFX ให้เปิดภาพที่สร้างได้จริงและตรวจดูเฟรม ไม่ใช่สรุปว่า “ดูแล้ว” จากชื่อไฟล์หรือคำบรรยายเท่านั้น

สิ่งที่ต้องประเมิน:

- ภาพอ่านออกในขนาดที่เกมแสดงจริงหรือไม่
- สไตล์ Pixel Art เข้ากับตัวละคร Claymation และฉากหรือไม่
- จุดกำเนิดของเอฟเฟกต์สัมพันธ์กับเท้า มือ อาวุธ หรือจุดกระทบหรือไม่
- สีสว่างเกินไป กลืนกับฉาก หรือบังตัวละคร/HUD หรือไม่
- เป็น one-shot หรือ loop และใช้เวลานานเท่าใด
- หากเป็น effect ที่มีตัวละคร ตัวละครตัวอย่างในไลบรารีติดมาด้วยหรือไม่

ถ้าไม่สามารถ render หรือเปิดดูภาพได้ ให้แจ้งข้อจำกัดตามจริง ห้ามอ้างว่าได้ตรวจภาพแล้ว

---

## 4. วิธีเชื่อมต่อที่แนะนำ: Export Sprite Sheet

**ค่าเริ่มต้นสำหรับ Arena MVP ให้เลือกวิธีนี้ก่อน** เพราะเกมใช้ Phaser Game Objects และระบบ Animation อยู่แล้ว การ export เป็น asset ช่วยหลีกเลี่ยงการต้องคำนวณ pixel buffer และ composite ภาพใหม่ทุกเฟรม

### Step 1 — Export เอฟเฟกต์ที่เลือก

```bash
node tools/render.mjs <category>/<effect-name> --sheet
```

ตามรูปแบบของ PixelFX คำสั่งนี้จะสร้างไฟล์ PNG แบบหลายเฟรมพื้นหลังโปร่งใส และไฟล์ JSON รูปแบบ Aseprite-style โดย JSON มีข้อมูลใน `meta.pixelfx` เช่น FPS, loop, frame size, columns และ pivot

### Step 2 — อ่าน JSON ก่อนเขียน Loader

ห้ามเดา frame size, จำนวนเฟรม, ชื่อเฟรม, FPS หรือ pivot ให้เปิด JSON ที่ export จริง แล้วอ่านค่าจากไฟล์นั้น

ตรวจสอบ:

- ขนาดของแต่ละ frame และจำนวนเฟรมทั้งหมด
- การเรียงลำดับเฟรม
- `meta.pixelfx.fps`
- `meta.pixelfx.loop`
- `meta.pixelfx.pivot`
- ข้อมูลจังหวะ `act` ถ้ามี เช่น windup, recovery, hits และ freeze

อย่าคิดว่าโครงสร้าง JSON ทุกเอฟเฟกต์เหมือนกัน 100% ให้ตรวจ output ของ effect นั้นก่อน

### Step 3 — วางไฟล์ในเกม

เก็บเฉพาะไฟล์ที่ใช้จริงไว้ใต้โฟลเดอร์ที่แยกชัดเจน เช่น

```text
public/
  assets/
    effects/
      pixelfx/
        <category>/
          <effect-name>.png
          <effect-name>.json
```

ห้ามนำ output ทั้งคลังหรือโฟลเดอร์ `records/` ทั้งหมดเข้ามาในเกม หากมีการ export ทดลอง ให้เก็บไว้นอก `public/assets/` และนำเข้าเฉพาะไฟล์ที่ผ่านการเลือกแล้ว

### Step 4 — เชื่อมเข้ากับ Phaser

ก่อนเขียนโค้ด ให้ตรวจ API ของ Phaser **เวอร์ชันที่ติดตั้งอยู่จริง** และรูปแบบ JSON ที่ export ออกมา จากนั้นเลือกวิธี loader ที่รองรับไฟล์นั้น

แนวทางที่ต้องรักษา:

- โหลด texture/atlas ใน `preload()` ของ Scene ที่เหมาะสม
- สร้าง Animation เพียงครั้งเดียว ตรวจ `anims.exists()` ก่อนสร้าง เพื่อป้องกันการประกาศซ้ำเมื่อเข้า Scene ใหม่
- ใช้ `meta.pixelfx.fps` เป็นค่าเริ่มต้นของความเร็ว ไม่กำหนดตัวเลขใหม่โดยไม่มีเหตุผล
- ตั้ง origin/pivot ตาม metadata จริง เพื่อให้เอฟเฟกต์ยึดตำแหน่งได้ถูกต้อง
- ตั้ง `DEPTH` ให้เหมาะกับชั้นภาพ เช่น อยู่หลังตัวละคร อยู่หน้าอาวุธ หรืออยู่เหนือเป้าหมาย
- ปรับ scale ให้ตรงกับขนาดในโลกเกม 800×600 และทดสอบบนฉากจริง
- เอฟเฟกต์ one-shot ต้องถูก destroy หรือคืนเข้าระบบ pool เมื่อเล่นจบ
- เอฟเฟกต์ loop ต้องมีวิธีหยุดและ cleanup เมื่อ Scene ปิดหรือสถานะเปลี่ยน
- ใช้ camera/scroll behavior ให้สอดคล้องกับวัตถุที่เอฟเฟกต์เกาะอยู่ ห้ามติดหน้าจอด้วย `setScrollFactor(0)` โดยไม่ตั้งใจ

ถ้า loader ไม่รองรับ JSON ที่ได้ ให้ตรวจสอบว่าจะใช้ atlas loader, แปลง JSON หรือใช้ spritesheet loader ได้อย่างปลอดภัยอย่างไร ห้ามแก้ JSON แบบเดาสุ่ม และห้ามใช้ตัวอย่าง API ของ Phaser 3 โดยไม่ตรวจ Phaser 4

### Step 5 — สร้าง Wrapper กลาง

ให้ Scene เรียกใช้ผ่านฟังก์ชันกลาง เช่น `spawnPixelFx(scene, effectId, options)` หรือชื่อที่เข้ากับโครงสร้างจริง โดย wrapper รับผิดชอบเรื่องตำแหน่ง, ทิศทาง, depth, scale, การเล่นซ้ำ และ cleanup

ข้อกำหนด:

- อย่าให้ `GameScene.ts` ต้องรู้รายละเอียด path ของไฟล์ PNG/JSON ทุกตัว
- อย่าผูก logic ภาพเข้ากับ damage calculation
- อย่าสร้าง Animation ซ้ำทุกครั้งที่โจมตี
- อย่าเพิ่ม manager หรือ abstraction ขนาดใหญ่เกินความจำเป็น ให้เริ่มจาก wrapper เล็ก ๆ ก่อน
- ตั้งชื่อ asset และ animation ให้ไม่ชนกัน เช่น prefix `pixelfx_`

---

## 5. วิธีขั้นสูง: ใช้ PixelFX Runtime สด

ใช้วิธีนี้เฉพาะเมื่อจำเป็นต้องปรับ palette, seed, angle, light, size หรือ options ระหว่างเล่นแบบ dynamic จนการใช้ Sprite Sheet ไม่เหมาะสม

PixelFX มี API หลัก เช่น `createFrame`, `clearFrame`, `createFx` และ `composite`; instance มี `update(dt)`, `draw(frame, layer)`, `stop()` และ `done()` การใช้ใน Phaser ไม่ใช่แค่ import แล้ววาดลง Scene ได้ทันที เพราะ PixelFX วาดลง buffer ของตัวเอง ไม่ใช่ Phaser Game Object

ก่อนเลือกวิธีนี้ AI ต้อง:

1. ตรวจ `package.json` ของ PixelFX และ `exports` จริง รวมถึงตรวจว่ามีแพ็กเกจ npm ที่ตรงกับ source version นี้หรือไม่ ห้ามสันนิษฐานว่า `npm install pixelfx` ใช้ได้
2. ถ้าต้อง copy source ให้ copy เฉพาะ `src/core` และ effect files ที่จำเป็น พร้อมตรวจ import dependencies ของ effect นั้นให้ครบ
3. ตรวจ TypeScript/Vite compatibility และเขียน type wrapper เฉพาะที่จำเป็น ห้ามปิด type checking ทั้งโปรเจกต์เพื่อกลบปัญหา
4. สร้าง adapter แยกจาก `GameScene.ts` เพื่อเชื่อม PixelFX frame buffer กับ texture/canvas ของ Phaser
5. คำนึงถึงการ update, clear, composite, refresh texture และ cleanup ให้ครบทุก frame
6. ทดสอบ CPU/GPU และหน่วยความจำเมื่อมีหลายเอฟเฟกต์พร้อมกัน

**ห้ามใช้ Runtime สดเป็นค่าเริ่มต้น** หากผลลัพธ์ที่ต้องการทำได้ด้วย Sprite Sheet เพราะจะเพิ่มภาระการ render และความซับซ้อนในการดูแลโดยไม่จำเป็น

---

## 6. การใช้เอฟเฟกต์ที่มีตัวละครหรือ Attack choreography

PixelFX มีเอฟเฟกต์บางรายการในหมวด `moves/` และบาง effect มีข้อมูล `act` สำหรับท่าทางตัวละคร, target reaction, hit-stop และจังหวะการโจมตี

สำหรับเกมนี้:

- ถ้า effect มีตัวละคร stock ของ PixelFX ติดมาด้วย ให้พิจารณาใช้เฉพาะภาพ VFX แยกจากตัวละคร เพราะเกมมี sprite ตัวละครของตัวเองอยู่แล้ว
- ห้ามนำตัวละคร stock ของ PixelFX มาวางทับตัวละคร Claymation โดยไม่ตั้งใจ
- ห้ามนำ `act` หรือ target simulation ของไลบรารีมาเป็นระบบโจมตีจริง
- ถ้าต้องการใช้ timing จาก `act` ให้ AI อ่าน metadata เช่น windup, recovery, hits และ freeze แล้วเสนอการจับคู่กับ animation/event ของเกม โดยไม่เปลี่ยนผลการคำนวณดาเมจ
- การทำ hit-stop หรือ camera shake ต้องใช้ระบบของเกม และต้องไม่ค้างหรือหยุด input/game state โดยไม่ตั้งใจ

จำไว้ว่า **ภาพโจมตีไม่ใช่การโจมตีจริง** การตรวจโดน, ดาเมจ และสถานะศัตรูต้องยังเกิดจากระบบของ Arena MVP

---

## 7. License และการบันทึกที่มา

PixelFX `package.json` ที่ตรวจใน source ระบุ license เป็น MIT แต่ยังต้องตรวจไฟล์ `LICENSE` และ notices ของ source ที่นำมาใช้จริงก่อนเผยแพร่เกม

- ถ้า copy source code ให้คง copyright/license notice ที่จำเป็นไว้
- ถ้าใช้ไฟล์ที่ export เป็น sprite sheet ให้บันทึกที่มาและ ID ของ effect ในไฟล์ log/notice ของ asset
- ระวังส่วนประกอบที่ README ระบุว่าอาจมี license/notice แยกจาก license หลัก เช่น font หรือ asset ประกอบอื่น
- ห้ามอ้างว่าไฟล์ทุกชิ้นใน repository ใช้ license เดียวกันโดยไม่ตรวจ
- ก่อน release เชิงพาณิชย์ ให้ตรวจ license ของ effect, source dependency และไฟล์ประกอบอีกครั้ง

ตัวอย่างข้อมูลที่ควรบันทึก:

```text
Asset: pixelfx_fire_frost-nova.png
Source: https://github.com/patch-gg/pixelfx
Effect ID: ice/frost-nova
License: ตรวจจาก LICENSE/notice ของ source version ที่ใช้
Integration: Sprite Sheet / Phaser Atlas
Date added: YYYY-MM-DD
```

---

## 8. Testing checklist

หลังเพิ่มเอฟเฟกต์หนึ่งตัว ต้องทดสอบอย่างน้อย:

- [ ] `npm run build` ผ่าน โดยไม่มี TypeScript/Vite error ใหม่
- [ ] เปิดเกมและเรียกเอฟเฟกต์จากเหตุการณ์จริงได้
- [ ] เอฟเฟกต์เริ่มที่ตำแหน่งถูกต้อง ไม่ลอยหรือจมจาก pivot ผิด
- [ ] หันซ้าย/ขวา หรือหมุนตามทิศทางได้ถูกต้อง ถ้าเอฟเฟกต์ต้องรองรับ
- [ ] อยู่หน้า/หลังตัวละครและบอสถูกต้องตาม `DEPTH`
- [ ] ไม่บัง HUD หรือทำให้ตัวละครอ่านภาพยาก
- [ ] one-shot เล่นจบแล้วถูก cleanup; loop หยุดได้เมื่อไม่ต้องใช้
- [ ] เข้า Scene ใหม่หรือเริ่ม Hunt ใหม่แล้วไม่เกิด Animation ซ้ำหรือ texture ค้าง
- [ ] เอฟเฟกต์ไม่เปลี่ยน damage, hitbox, cooldown, movement หรือผลแพ้/ชนะ
- [ ] เปิดเอฟเฟกต์หลายครั้งติดกันแล้วไม่มีอาการกระตุกหรือ object สะสม
- [ ] หาก texture ไม่โหลด เกมยังเล่นต่อได้
- [ ] ภาพและสีเข้ากับ Art Direction ของเกมเมื่อดูในฉากจริง

---

## 9. Standard output จาก AI ทุกครั้ง

เมื่อทำงานเกี่ยวกับ PixelFX ให้รายงานสั้น ๆ ตามหัวข้อนี้:

1. **เลือก effect:** ID และเหตุผลที่เลือก
2. **ตรวจภาพแล้ว:** ระบุว่าได้ render และเปิดดู preview จริงหรือยัง
3. **วิธีเชื่อม:** Sprite Sheet หรือ Runtime พร้อมเหตุผล
4. **ไฟล์ที่แตะ:** ระบุ path ของไฟล์ที่เพิ่ม/แก้ทั้งหมด
5. **ผลกระทบ:** ยืนยันว่าไม่ได้แตะ gameplay logic หรือบอกความเสี่ยงที่พบ
6. **การทดสอบ:** ผล `npm run build` และการทดสอบในเกมที่ทำได้จริง
7. **ข้อจำกัด/License:** แจ้งสิ่งที่ยังไม่ยืนยันอย่างตรงไปตรงมา

### ห้ามทำ

- ห้าม import effect ก่อนดู preview
- ห้ามนำทั้งคลังเข้ามาใน bundle
- ห้ามเขียนระบบ particle ใหม่ ถ้ามี effect ที่ตรงและเข้ากันอยู่แล้ว
- ห้ามปรับ gameplay เพื่อให้เอฟเฟกต์ดูตรงกับภาพตัวอย่าง
- ห้ามเปลี่ยน Art Direction ทั้งเกมเอง
- ห้ามบอกว่าทดสอบแล้ว หากไม่ได้รันจริง
- ห้ามทำหลายเอฟเฟกต์ในงานเดียวโดยไม่ได้แบ่งเป็นขั้นและทดสอบทีละตัว

**หลักตัดสินใจ:** เลือกเอฟเฟกต์ที่ทำให้การต่อสู้หรือ feedback ชัดขึ้น โดยเพิ่มความซับซ้อนให้โค้ดน้อยที่สุด และให้ความสนุก/ความอ่านง่ายของเกมมาก่อนจำนวนเอฟเฟกต์
