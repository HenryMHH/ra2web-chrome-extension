# RA2 Web — 加上「單位名稱顯示 + 陣營色 + 畫面外指標」功能的 Chrome Extension 開發紀錄

## 背景

目標:在 ra2web / Chrono Divide(一款用 three.js + canvas 在瀏覽器執行的 RA2 復刻版)的每個單位上方,加上該單位的名稱(陣營色底、白字);並在 viewport 邊緣顯示指向畫面外敵方單位的紅色箭頭指標。不能改原始檔,只能從外部用 Chrome Extension 注入。

來源檔案:`ra2web_min.js`,4.2MB / 9.6 萬行 minified JS。

---

## 一、原始碼分析

### 模組系統

整個 bundle 用 **SystemJS (`System.register`)** 包裝,且**保留完整模組名稱**,所以雖然 minified 但結構非常清楚。
每個模組長這樣:

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

主要 renderable:

- `engine/renderable/entity/Building`(line 48460)
- `engine/renderable/entity/Vehicle`(line 49591)
- `engine/renderable/entity/Infantry`(line 51316)
- `engine/renderable/entity/Aircraft`(line 51752)
- 全部由 `engine/renderable/entity/RenderableFactory`(line 55389)集中產生

### 關鍵發現:`PipOverlay`(line 46498)

`PipOverlay` 是「掛在每個單位身上的 HUD 覆蓋層」,負責畫:

- 血條、選取框、載運 pip、控制群組數字、老兵階級、集合點線、施法進度條
- **`DebugLabel`** ← 這個直接就是「在單位上方畫文字」的現成範本

`PipOverlay` 的 root 是一個 `THREE.Object3D`(`this.rootObj`,名稱 `"pip_overlay"`),所有元件當 child 加進去。

### 完美範本:`DebugLabel`(line 46161)

完整實作了「文字 sprite billboard」:

1. **`createTexture(text, color, outline)`**:開個 `<canvas>`,用 `CanvasUtils.drawText` 把文字畫上去(含描邊、padding),包成 `THREE.Texture`
2. **`createMesh(texture)`**:`SpriteUtils.createSpriteGeometry` 建一個永遠面向相機的 sprite,材質 `MeshBasicMaterial({ depthTest: !1, transparent: !0 })` — `depthTest:!1` 確保不會被單位本體擋住

`PipOverlay` 已經有現成的掛 `DebugLabel` 邏輯(line 46681),只是僅在 debug 模式開啟時用。

> **注意**:最終實作**不使用** `DebugLabel` class,改直接呼叫 `CanvasUtils.drawText` 並傳入 `backgroundColor` 自訂色底,以達成陣營色效果。

### 取得「單位名稱」的路徑

```js
gameObject.rules.uiName; // i18n key
strings.get(rules.uiName); // 本地化後的顯示文字
```

`PipOverlay` constructor 第 10 個參數 `c` 就是 `this.strings`(line 46611)。

---

## 二、注入策略演進

### 嘗試 1:Hook `System.register`(失敗)

想在 SystemJS 載入模組時攔截,wrap `System.register` 把目標模組的 export 換成捕捉版。

**問題**:

- 遊戲已載入完才貼到 console → hook 安裝太晚,所有模組都 register 完了
- 動到 `System.register` 本身會觸發 SystemJS 內建保護,丟出:
  ```
  system.js:5 Uncaught TypeError: Invalid System.register call.
  Anonymous System.register calls can only be made by modules loaded by
  SystemJS.import and not via script tags.
  ```

### 嘗試 2:`System.import`(成功)

SystemJS 公開 API `System.import(moduleName)`:

- 對**已執行**的模組:直接從 cache 回傳 namespace
- 完全唯讀,不觸發 anonymous register 檢查
- 任何時間都可以用,不依賴 `document_start`

```js
const [PipModule, CU, SU, CO] = await Promise.all([
  System.import("engine/renderable/entity/PipOverlay"),
  System.import("engine/gfx/CanvasUtils"),
  System.import("engine/gfx/SpriteUtils"),
  System.import("game/Coords"),
]);
const PipOverlay   = PipModule.PipOverlay;
const CanvasUtils  = CU.CanvasUtils;
const SpriteUtils  = SU.SpriteUtils;
const Coords       = CO.Coords;
```

拿到 class 後,改 prototype 對所有現有/未來的 instance 都生效。

---

## 三、Patch 邏輯

### 陣營判斷

`PipOverlay` 每個 instance 有:
- `this.viewer.value` → localPlayer
- `this.gameObject.owner` → 單位所屬玩家
- `this.alliances.areAllied(owner, local)` → 是否盟友

```js
function resolveTeam(self) {
  const local = self.viewer && self.viewer.value;
  const owner = self.gameObject && self.gameObject.owner;
  if (!local || !owner) return 'unknown';
  if (owner === local) return 'self';
  if (self.alliances && self.alliances.areAllied(owner, local)) return 'ally';
  return 'enemy';
}
```

### 陣營色底

| team | backgroundColor |
|------|----------------|
| `enemy` | `rgba(160,0,0,0.88)` 紅底 |
| `self` / `ally` | `rgba(0,50,160,0.88)` 藍底 |
| `unknown` | `rgba(70,70,70,0.88)` 灰底 |

白字(`color: 'white'`),直接傳給 `CanvasUtils.drawText`。

### 三個 method 要 patch

```js
PipOverlay.prototype.create3DObject; // 新單位建立時 → attachLabel + 加入 enemyInstances
PipOverlay.prototype.update; // 每幀 → refreshLabel(處理 owner / 名稱 / team 變化)
PipOverlay.prototype.dispose; // 單位移除 → detachLabel + 從 enemyInstances 移除
```

### 區分「新單位」vs「既存單位」

核心 trick:patch 後的 `create3DObject` 會在 `this` 上打標記 `__unameLblBornHere = true`。

- 既存單位:`create3DObject` 在 patch 之前跑過,**永遠不會**有這個標記
- 新單位:有標記

在 `update()` 裡:

```js
const isExisting = !this.__unameLblBornHere;
if (isExisting && !state.labelExisting) return; // opt-out 既存單位
```

這樣就能乾淨地讓使用者選擇要不要標示既存單位。

### Label 移除策略

每個 label 的 Object3D 都打上 `userData.__unameLbl = true`。需要清理時:

- 借 `THREE.WebGLRenderer.prototype.render` 一個 frame 拿到 scene
- `scene.traverse(o => userData.__unameLbl && parent.remove(o))`

### 畫面外敵人指標

`state.enemyInstances`(Set)追蹤所有敵方 PipOverlay instance。

每 RAF frame:
1. 對每個 enemy instance:呼叫 `pip.rootObj.getWorldPosition(_tmpV3)` 取 3D 世界座標
2. `_tmpV3.project(camera)` → NDC → 換算 screen pixel `(sx, sy)`
3. 若 `sx`/`sy` 在 `MARGIN=24px` 範圍內 → 已在畫面內,跳過
4. 否則從 viewport 中心向單位方向畫實心箭頭,貼在 viewport 邊緣

```js
const angle = Math.atan2(sy - cy, sx - cx);
// edge intersection via min(scaleX, scaleY)
ctx.fillStyle = 'rgba(210,30,30,0.9)';
```

覆蓋層用 `position:fixed;pointer-events:none;z-index:9999` canvas 疊在最頂。

---

## 四、最終 Chrome Extension

### 檔案結構

```
ra2-names-ext/
├── manifest.json
├── injected.js     (跑在 page MAIN world,做實際 patch)
├── content.js      (isolated world,訊息中繼)
├── popup.html      (UI)
├── popup.css
├── popup.js
└── icons/
```

### MV3 三層通訊架構

```
popup.html/js  ←—chrome.runtime.sendMessage—→  content.js
                                                    ↓
                                              window.postMessage
                                                    ↓
                                              injected.js (MAIN world)
                                                    ↓
                                              SystemJS / THREE
                                              PipOverlay.prototype
```

為什麼三層必要:

- **popup**:能存 `chrome.storage`、能 `chrome.tabs.sendMessage`,但不在 page 裡
- **content.js**(isolated world):能跟 popup 通訊,但看不到 page 的 `System` / `THREE`
- **injected.js**(MAIN world):看得到 page globals,但不能用 `chrome.*` API

content script 透過 `<script src=chrome.runtime.getURL('injected.js')>` 把 injected.js 注入 MAIN world(需要 `web_accessible_resources` 宣告)。

訊息協定:每個 message 帶 `id`、3 秒 timeout 防 hang。

### popup UI

陽春但乾淨的深色介面:

- 主開關「顯示單位名稱」
- 次開關「也標示既存單位」(主開關關時自動 disable)
- 次開關「顯示畫面外敵人指標」(獨立 toggle,可與名稱標示分開啟用)
- 「套用」按鈕
- 狀態列(尚未連線 / 已連線 / 已啟用 / 無法連線)
- 設定用 `chrome.storage.local` 持久化

### manifest.json 重點

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "scripting", "activeTab"],
  "host_permissions": [...遊戲網域...],
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

## 五、行為總表

### 名稱標示

| 主開關 | 既存單位開關 | 結果                                 |
| ------ | ------------ | ------------------------------------ |
| ON     | OFF          | 新生產的單位有名字;既存單位沒有      |
| ON     | ON           | 全部都有;既存單位在下個 frame 內長出 |
| OFF    | —            | 立刻清掉場上所有 label               |

### 陣營色

| 陣營 | label 底色 |
|------|-----------|
| 敵方 | 紅底 `rgba(160,0,0,0.88)` |
| 自己/盟友 | 藍底 `rgba(0,50,160,0.88)` |
| 未知 | 灰底 `rgba(70,70,70,0.88)` |

### 畫面外指標

| 指標開關 | 結果 |
|---------|------|
| ON | viewport 邊緣出現紅色箭頭指向畫面外敵方單位 |
| OFF | 覆蓋層 canvas 移除,RAF 停止 |

---

## 六、踩過的坑

1. **`System.register` wrap 會觸發 anonymous register error** — 改用 `System.import` 解決
2. **Content script 預設在 isolated world,看不到 page 的 `System`/`THREE`** — 需要 `"world": "MAIN"`(Chrome 102+)或注入 `<script>` 標籤
3. **既存單位無法直接 enumerate** — 因為 PipOverlay 邏輯類沒掛在 scene graph;改用「在 patch 後的 `update()` 第一次跑時判斷標記」的 lazy 策略
4. **清理殘留 label** — Object3D 加 `userData` 標記,借 `WebGLRenderer.render` hook 一個 frame 拿到 scene 後 traverse 清掉
5. **`__unameLblTracked` 未在 `create3DObject` 設定** — patch 後新生成的單位每幀重複呼叫 `resolveTeam`;在 `create3DObject` patch 補上 `this.__unameLblTracked = true` 解決
6. **`new THREE.Vector3()` 在模組頂層執行時 THREE 尚未存在** — 改為 `let _tmpV3 = null` lazy init,在 `drawIndicators` 第一次執行時才建立
7. **指標開關關閉後 RAF ghost frame** — 在 RAF loop 開頭先檢查 `!state.showIndicators` 再決定是否重新排程
8. **`getStatus()` 未回傳 `showIndicators`** — popup 狀態顯示邏輯無法正確反映指標狀態;補上後修正

---

## 七、可擴充方向

- 熱鍵 toggle(全域 keydown 監聽)
- 字型大小 / 顏色客製化(調整 `buildLabel` 裡的 `CanvasUtils.drawText` 參數)
- 只標示某些單位類型(在 `resolveName` 開頭加過濾條件,例如 `if (gameObject.isBuilding()) return null;`)
- 指標顯示距離或單位數量(在 `drawIndicators` 裡 `ctx.fillText`)
- 顯示額外資訊(HP%、距離、coords 等)
