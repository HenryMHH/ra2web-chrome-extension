# RA2 Web — 單位名稱顯示 / 陣營色 / 畫面外指標 / 寶箱內容 / 單位篩選 — Chrome Extension 開發紀錄

## 背景

目標：在 ra2web / Chrono Divide(用 three.js + canvas 在瀏覽器執行的 RA2 復刻版)中,以 Chrome Extension 的方式注入下列功能,完全不修改原始檔:

1. 每個單位上方顯示**名稱標籤**(陣營色底、白字)
2. viewport 邊緣顯示**畫面外敵方單位指標**(紅色箭頭 + 名稱)
3. 地圖上顯示**寶箱內容物**(中文標籤)
4. 依單位類型**過濾**要顯示哪些 label(custom / preset 兩種模式)
5. 標籤**字體大小**可調

來源檔案:`ra2web.min.js`,~4.2MB / ~9.6 萬行 minified JS。

### 執行期依賴版本

| 依賴 | 版本 | 備註 |
|------|------|------|
| three.js | **~r94 (v0.94, 2018-06)** | `Matrix4` 只有 `getInverse(m)`,**沒有** `.invert()`。`.invert()` 是 r123(2021-01)才加;`getInverse` 在 r147(2022-09)被移除。寫任何 THREE API 之前都要先確認 r94 有沒有,或用 feature-detect。|
| SystemJS | `System.register` 形式 | 保留完整模組名,所以即使 minified 也能 `System.import('engine/...')` 拿到。|

---

## 一、原始碼分析

### 模組系統

整個 bundle 用 **SystemJS (`System.register`)** 包裝,且**保留完整模組名稱**,所以雖然 minified 但結構非常清楚。每個模組長這樣:

```js
System.register("engine/renderable/entity/PipOverlay", [deps...], function(e, t) {
    return { setters: [...], execute: function() { e("PipOverlay", class { ... }) } };
});
```

### 分層架構

| 層       | 路徑前綴                    | 說明                                   |
| -------- | --------------------------- | -------------------------------------- |
| 遊戲邏輯 | `game/gameobject/`          | 純資料/狀態,不碰 three.js              |
| 渲染     | `engine/renderable/entity/` | three.js 物件,每種 gameobject 對應一個 |
| 玩法 trait | `game/trait/`             | 全局邏輯模組,例如 CrateGeneratorTrait  |

主要 renderable:

- `engine/renderable/entity/Building`
- `engine/renderable/entity/Vehicle`
- `engine/renderable/entity/Infantry`
- `engine/renderable/entity/Aircraft`
- 由 `engine/renderable/entity/RenderableFactory` 集中產生

### 關鍵類別

#### `PipOverlay` — 單位 HUD overlay

掛在每個單位身上的 HUD 覆蓋層,負責畫血條、選取框、載運 pip、控制群組數字、老兵階級、集合點線、施法進度條。

`PipOverlay` 的 root 是一個 `THREE.Object3D`(`this.rootObj`,名稱 `"pip_overlay"`),所有元件當 child 加進去。

constructor 注入的依賴(實例屬性):
- `this.gameObject` — 對應的 gameObject(`.rules`, `.owner`, `.position`...)
- `this.camera` — 主鏡頭
- `this.viewer` — `{ value: localPlayer }`
- `this.alliances` — alliance manager,有 `areAllied(a, b)` / `playerList.players`
- `this.strings` — i18n,有 `.get(key)` 和 `.data`
- `this.rootObj` — `pip_overlay` Object3D

#### `DebugLabel` — 文字 sprite billboard 範本

`PipOverlay` 內部 debug 模式使用的「在單位上方畫文字」實作:

1. `createTexture(text, ...)`:開個 `<canvas>`,用 `CanvasUtils.drawText` 把文字畫上去(含描邊、padding),包成 `THREE.Texture`
2. `createMesh(texture)`:`SpriteUtils.createSpriteGeometry` 建一個永遠面向相機的 sprite,材質 `MeshBasicMaterial({ depthTest: !1, transparent: !0 })` —— `depthTest:!1` 確保不會被單位本體擋住

> **注意**:最終實作**不使用** `DebugLabel` class,改直接呼叫 `CanvasUtils.drawText` 並傳入 `backgroundColor` 自訂色底,以達成陣營色效果。

#### `CrateGeneratorTrait` — 寶箱管理 trait

`game/trait/CrateGeneratorTrait` 持有當前場上所有寶箱:

- `this.crates` — 寶箱 array,每個 `{ obj, powerup }`
- `crate.obj.position.worldPosition` / `crate.obj.tile` — 位置
- `crate.powerup.type` — powerup type id(數字)
- `init(game)` — 每局開始時呼叫一次
- `spawnCrateAt(...)` — 新寶箱誕生時呼叫

### 取得「單位名稱」的路徑

```js
gameObject.rules.uiName;       // i18n key,例如 "name:E1"
strings.get(rules.uiName);     // 本地化後的顯示文字
strings.data;                  // 整份 i18n table,key 形如 "name:E1"
```

**單位清單的來源(三段 fallback)**

1. `state.gameRef.rules.{infantry,vehicle,aircraft,building}Rules` — 當局實際載入的 rules Map,key 為 `rules.name`,value 為 rule object;displayName 由 `strings.get(rule.uiName)` 解析。**首選**,鎖定當局 rule 集合,且與 `shouldShowLabel` 的比對 key 同字典。
2. `state.discoveredUnits` — 從 `PipOverlay.create3DObject` patch 累積的當局實際出場單位。
3. `state.strings.data` 的 `name:*` keys — i18n 字典,bundle 內固定,所有局共用。**僅作最後 fallback**,因為多個 rule 共享同一 `uiName` 時(例如 ADOG / DOG / SDOG 共享 `name:DOG`)會合併成單一條目,造成「勾 DOG 不會隱藏 ADOG」這類 mismatch。

`state.gameRef` 在 `CrateGeneratorTrait.prototype.init(game)` patch 中捕獲(同一 patch 已用於 `state.crateTraitRef`)。

### 取得「玩家列表」(掃描畫面外敵人用)

```js
pip.alliances.playerList.players  // 全部玩家
player.isNeutral                  // 是否中立
player.getOwnedObjects()          // 所擁有的 gameObjects
go.position.worldPosition         // 3D 世界座標
go.isDestroyed                    // 已死亡
```

---

## 二、注入策略

### 為什麼用 `System.import` 而非 wrap `System.register`

Wrap `System.register` 會觸發 SystemJS anonymous register 防護:
```
Uncaught TypeError: Invalid System.register call.
Anonymous System.register calls can only be made by modules loaded by
SystemJS.import and not via script tags.
```

且時機難以掌握(content_script `document_idle` 注入時遊戲模組多半已 register 完)。

改用公開 API `System.import(moduleName)`:
- 對**已執行**的模組:直接從 cache 回傳 namespace
- 完全唯讀,不觸發 anonymous register 檢查
- 任何時間都可以用

```js
const [P, CU, SU, CO, CGT] = await Promise.all([
  System.import('engine/renderable/entity/PipOverlay'),
  System.import('engine/gfx/CanvasUtils'),
  System.import('engine/gfx/SpriteUtils'),
  System.import('game/Coords'),
  System.import('game/trait/CrateGeneratorTrait'),
]);
```

### Eager patch

injected.js 載入即執行 `loadClasses().then(patchPrototype)`,**不等 popup 「套用」**。如此即使使用者在開局後才打開 popup 啟用功能,所有開局時就生成的單位 PipOverlay 也已經被 patch 過、登錄到 `pipInstances`,可以在 `apply()` 時立即 sweep 補標籤。

### 取得 trait 的 ref

`CrateGeneratorTrait` 在 prototype 上掛兩個攔截:

```js
CGT.prototype.init = function (game) {
  state.crateTraitRef = this;           // 標準路徑
  state.discoveredUnits.clear();         // 換局時清空已發現單位
  return origInit.apply(this, arguments);
};
CGT.prototype.spawnCrateAt = function () {
  if (!state.crateTraitRef) state.crateTraitRef = this;  // 開局後才啟用的 fallback
  return origSpawn.apply(this, arguments);
};
```

---

## 三、Patch 邏輯

### 三個 method 要 patch

```js
PipOverlay.prototype.create3DObject  // 新單位建立 → 登錄 instance + attach label
PipOverlay.prototype.update          // 每幀 → 依設定 attach/refresh/detach
PipOverlay.prototype.dispose         // 單位移除 → detach + 從 pipInstances 移除
```

### 全局狀態 (`state`)

```js
state = {
  // 類別參考(loadClasses 後填入)
  PipOverlay, CanvasUtils, SpriteUtils, Coords, crateTraitRef,

  // 從 instance 採集的全局物件(供 overlay 計算用)
  activeCamera, alliances, viewer, strings,

  // 使用者設定
  enabled, showNeutral, showIndicators,
  enabledCrateTypes: Set<number>,
  fontSize,
  hiddenUnits: Set<string>,    // 大寫 rule name

  // 內部追蹤
  patched: bool,
  pipInstances: Set<PipOverlay>,         // 所有活著的 instance
  discoveredUnits: Map<ruleName, displayName>,
  lastPipUpdateTime: number,             // 偵測遊戲已結束
  overlayCanvas, overlayCtx, rafId,      // 覆蓋層
  origCreate, origUpdate, origDispose,   // 原始 method
};
```

### 陣營判斷

```js
function resolveTeam(self) {
  const local = self.viewer?.value;
  const owner = self.gameObject?.owner;
  if (!local || !owner) return 'unknown';
  if (owner.isNeutral) return 'neutral';
  if (owner === local) return 'self';
  if (self.alliances?.areAllied(owner, local)) return 'ally';
  return 'enemy';
}
```

### 陣營色底

| team | backgroundColor |
|------|----------------|
| `enemy` | `rgba(160,0,0,0.88)` 紅底 |
| `self` / `ally` | `rgba(0,50,160,0.88)` 藍底 |
| `neutral` | `rgba(0,130,50,0.88)` 綠底 |
| `unknown` | `rgba(70,70,70,0.88)` 灰底 |

白字(`color: 'white'`),outline 半透明黑色。

### Label 建立流程 (`buildLabel`)

1. 拿 displayName(`resolveName`)和 team(`resolveTeam`)
2. 創建 `<canvas>`,用 `state.CanvasUtils.drawText` 把每一行畫上去(會 autoEnlarge canvas)
3. 將像素往右下 shift 1px(`putImageData(imgData, 1, 1)`)補一個邊框緩衝,模仿 DebugLabel 的後處理
4. 包成 `THREE.Texture`(NearestFilter, flipY:true, needsUpdate:true)
5. 用 `state.SpriteUtils.createSpriteGeometry` 建 sprite geometry(永遠面向相機)
6. `MeshBasicMaterial({ map, transparent:true, depthTest:false })`,renderOrder 設高(`999998`)蓋在最頂
7. mesh.userData.`__unameLbl` = true(供之後 sweep 用)
8. mesh.userData.`__unameLblDisposer` 是 dispose helper

### Label 生命週期

`attachLabel(self)`:
- 透過 `buildLabel(self)` 建 mesh,加進 `self.rootObj`
- 在 `self` 上記下 cache:`__unameLbl` / `__unameLblText` / `__unameLblOwner` / `__unameLblTeam` / `__unameLblFontSize`

`refreshLabel(self)`:
- 比對 cache,**若 name / owner / team / fontSize 任一改變**就 dispose 舊的、重建新的
- `buildLabel` 失敗(回 null)時,cache 不更新 → 下一幀重試

`detachLabel(self)`:
- 從 rootObj 移除 + dispose texture/material/geometry
- 清掉 cache

### `shouldShowLabel(self)` 判斷

```
state.enabled 必須開
team === 'neutral' 時 state.showNeutral 必須開
gameObject.rules.name 必須不在 state.hiddenUnits 中(大寫比對)
```

`update()` patch 每幀檢查;不符就 detach,符合就 attach 或 refresh。

### 既存單位的處理 — `pipInstances` 集合

Eager patch 確保所有 `create3DObject` 呼叫都會把 `this` 加進 `state.pipInstances`。
為以防萬一 update 看到沒被追蹤的 instance(理論上不該發生)也補登錄。

`apply()` 啟用時:`for (const pip of state.pipInstances) attachLabel(pip)` 立即補標籤,不需等下一幀 update。

### Label 移除(關閉功能時)— `sweepLeftoverLabels`

每個 label mesh 都打 `userData.__unameLbl = true`。需要清理時:

1. 借 `THREE.WebGLRenderer.prototype.render` 一個 frame 拿到 scene
2. 從 scene 往上找到 root(可能是 group 而非 scene 本身)
3. `root.traverse(o => userData.__unameLbl && ...)` 收集再移除
4. 呼叫 `__unameLblDisposer` 釋放 GPU 資源
5. 超時 2s fallback(避免卡住)
6. 結束後 `state.sweepPromise = null`(避免並行 sweep)

---

## 四、畫面外指標 + 寶箱 overlay

兩者共用同一 canvas(`state.overlayCanvas`)和同一 RAF loop(`drawOverlay`):

```js
position:fixed; top:0; left:0; pointer-events:none; z-index:9999
```

每幀:
1. `state.showIndicators || state.enabledCrateTypes.size > 0` 是否任一啟用,否則停止 RAF
2. 對 canvas 重設大小、清空
3. **若 `lastPipUpdateTime` 超過 2s 沒被更新**(代表遊戲已結束/暫停),保持空白不畫(避免畫到死亡座標)
4. 若 indicators 開:遍歷 `alliances.playerList.players`,過濾非敵方(self / neutral / 盟友)和 `hiddenUnits`,對 enemy 單位 `worldPosition.project(camera)` → 螢幕座標
   - 若在 viewport 內(扣掉 24px MARGIN)跳過
   - 否則畫紅色實心箭頭(指向單位)貼在邊緣,並在箭頭旁邊畫單位名稱小標籤
5. 若 crate types 開:呼叫 `drawCrateLabels`,遍歷 `state.crateTraitRef.crates`
   - 過濾 `state.enabledCrateTypes` 有勾選的 powerup type
   - 從 `crate.obj.position.worldPosition`(或 fallback 到 `Coords.tile3dToWorld(tile.rx+0.5, tile.ry+0.5, tile.z)`)取座標,project → 螢幕座標
   - 在寶箱位置上方畫金色標籤(含 powerup 中文名)

### 寶箱 powerup type → 中文

```
0  裝甲↑    1  火力↑    2  基地回復   3  金錢
4  揭示地圖  5  速度↑    6  老兵升級   7  免費單位
8  無敵護盾  11 礦石     13 隱形      14 黑暗霧
15 爆炸     16 核彈     17 燃燒
```

(對應 `POWERUP_LABELS` 和 popup `CRATE_TYPES`,兩處要同步。)

### 共用 `_tmpV3`

`new THREE.Vector3()` 在模組頂層 eval 時 THREE 還沒準備好。`let _tmpV3 = null` 在 `drawOverlay` 第一次執行才 lazy init,後續每次 iteration 開頭 `.set(...)` 覆寫,所以可重複使用。

---

## 五、單位篩選 (popup-side state)

`popup.js` 維護兩種模式:

| 模式 | 來源 |
|------|------|
| `custom` | `hiddenUnitsCustom: Set<ruleName>` — 單場自訂,checkbox 清單 |
| `preset` | `snapshots[selectedPresetIndex].hiddenUnits` — 從 custom 儲存的快照 |

`getEffectiveHiddenUnits()` 在套用時根據當前 `filterMode` 回傳 list,寫進 `chrome.storage` 的 `hiddenUnits` 欄位,再透過 `apply` 指令傳給 injected.js。

單位清單來源(`getUnitNames` 指令):
1. 優先用 `state.strings.data`(完整字典),抓 `name:` 開頭的 key
2. fallback 用 `state.discoveredUnits`(從 `create3DObject` patch 累積)
3. 都沒有 → 提示「進入對局後單位清單才會出現」

排序:依 displayName,locale `zh-Hant`。

Snapshots 儲存在獨立 key `ra2NamesSnapshots`(陣列),每筆:
```js
{ name: '<input> <ISO timestamp>', hiddenUnits: [...], totalCount: number }
```

---

## 六、Chrome Extension 結構

### 檔案

```
extension/
├── manifest.json   (MV3)
├── background.js   (service worker,僅管 icon 切換)
├── content.js      (isolated world,訊息中繼)
├── injected.js     (MAIN world,實際 patch + overlay)
├── popup.html      (UI)
├── popup.css
├── popup.js
└── icons/
    ├── running-{16,32,48,128}.png   (啟用中)
    └── stopping-{16,32,48,128}.png  (停用中)
```

### 通訊架構

```
popup.html/js  ←—chrome.runtime.sendMessage—→  content.js
                                                    ↓
                                              window.postMessage
                                                    ↓
                                              injected.js (MAIN world)
                                                    ↓
                                          SystemJS / THREE / PipOverlay.prototype
                                          CrateGeneratorTrait.prototype

popup.js / content.js  ─chrome.runtime.sendMessage({cmd:'setIcon'})→  background.js
                                                                          ↓
                                                                   chrome.action.setIcon
```

為何三層必要:
- **popup**:存得到 `chrome.storage`,送得到 `chrome.tabs.sendMessage`,但不在 page 裡
- **content.js**(isolated world):跟 popup 通訊用 `chrome.runtime`,但看不到 page 的 `System` / `THREE`
- **injected.js**(MAIN world):看得到 page globals,但用不到 `chrome.*`
- **background.js**:`chrome.action.setIcon` 在 service worker 比較穩,且 popup 關閉時也能由 content.js 觸發(例如自動 apply 完)

### 指令協定

`content.js ↔ injected.js`:`window.postMessage` 每筆帶 `id` / 3 秒 timeout。
- `apply(opts)` — 套用設定;`opts = { enabled, showNeutral, showIndicators, enabledCrateTypes, fontSize, hiddenUnits }`
- `status` — 回報目前狀態
- `getUnitNames` — 列出所有單位 ruleName + displayName

content.js 收到 injected.js 發出的 `{__ra2names:'ready'}` 後,**自動 apply** 已儲存的設定(若任一功能為 on),並通知 background 切 icon。

### popup UI

- **主開關**「顯示單位名稱」
- 副選項「顯示中立單位」(主開關關閉時 disable)
- **字體大小**下拉(10 / 12 / 14 / 16 / 18 / 20 px)
- **指標**「顯示畫面外敵人指標」(獨立開關)
- **寶箱**摺疊區:15 種 powerup type 的多選 grid,有「全選 / 全不選」
- **篩選**摺疊區:custom / preset 兩種模式
  - custom:checkbox 清單 + 搜尋框 + 「全選 / 全不選」 + 「儲存快照」
  - preset:選一筆快照(顯示 `已顯示/總數`) + 「刪除」
- **套用**主按鈕(統一觸發)
- 狀態列(尚未連線 / 已連線 / 已啟用 / 無法連線)
- 設定持久化:
  - `ra2NamesSettings` key — 主設定
  - `ra2NamesSnapshots` key — 快照陣列

### manifest.json 重點

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "scripting", "activeTab"],
  "host_permissions": [
    "https://game.chronodivide.com/*",
    "https://chronodivide.com/*",
    "https://*.ra2web.com/*",
    "https://ra2web.com/*"
  ],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": [...],
    "js": ["content.js"],
    "run_at": "document_idle",
    "all_frames": true
  }],
  "web_accessible_resources": [{
    "resources": ["injected.js"],
    "matches": [...]
  }]
}
```

---

## 七、行為總表

### 名稱標示

| 名稱開關 | 中立開關 | 結果 |
| -------- | -------- | ---- |
| ON  | ON  | 全部敵/我/盟/中立都有標籤 |
| ON  | OFF | 中立隱藏,其他都有 |
| OFF | —   | sweep 場上所有 label |

### 陣營色

| 陣營 | label 底色 |
|------|-----------|
| 敵方 | 紅底 `rgba(160,0,0,0.88)` |
| 自己 / 盟友 | 藍底 `rgba(0,50,160,0.88)` |
| 中立 | 綠底 `rgba(0,130,50,0.88)` |
| 未知 | 灰底 `rgba(70,70,70,0.88)` |

### 畫面外指標

| 指標開關 | 結果 |
|---------|------|
| ON | viewport 邊緣紅色箭頭 + 單位名稱小標籤,指向畫面外敵方單位(`hiddenUnits` 過濾後) |
| OFF | 若寶箱也關 → overlay canvas 移除、RAF 停止 |

### 寶箱

| 已勾選 type 數 | 結果 |
|----------------|------|
| 0 | 不畫寶箱 label |
| ≥ 1 | overlay 中以金色標籤標出對應 powerup type 的寶箱位置(中文名) |

### 字體大小

10–20 px。改動會被 `refreshLabel` 比對偵測,所有現存 label 在下一幀重建。

---

## 八、踩過的坑

1. **`System.register` wrap 會觸發 anonymous register error** — 改用 `System.import` 解決
2. **Content script 預設在 isolated world,看不到 page 的 `System`/`THREE`** — 需要 `"world": "MAIN"`(Chrome 102+)或注入 `<script>` 標籤
3. **既存單位無法直接 enumerate** — PipOverlay 邏輯類沒掛在 scene graph;改用「eager patch + `pipInstances` Set」追蹤所有生成過的 instance,`apply()` 時統一 sweep
4. **清理殘留 label** — Object3D 加 `userData.__unameLbl` 標記,借 `WebGLRenderer.render` hook 一幀拿到 scene 後 traverse 清掉;sweep promise 鎖避免並行
5. **`new THREE.Vector3()` 在模組頂層執行時 THREE 尚未存在** — 改為 `let _tmpV3 = null` lazy init,在 `drawOverlay` 第一次執行時才建立
6. **指標開關關閉後 RAF ghost frame** — 在 RAF loop 開頭先檢查 `state.showIndicators || state.enabledCrateTypes.size>0`,否則 `state.rafId=null` 並 return,不再排程下一幀
7. **遊戲結束後 overlay 仍畫死亡座標** — 在 `update` patch 記錄 `lastPipUpdateTime`,`drawOverlay` 中超過 2s 沒被更新就跳過繪製
8. **buildLabel 失敗的暫時性錯誤(`strings` 還沒就緒)** — `refreshLabel` 若 `buildLabel` 回 null 不更新 cache,下一幀自動重試
9. **CrateGeneratorTrait ref 取得時機** — 若使用者在開局後才啟用「寶箱內容」,`init` 已跑過,改在 `spawnCrateAt` 補捕一次 trait ref;換局時 `init` 會清空 `discoveredUnits`
10. **canvas 自動放大會清空原本像素** — `CanvasUtils.drawText` 的 `autoEnlargeCanvas: true` 會在文字超出時擴大畫布並清空。先 `getImageData` 備份再 `putImageData(imgData, 1, 1)` shift 1px 還原(順便當作描邊預留空間)
11. **showCrateContents 從 boolean 演進到 enabledCrateTypes 陣列** — popup `loadSettings` 仍處理舊 key migration,把舊的全 on boolean 視為「全部 powerup type 勾選」
12. **filter 兩種模式儲存設計** — `hiddenUnits` 是執行期最終結果;`hiddenUnitsCustom` 是 custom 模式編輯狀態;`snapshots` 是 preset 來源。三者不要混淆
13. **單位篩選清單與 `rules.name` key 字典不一致** — 早期版本用 `strings.data` 的 `name:*` keys 列清單,但實際隱藏比對 `gameObject.rules.name`。當多個 rule 共享同一 `uiName`(例如 ADOG / SDOG 共享 `name:DOG`),清單只看得到 `DOG`,勾選後 `hiddenUnits.has('ADOG')` 仍回 false → 標籤不消失。改以 `state.gameRef.rules` 之 `{infantry,vehicle,aircraft,building}Rules` Map 為主要來源,key 與比對端同字典。
14. **drawOverlay 用的 camera matrixWorldInverse 在 render() 外不會自動更新** — Three.js 只在 `WebGLRenderer.render()` 內部更新 camera.matrixWorldInverse。如果我們的 RAF 比遊戲的 render call 先跑,projection 會用上一幀的矩陣,結果寶箱標籤每幀都落後相機一格,看起來像「跟著螢幕飄」。在 drawOverlay 內手動 `camera.updateMatrixWorld()` 後反矩陣再投影即可解決。畫面外指標因為會 clamp 到邊緣所以看不出來,但寶箱這種精準定位就會露餡。
15. **`Matrix4.invert()` 在 r94 不存在** — 接續坑 #14,反矩陣寫法要 feature-detect:
    ```js
    if (typeof camera.matrixWorldInverse.invert === 'function') {
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();  // r123+
    } else {
      camera.matrixWorldInverse.getInverse(camera.matrixWorld);      // r94 (~r122 以前)
    }
    ```
    遊戲打包的是 r94,只能走 `getInverse`。直接寫 `.copy(m).invert()` 會炸 `TypeError: ...invert is not a function`。寫 THREE API 前先對版本表(見上方執行期依賴)。

---

## 九、可擴充方向

- 熱鍵 toggle(全域 keydown 監聽)
- 標籤透明度 / 邊框寬度客製化
- 顯示額外資訊(HP%、距離、coords 等)
- 寶箱標籤過期時間或 fade-out 動畫
- 多語系(目前 popup 字串硬編 zh-Hant)
- 匯入/匯出 snapshots(JSON 檔)
- 篩選依「類型」(infantry / vehicle / building / aircraft)而非個別 ruleName
