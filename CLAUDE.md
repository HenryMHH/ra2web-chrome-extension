# RA2 Web — 單位名稱顯示 / 陣營色 / 畫面外指標 / 寶箱內容 / 單位篩選 — Chrome Extension 開發紀錄

## 背景

目標：在 ra2web / Chrono Divide(用 three.js + canvas 在瀏覽器執行的 RA2 復刻版)中,以 Chrome Extension 的方式注入下列功能,完全不修改原始檔:

1. 每個單位上方顯示**名稱標籤**(陣營色底、白字)
2. viewport 邊緣顯示**畫面外敵方單位指標**(紅色箭頭 + 名稱)
3. 地圖上顯示**寶箱內容物**(中文標籤)
4. 依單位類型**過濾**要顯示哪些 label(custom / preset 兩種模式)
5. 標籤**字體大小**可調
6. 在玩家列表(遊戲房 / 遊戲中 / 結算)標記**玩家性質**(內建:可靠 / 敵人 / 自私 / 新手;另可在 sidepanel 自訂標籤)
7. sidepanel **匯出 / 匯入設定檔**(設定 + 快照 + 玩家標記 + 自訂標籤,JSON)

來源檔案:`ra2web.min.js`,~4.2MB / ~9.6 萬行 minified JS。

支援的網站變體:

| 變體 | host | bundle | 引擎版本 |
|------|------|--------|----------|
| **ra2web / Chrono Divide** | `ra2web.com` / `chronodivide.com` 系列 | `ra2web.min.js`(SystemJS) | `0.82.0` |
| **werhd** | `wangerhuoda.cn` 系列 | `werhd.min.js`(Vite IIFE) | `0.82.8-r702f21e` |

同遊戲引擎(同 class 名、同 prototype 方法、同 `window.CdApi` 公開 API、同 `window.THREE` r94),不同 bundler。werhd 路徑見 Section 十。

### 執行期依賴版本

| 依賴 | 版本 | 備註 |
|------|------|------|
| three.js | **~r94 (v0.94, 2018-06)** | `Matrix4` 只有 `getInverse(m)`,**沒有** `.invert()`。`.invert()` 是 r123(2021-01)才加;`getInverse` 在 r147(2022-09)被移除。寫任何 THREE API 之前都要先確認 r94 有沒有,或用 feature-detect。|
| 模組載入 | `System.register` / Vite IIFE | ra2web 走 SystemJS(`System.import('engine/...')` 可直接拿模組);werhd 走 Vite,namespace 被 `Object.freeze` 鎖在 IIFE scope 內,要在 `document_start` 攔 `Object.freeze` 拿 class ref。dispatch 由 `location.hostname` 決定,見 Section 十。|

---

## 一、原始碼分析

> 本節描述 ra2web (SystemJS) bundle 的結構。werhd (Vite) bundle 的內部 class 名 / prototype shape 一致,但模組存取方式完全不同,見 Section 十。

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

1. `runtime.gameRef.rules.{infantry,vehicle,aircraft,building}Rules` — 當局實際載入的 rules Map,key 為 `rules.name`,value 為 rule object;displayName 由 `strings.get(rule.uiName)` 解析。**首選**,鎖定當局 rule 集合,且與 `shouldShowLabel` 的比對 key 同字典。
2. `tracking.discoveredUnits` — 從 `PipOverlay.create3DObject` patch 累積的當局實際出場單位。
3. `runtime.strings.data` 的 `name:*` keys — i18n 字典,bundle 內固定,所有局共用。**僅作最後 fallback**,因為多個 rule 共享同一 `uiName` 時(例如 ADOG / DOG / SDOG 共享 `name:DOG`)會合併成單一條目,造成「勾 DOG 不會隱藏 ADOG」這類 mismatch。

`runtime.gameRef` 在 `CrateGeneratorTrait.prototype.init(game)` patch 中捕獲(同一 patch 已用於 `runtime.crateTraitRef`)。

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

> 以下描述 SystemJS 路徑(ra2web)。werhd (Vite) 用獨立的 `document_start` MAIN-world 入口攔 `Object.freeze`,流程不同,見 Section 十。Dispatch 在 `src/injectedScripts/system/loader.ts`,依 hostname 選 SystemJS 或 Vite loader。

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

injected.js 載入即執行 `loadClasses().then(patchPrototype)`,**不等 sidepanel 「套用」**。如此即使使用者在開局後才打開 sidepanel 啟用功能,所有開局時就生成的單位 PipOverlay 也已經被 patch 過、登錄到 `tracking.pipInstances`,可以在 `apply()` 時立即 sweep 補標籤。

### 取得 trait 的 ref

`CrateGeneratorTrait` 在 prototype 上掛兩個攔截:

```js
CGT.prototype.init = function (game) {
  runtime.crateTraitRef = this;           // 標準路徑
  tracking.discoveredUnits.clear();       // 換局時清空已發現單位
  return origInit.apply(this, arguments);
};
CGT.prototype.spawnCrateAt = function () {
  if (!runtime.crateTraitRef) runtime.crateTraitRef = this;  // 開局後才啟用的 fallback
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

### 全局狀態 — 五個模組

執行期狀態切成五個模組,放在 `src/injectedScripts/state/`,沒有單一 `state` 物件:

```ts
// state/settings.ts — 使用者設定(白名單版)
interface Settings {
  enabled: boolean
  showNeutral: boolean
  showAlly: boolean
  showEnemy: boolean
  showIndicators: boolean
  enabledCrateTypes: Set<number>
  fontSize: number
  shownUnits: 'all' | Set<string>   // 大寫 rule name 白名單
}

// state/runtime.ts — SystemJS 取回的 class + 從 PipOverlay instance 採集到的執行期物件
interface Runtime {
  PipOverlay, CanvasUtils, SpriteUtils, Coords, crateTraitRef, gameRef
  activeCamera, alliances, viewer, strings
}

// state/tracking.ts — PipOverlay instance 集合 + label WeakMap + patch flag
interface Tracking {
  patched: boolean
  pipInstances: Set<PipOverlayLike>
  discoveredUnits: Map<string, string>   // 從 create3DObject patch 累積
  lastPipUpdateTime: number
  origCreate, origUpdate, origDispose
}
export const labelCache = new WeakMap<PipOverlayLike, LabelCache>()

// state/overlay.ts — overlay canvas / RAF / sweep promise
// state/log.ts     — TAG / log / warn helper
```

import 規則:消費者各取所需(`import { settings } from '../state/settings'`,`import { runtime } from '../state/runtime'`)。寫新功能時不要把這些再合併回一個物件 —— 分檔的目的是讓每個模組對應一種 lifecycle(設定 vs. 執行期參照 vs. 追蹤集合 vs. overlay 控制 vs. log)。

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
2. 創建 `<canvas>`,用 `runtime.CanvasUtils.drawText` 把每一行畫上去(會 autoEnlarge canvas)
3. 將像素往右下 shift 1px(`putImageData(imgData, 1, 1)`)補一個邊框緩衝,模仿 DebugLabel 的後處理
4. 包成 `THREE.Texture`(NearestFilter, flipY:true, needsUpdate:true)
5. 用 `runtime.SpriteUtils.createSpriteGeometry` 建 sprite geometry(永遠面向相機)
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
settings.enabled 必須開
team === 'neutral' 時 settings.showNeutral 必須開
team === 'ally'    時 settings.showAlly    必須開
team === 'enemy'   時 settings.showEnemy   必須開
settings.shownUnits === 'all'  → 通過
否則 gameObject.rules.name(大寫)必須在 settings.shownUnits 中
```

`update()` patch 每幀檢查;不符就 detach,符合就 attach 或 refresh。

**`'self'` 永遠通過**(不會落到 ally/enemy/neutral 分支),預設 `showAlly` / `showEnemy` 皆 `true`,所以行為與舊版「主開關開 + 中立可選」相容,只是多了 ally / enemy 兩個獨立開關。

### 既存單位的處理 — `pipInstances` 集合

Eager patch 確保所有 `create3DObject` 呼叫都會把 `this` 加進 `tracking.pipInstances`。
為以防萬一 update 看到沒被追蹤的 instance(理論上不該發生)也補登錄。

`apply()` 啟用時:`for (const pip of tracking.pipInstances) attachLabel(pip)` 立即補標籤,不需等下一幀 update。

### Label 移除(關閉功能時)— `sweepLeftoverLabels`

每個 label mesh 都打 `userData.__unameLbl = true`。需要清理時:

1. 借 `THREE.WebGLRenderer.prototype.render` 一個 frame 拿到 scene
2. 從 scene 往上找到 root(可能是 group 而非 scene 本身)
3. `root.traverse(o => userData.__unameLbl && ...)` 收集再移除
4. 呼叫 `__unameLblDisposer` 釋放 GPU 資源
5. 超時 2s fallback(避免卡住)
6. 結束後 `overlayState.sweepPromise = null`(避免並行 sweep)

---

## 四、畫面外指標 + 寶箱 overlay

兩者共用同一 canvas(`overlayState.overlayCanvas`)和同一 RAF loop(`drawOverlay`):

```js
position:fixed; top:0; left:0; pointer-events:none; z-index:9999
```

每幀:
1. `settings.showIndicators || settings.enabledCrateTypes.size > 0` 是否任一啟用,否則停止 RAF
2. 對 canvas 重設大小、清空
3. **若 `lastPipUpdateTime` 超過 2s 沒被更新**(代表遊戲已結束/暫停),保持空白不畫(避免畫到死亡座標)
4. 若 indicators 開:遍歷 `alliances.playerList.players`,過濾非敵方(self / neutral / 盟友)和 `shownUnits` 白名單,對 enemy 單位 `worldPosition.project(camera)` → 螢幕座標
   - 若在 viewport 內(扣掉 24px MARGIN)跳過
   - 否則畫紅色實心箭頭(指向單位)貼在邊緣,並在箭頭旁邊畫單位名稱小標籤
5. 若 crate types 開:呼叫 `drawCrateLabels`,遍歷 `runtime.crateTraitRef.crates`
   - 過濾 `settings.enabledCrateTypes` 有勾選的 powerup type
   - 從 `crate.obj.position.worldPosition`(或 fallback 到 `Coords.tile3dToWorld(tile.rx+0.5, tile.ry+0.5, tile.z)`)取座標,project → 螢幕座標
   - 在寶箱位置上方畫金色標籤(含 powerup 中文名)

### 寶箱 powerup type → 中文

```
0  裝甲↑    1  火力↑    2  基地回復   3  金錢
4  揭示地圖  5  速度↑    6  老兵升級   7  免費單位
8  無敵護盾  11 礦石     13 隱形      14 黑暗霧
15 爆炸     16 核彈     17 燃燒
```

(對應 `POWERUP_LABELS` 和 sidepanel `CRATE_TYPES`,兩處要同步。)

### 共用 `_tmpV3`

`new THREE.Vector3()` 在模組頂層 eval 時 THREE 還沒準備好。`let _tmpV3 = null` 在 `drawOverlay` 第一次執行才 lazy init,後續每次 iteration 開頭 `.set(...)` 覆寫,所以可重複使用。

---

## 五、單位篩選 (sidepanel-side state)

**全面改為白名單**:儲存的是「要顯示哪些單位」,不是「要藏哪些」。舊的 `hiddenUnits` / `hiddenUnitsCustom` 鍵在 load 時被丟棄(legacy snapshot 也是),因為從黑名單反推白名單需要當時的單位清單,做不到無損遷移 —— 直接 reset 成「全部顯示」(`shownUnitsCustom === 'all'`)。

`useRa2Settings.ts` 維護的 shape:

```ts
interface Ra2Settings {
  enabled, showNeutral, showAlly, showEnemy, showIndicators: boolean
  enabledCrateTypes: number[]
  fontSize: number
  shownUnitsCustom: 'all' | string[]   // 大寫 ruleName 陣列;'all' 字面值代表略過 filter
  selectedPresetIndex: number          // -1 = 無
  filterMode: 'custom' | 'preset'
}
```

兩種 filterMode:

| 模式 | 來源 |
|------|------|
| `custom` | `shownUnitsCustom` — 即時編輯狀態,checkbox 清單 |
| `preset` | `snapshots[selectedPresetIndex].shownUnits` — 從 custom 儲存的快照 |

`Sidepanel.vue` 的 `appliedShownUnits` computed 根據 `filterMode` 選來源,送進 `apply()` 時走 `shownUnits` 欄位(注意:injected 側欄位名是 `shownUnits`,popup 側保留 `shownUnitsCustom` 作 draft;`Sidepanel.vue:64-73`)。

### Draft / commit 模型

篩選變更不會即時 apply。`Sidepanel.vue` 維護 `draftFilter`(`shownUnitsCustom`、`filterMode`、`selectedPresetIndex`),只有按下 **套用單位篩選** (`ApplyBar`)才會把 draft 寫回 `settings`、save、send `apply`。`filterDirty` computed 控制按鈕 enable;`CheckAnimation` 在 success 時短暫疊一個打勾動畫上去(`APPLY_SUCCESS_MS = 1600`)。

其他開關(enabled / showAlly / showEnemy / showNeutral / showIndicators / fontSize / enabledCrateTypes)走「instant」路徑 —— `watch` 偵測變化直接 send `apply`,不需要按鈕(`Sidepanel.vue:169-185`)。`suppressInstant` 旗標在 `init` 階段擋掉 mount 那次 watcher 觸發,避免一打開 sidepanel 就 apply 一次。

### 單位清單來源(`getUnitNames` 指令)

優先序見 `src/injectedScripts/rules/enumerate.ts`:

1. **`runtime.gameRef.rules` 的 `{infantry,vehicle,aircraft,building}Rules` Map** — 當局實際載入的規則,key 已是 `rules.name`,值由 `runtime.strings.get(rule.uiName)` 解析。`UnitRow` 第三欄帶 `objectType` 給 UI 分群。
2. **`tracking.discoveredUnits`** — 從 `PipOverlay.create3DObject` patch 累積的當局實際出場單位。
3. **`runtime.strings.data` 的 `name:*` keys** — i18n 字典 fallback,bundle 內固定;多個 rule 共享同一 `uiName` 時會合併。

回傳 `{ units: UnitRow[], source: 'rules' | 'discovered' | 'strings' | 'none' }`。`Sidepanel` 透過 `totalCount` 顯示「已顯示/總數」並驅動 `ActiveFilterInfo`。

排序統一依 displayName,locale `zh-Hant`。

### Snapshots

儲存在 `ra2NamesSnapshots` key,每筆:

```ts
interface Snapshot { name: string; shownUnits: 'all' | string[]; totalCount: number }
```

`useRa2Snapshots.ts:41-58` load 時過濾掉舊 shape(`hiddenUnits` 欄位)並 console.info 告知 dropped 數量,再覆寫 storage —— **單向遷移**,沒有相容回退。

---

## 六、Chrome Extension 結構

### 檔案(vitesse-webext + Vite 多入口)

```
src/
├── manifest.ts                      # 動態產 manifest.json;RA2_MATCHES + VITE_HOST_MATCHES host pattern
├── background/
│   ├── main.ts                      # service worker:setIcon listener + tab url 監聽
│   └── contentScriptHMR.ts          # dev-only HMR injection
├── contentScripts/
│   ├── index.ts                     # isolated world：注入 + auto-apply + webext-bridge 中繼
│   ├── views/App.vue                # 內容腳本內掛載的 Vue 元件(若有用)
│   ├── playerTags/                  # 玩家標記:store / slots / widget / menu / styles / controller(isolated world 直接操作 DOM)
│   └── utils/{dom,pageBridge}.ts    # injectScript + pageCmd promise wrapper
├── earlySniff/                      # ★ document_start MAIN-world 入口,只 attach 到 Vite host
│   └── index.ts                     # hook Object.freeze + stash 到 window.__ra2_runtime + dispatch ra2-runtime-ready
├── injectedScripts/
│   ├── index.ts                     # IIFE 入口
│   ├── types.ts                     # Team / ApplyOpts / LabelCache / PipOverlayLike
│   ├── state/                       # settings / runtime / tracking / overlay / log
│   ├── system/                      # loader 依 hostname dispatch → SystemJS / Vite + 共用 CrateGen patch + three-compat
│   │   ├── loader.ts                # 入口 + isViteHost + VITE_HOST_SUFFIXES dispatch
│   │   ├── loader-systemjs.ts       # ra2web / chronodivide:System.import 路徑
│   │   ├── loader-vite.ts           # werhd:讀 window.__ra2_runtime,等 ra2-runtime-ready event,10s timeout
│   │   ├── patch-crate-trait.ts     # 兩 loader 共用的 CrateGeneratorTrait prototype hook
│   │   └── three-compat.ts          # r94 feature-detect helpers
│   ├── pip/                         # resolvers + PipOverlay.prototype patch
│   ├── label/                       # build / policy / lifecycle / sweep
│   ├── overlay/                     # canvas / indicators / crates / draw RAF
│   ├── rules/enumerate.ts           # enumerateRulesUnits + getUnitNames
│   ├── bridge/                      # commands(apply / status / getUnitNames) + window.postMessage
│   └── __tests__/                   # vitest: resolvers / policy / policy.faction / three-compat / enumerate / loader-dispatch
├── sidepanel/                       # 主 UI(取代舊 popup/)
│   ├── Sidepanel.vue                # 組合所有區塊 + draft/commit logic
│   ├── main.ts / index.html
│   ├── components/
│   │   ├── AppHeader.vue            # title + active indicator + 版本字串
│   │   ├── StatusBar.vue            # 連線狀態列(idle / ok / active / error)
│   │   ├── SettingsSection.vue      # 主開關 + 字級 + ally/enemy/neutral/indicators 副選項
│   │   ├── DisplayUnitNamesRow.vue  # 「顯示單位名稱」開關列
│   │   ├── FontSizeSlider.vue       # 字級拉桿
│   │   ├── IndicatorsRow.vue        # 「畫面外敵人指標」開關
│   │   ├── CrateSection.vue         # 寶箱 type 多選 grid
│   │   ├── FilterSection.vue        # custom / preset 切換 + 清單 + 快照
│   │   ├── GeneralSettingsSection.vue # 「一般設定」accordion(預設收合):玩家標籤 + 設定檔
│   │   ├── PlayerTagSection.vue     # 「玩家標籤」:內建標籤展示 + 自訂標籤新增/編輯/刪除(ID / 文字 / 調色盤)
│   │   ├── ConfigTransferRow.vue    # 設定檔匯出/匯入列(行內確認)
│   │   ├── ApplyBar.vue             # 篩選 commit 按鈕(含 disabled 邏輯)
│   │   ├── CheckAnimation.vue       # ApplyBar success 用的打勾動畫
│   │   ├── ActiveFilterInfo.vue     # 已套用 filter 摘要(模式 / 名稱 / 計數)
│   │   ├── Toast.vue                # 錯誤通知
│   │   └── __tests__/               # 每個 component 對應一支 .test.ts
│   └── __tests__/                   # persistence / saveSnapshot 流程測試
├── options/                         # MV3 options_ui 頁(open_in_tab)
│   ├── Options.vue / main.ts / index.html
├── composables/                     # 共用 composables(從 popup/composables 提升上來)
│   ├── useRa2Settings.ts            # ra2NamesSettings load/save + legacy migration
│   ├── useRa2Snapshots.ts           # ra2NamesSnapshots + legacy snapshot 過濾
│   ├── useCustomPlayerTags.ts       # ra2CustomPlayerTags reactive 清單 + onChanged 同步
│   ├── useRa2Bridge.ts              # webext-bridge sendMessage wrapper
│   ├── useToast.ts                  # 全域 toast 狀態
│   ├── useCurrentUrl.ts             # 監聽當前 tab url(判斷是否在 ra2 頁)
│   ├── useWebExtensionStorage.ts    # 通用 storage ref
│   └── __tests__/                   # useRa2Snapshots / useToast 測試
├── components/
│   ├── Logo.vue / SharedSubtitle.vue
│   └── ui/                          # AppCheckbox / AppCollapsible / AppSlider / AppSwitch / AppTabs
├── constants/
│   ├── gameVersion.ts               # RA2_GAME_VERSION 字串(顯示用)
│   ├── icons.ts                     # action icon path 對應
│   ├── playerTags.ts                # 內建 PLAYER_TAGS + 自訂標籤規則(ID 格式 / 上限 / 調色盤)+ validate / normalize / 對比色
│   └── powerups.ts                  # CRATE_TYPES + POWERUP_LABELS (sidepanel + injected 共用)
├── logic/
│   ├── storage.ts
│   ├── tab-status.ts                # RA2 hostname 匹配 + updateIcon
│   ├── common-setup.ts
│   ├── configTransfer.ts            # 設定檔格式 build/parse/sanitize + storage 讀寫
│   ├── fileIO.ts                    # Blob 下載 + FileReader 讀檔
│   └── index.ts
├── styles/                          # unocss + 全域 css
└── types/webext-bridge.d.ts         # popup↔content ProtocolMap

extension/                           # build 產物(勿手動編輯)
├── manifest.json                    # 由 src/manifest.ts 產生
└── dist/{background,contentScripts,earlySniff,injectedScripts,sidepanel,options}/...
```

### Vite 多入口

五個獨立 config:`vite.config.mts`(sidepanel + options)、`vite.config.background.mts`、`vite.config.content.mts`、`vite.config.injected.mts`、`vite.config.early.mts`(earlySniff,只給 Vite host)。Inject 類 script(`injectedScripts` / `earlySniff`)必須以 IIFE bundle 輸出才能在 MAIN world 直接執行 / 注入。

### 通訊架構

```
sidepanel ── webext-bridge.sendMessage ──▶ contentScript ── window.postMessage ──▶ injected
sidepanel ◀── webext-bridge.onMessage ──── contentScript ◀── window.postMessage (id 回傳) ── injected
contentScript / sidepanel ── runtime.sendMessage{cmd:'setIcon'} ──▶ background ── chrome.action.setIcon
```

content script 收到 injected 發出的 `{__ra2names:'ready'}` 後,自動讀 `chrome.storage.local['ra2NamesSettings']` 並 apply(只要任一功能 on);成功則 ping background 切 active icon(`src/contentScripts/index.ts:22-39`)。

三層必要性:
- **sidepanel**:存得到 `chrome.storage`,送得到 `chrome.tabs.sendMessage`,但不在 page world
- **content script**(isolated world):跟 sidepanel 通訊用 webext-bridge,但看不到 page 的 `System` / `THREE`
- **injected script**(MAIN world):看得到 page globals,但用不到 `chrome.*`
- **earlySniff**(MAIN world,document_start,**僅 Vite host**):必須在 page bundle 跑之前 attach,才來得及攔 `Object.freeze`。見 Section 十。
- **background**:`chrome.action.setIcon` 在 service worker 比較穩,且 sidepanel 關閉時 content script 也能觸發

### 指令協定

content script ↔ injected script:`window.postMessage` 每筆帶 `id` / 3 秒 timeout。
- `apply(opts)` — 套設定;`opts = { enabled, showNeutral, showAlly, showEnemy, showIndicators, enabledCrateTypes, fontSize, shownUnits }`(注意 `shownUnits` 不是 `shownUnitsCustom` —— content script 在 auto-apply 時做 alias,`index.ts:31`)
- `status` — 回報目前狀態(`getStatus()` 多回 `showAlly` / `showEnemy` / `systemAvailable` / `threeAvailable` 等 flag,`bridge/commands.ts:101-116`)
- `getUnitNames` — 回 `{ units: UnitRow[], source: 'rules'|'discovered'|'strings'|'none' }`

### sidepanel UI

- **顯示單位名稱**(主開關) + 副選項「自己 / 盟友 / 敵方 / 中立」 + 字級拉桿(10–20 px,1px 步進)
- **畫面外敵人指標**獨立開關
- **寶箱**:15 種 powerup type 多選 grid(`CrateSection`)
- **篩選**(`FilterSection`):custom / preset tabs;custom 模式 = checkbox 清單 + 搜尋 + 全選/全不選 + 儲存快照;preset 模式 = 快照下拉 + 刪除。**有 `ApplyBar` 提交按鈕**;尚未提交時主開關不會 instant-apply 篩選變更(filter 走 commit,其餘走 instant —— 見 Section 五 draft/commit 說明)
- **一般設定**(`GeneralSettingsSection`,位於單位篩選下方,預設收合):
  - **玩家標籤**:四個內建標籤唯讀展示;自訂標籤可新增(ID / 顯示文字 / 顏色:9 色調色盤 + 原生取色器)、編輯(ID 鎖定,只改文字 / 顏色)、刪除(行內確認,連帶移除指向它的玩家指派)
  - **設定檔**:匯出(下載 JSON)/ 匯入(選檔 → 行內確認 → 覆寫 → 立即 apply)
- **已套用篩選**(`ActiveFilterInfo`):顯示上一次 apply 的模式 / 名稱 / 已顯示計數
- **StatusBar**:`idle | ok | active | error` 四態,Sidepanel mount 時 ping `status` + 監聽 `chrome.tabs.onActivated` 更新

設定持久化:`ra2NamesSettings`(主)、`ra2NamesSnapshots`(快照陣列)——兩支 composable(`useRa2Settings.ts` / `useRa2Snapshots.ts`)各自掛 `storage.onChanged` listener,在跨頁修改時即時同步。`ra2PlayerTags`(玩家標記,`Record<玩家名, PlayerTagId>`)不經 composable,同步走 content script 內的 `store.onTagsChanged`(見第十一節)。`ra2CustomPlayerTags`(自訂標籤定義 `PlayerTagDef[]`)sidepanel 端走 `useCustomPlayerTags`,content script 端走 `store.onCustomTagsChanged`。

### manifest.json 重點

`src/manifest.ts` 動態組裝:

```jsonc
{
  "manifest_version": 3,
  "permissions": ["tabs", "storage", "activeTab", "sidePanel"],
  "host_permissions": [
    "https://game.chronodivide.com/*",
    "https://chronodivide.com/*",
    "https://*.ra2web.com/*",
    "https://ra2web.com/*",
    "https://*.wangerhuoda.cn/*",
    "https://wangerhuoda.cn/*"
  ],
  "options_ui": { "page": "dist/options/index.html", "open_in_tab": true },
  "background": { "service_worker": "dist/background/index.mjs" },
  "side_panel": { "default_path": "dist/sidepanel/index.html" },      // Chromium
  "sidebar_action": { "default_panel": "dist/sidepanel/index.html" }, // Firefox
  "content_scripts": [
    { "matches": RA2_MATCHES,        "js": ["dist/contentScripts/index.global.js"], "run_at": "document_idle",  "all_frames": true },
    { "matches": VITE_HOST_MATCHES,  "js": ["dist/earlySniff/index.global.js"],     "run_at": "document_start", "all_frames": true, "world": "MAIN" }
  ],
  "web_accessible_resources": [{
    "resources": ["dist/contentScripts/style.css", "dist/injectedScripts/index.global.js"],
    "matches": RA2_MATCHES
  }],
  "content_security_policy": { "extension_pages": "script-src 'self'; object-src 'self'" }
}
```

host pattern apex (`ra2web.com` / `wangerhuoda.cn`) 和子網域 (`*.ra2web.com` / `*.wangerhuoda.cn`) 必須分開列 —— MV3 match pattern 的 `*.` 不涵蓋裸網域。

`VITE_HOST_MATCHES` 是 `RA2_MATCHES` 的子集(目前只有 `wangerhuoda.cn` apex + wildcard),用於那條 `world: "MAIN"` + `document_start` 的 earlySniff entry,確保 freeze hook 不會 attach 到 SystemJS host。`world: "MAIN"` 需要 Chrome 102+,Firefox 128+。`earlySniff` 不走 `web_accessible_resources` —— `world: "MAIN"` content script 是 manifest 靜態載入,不是 page 自取資源。

---

## 七、行為總表

### 名稱標示(每個 team 獨立開關)

| `enabled` | `showAlly` | `showEnemy` | `showNeutral` | 顯示哪些 label |
| --------- | ---------- | ----------- | ------------- | --------------- |
| OFF       | —          | —           | —             | **全部 sweep**(無論勾選) |
| ON        | ON         | ON          | ON            | self + ally + enemy + neutral |
| ON        | ON         | ON          | OFF           | self + ally + enemy |
| ON        | OFF        | ON          | —             | self + enemy(+ neutral 視 `showNeutral`) |
| ON        | ON         | OFF         | —             | self + ally(+ neutral 視 `showNeutral`) |
| ON        | OFF        | OFF         | OFF           | 只剩 self |

`'self'` 永遠通過 policy gate;`showAlly` / `showEnemy` 預設為 `true`(`settings.ts:12-21`),所以開啟主開關就會看到「我方 + 盟友 + 敵方」三種。

### 陣營色

| 陣營 | label 底色 |
|------|-----------|
| 敵方 | 紅底 `rgba(160,0,0,0.88)` |
| 自己 / 盟友 | 藍底 `rgba(0,50,160,0.88)` |
| 中立 | 綠底 `rgba(0,130,50,0.88)` |
| 未知 | 灰底 `rgba(70,70,70,0.88)` |

### 畫面外指標

| `showIndicators` | 結果 |
|-----------------|------|
| ON | viewport 邊緣紅色箭頭 + 單位名稱小標籤,指向畫面外敵方單位。**會套用 policy gate** —— `shownUnits` 白名單同樣作用於指標(白名單模式下沒勾的單位也不會被指標標出) |
| OFF | 若寶箱也關 → overlay canvas 移除、RAF 停止 |

### 寶箱

| 已勾選 type 數 | 結果 |
|----------------|------|
| 0 | 不畫寶箱 label |
| ≥ 1 | overlay 中以金色標籤標出對應 powerup type 的寶箱位置(中文名) |

### 單位篩選(`shownUnits` 白名單)

| `settings.shownUnits` | 結果 |
|-----------------------|------|
| `'all'` | 略過白名單檢查,所有(通過 team gate 的)單位都顯示 |
| `Set<string>`(可空) | 只顯示 `gameObject.rules.name.toUpperCase()` 在 Set 中的單位 |

實際送進 injected 的值由 sidepanel 端依 `filterMode` 計算:custom → `shownUnitsCustom`、preset → 快照的 `shownUnits`。

### 字體大小

10–20 px(`AppSlider` 1px 步進)。改動會被 `refreshLabel` 比對偵測,所有現存 label 在下一幀重建。

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
11. **showCrateContents 從 boolean 演進到 enabledCrateTypes 陣列** — `useRa2Settings.normalizeSettings` 仍處理舊 key migration,把舊的全 on boolean 視為「全部 powerup type 勾選」
12. **filter 三層儲存(白名單版)** — `settings.shownUnits`(injected runtime,`'all' | Set<string>`)是執行期最終結果;`shownUnitsCustom`(sidepanel storage,`'all' | string[]`)是 custom 模式編輯狀態;`snapshots[i].shownUnits` 是 preset 來源。`appliedShownUnits` computed 在 sidepanel 端依 `filterMode` 選 custom 或 preset 後送進 `apply()`。三者型別不同(Set vs. array vs. 字面 `'all'`),改 schema 時三處要一起動。
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

16. **黑名單 → 白名單遷移無法無損** — 從 `hiddenUnits` 反推 `shownUnits` 需要「當時的完整單位清單」,但 sidepanel 載入時拿不到當局 rules(injected 還沒 ready)。所以 `useRa2Settings.normalizeSettings` 直接把舊 key 丟掉,重設為 `shownUnitsCustom: 'all'`,並印一條 `console.info` 告知使用者「showing all」。`useRa2Snapshots` 同樣丟棄舊 shape 快照(沒有 `shownUnits` 欄位的)並覆寫 storage —— 單向遷移,沒有 fallback。
17. **draft/commit 模型 vs. instant apply 不對稱** — 篩選有 `ApplyBar` 按鈕(draft),但開關 / 字級 / 寶箱 type 走 instant watcher。原因:篩選變更牽涉清單重編 + label sweep 成本較高,使用者可能連續勾選十幾筆;開關類則希望即時看到效果。共用 `sendApply` 但分 `source: 'instant' | 'filter'` 標記 —— filter 路徑成功後會觸發 `CheckAnimation`(`Sidepanel.vue:147-152`),instant 路徑不會。
18. **`shownUnits` 同名但兩端不同型別** — sidepanel 持久化的是 `shownUnitsCustom: 'all' | string[]`(JSON 友善),injected 執行期持有的是 `settings.shownUnits: 'all' | Set<string>`(查詢 O(1))。轉換在 `bridge/commands.ts:29-37`(injected 收)和 `Sidepanel.vue` `appliedShownUnits` computed(sidepanel 送)兩處發生 —— 改 schema 時兩邊都要動,且 content script 的 auto-apply 路徑會做 `shownUnits: s.shownUnitsCustom ?? 'all'` 的 alias(`contentScripts/index.ts:31`),也要一起改。
19. **per-faction toggle 預設 `true`** — 新增 `showAlly` / `showEnemy` 時,預設值若用 `false` 會讓既有使用者升級後突然看不到大半 label。`normalizeSettings` 用 `raw.showAlly !== false`(預設 true,只有顯式 false 才關)和 settings.ts 的初始值 `true` 共同保證 forward-compat。

20. **Vite bundle 沒有公開的模組 entry** — `System.import` 在 werhd 上不存在,所有 module namespace 都被 `Object.freeze(Object.defineProperty({...}, Symbol.toStringTag, { value: 'Module' }))` 鎖在 IIFE scope 內、外部無路。解法:`document_start` + `world: "MAIN"` 攔 `Object.freeze`,自己讀 namespace 後 stash。詳見 Section 十。content_script 預設的 `document_idle` 太晚,bundle 早就 freeze 完了。

21. **dispatch 用 hostname 而非 `'systemjs' | 'vite'` enum** — 我們選 loader 的依據是 host(`location.hostname`),不是 bundler 種類。bundler 是 host 內部實作細節,將來若再有第三個變體用第三種 bundler,還是看 host 加 suffix。用 enum 會把 host 跟 bundler 偽 1:1 綁死,讓 dispatch 表演技條件混淆。`VITE_HOST_SUFFIXES` 在 `loader.ts` 內,manifest 那邊有相應的 `VITE_HOST_MATCHES`(順序耦合,改一個記得改另一個)。

22. **`endsWith` 的 suffix-trick** — `isViteHost('attacker-wangerhuoda.cn')` 應為 false。寫成 `hostname.endsWith(h)` 會誤命中,必須是 `hostname === h || hostname.endsWith('.' + h)`(加前導點)。`loader-dispatch.test.ts` lock 這個 case。

23. **freeze hook 的 duck-type 驗證不能省** — namespace 含 `PipOverlay` getter 的模組不見得只有一個(re-export / barrel)。直接用 export key 字串命中第一個會冒風險。每個 slot 對應一支 fingerprint:`PipOverlay.prototype.create3DObject`、`CrateGeneratorTrait.prototype.{init,spawnCrateAt}`、`CanvasUtils.drawText`、`SpriteUtils.createSpriteGeometry`、`Coords.tile3dToWorld`。版本升級時這些 method 名若變,validator 抓不到 → loader-vite 10s timeout → apply 回 "modules not available"。

---

## 九、可擴充方向

- 熱鍵 toggle(全域 keydown 監聽)
- 標籤透明度 / 邊框寬度客製化
- 顯示額外資訊(HP%、距離、coords 等)
- 寶箱標籤過期時間或 fade-out 動畫
- 多語系(目前 sidepanel 字串硬編 zh-Hant)
- 匯入/匯出 snapshots(JSON 檔)
- 篩選依「類型」(infantry / vehicle / building / aircraft)而非個別 ruleName

---

## 十、Vite bundle 變體(werhd)支援

### 背景

`staging.wangerhuoda.cn` 及子域提供 ra2 復刻版的另一個變體(代號 werhd)。同遊戲引擎(同 class 名、同 prototype 方法、同 `window.CdApi`、同 `window.THREE` r94),但 bundle 用 **Vite IIFE** 包,不是 SystemJS。引擎版本 `0.82.8-r702f21e`(ra2web 同代是 `0.82.0`)。

### 兩 bundle 比對

| 維度 | ra2web / chronodivide | werhd / wangerhuoda |
|---|---|---|
| 打包器 | SystemJS `System.register` | Vite IIFE |
| 模組存取 | `System.import('engine/...')` 公開 | namespace 凍結在 IIFE scope 內,**外部無 entry** |
| 引擎版本 | `0.82.0` | `0.82.8-r702f21e` |
| `window.THREE` | r94 | r94 |
| `window.CdApi` | ✅(只 expose battleControl / replay,不含 engine internals) | ✅ |
| `PipOverlay` constructor args | 較少 | 18 個(多 `selectionModel` / `flyerHelperOpt` / `hiddenObjectsOpt` / `debugTextEnabled` / `animFactory` / `useSpriteBatching` / `useMeshInstancing` / `persistentHoverTags` / `mapRenderable`) |
| instance 屬性 | `this.gameObject/viewer/alliances/camera/strings` | 同(屬性名一致;werhd 多了 `this.selectionModel` 等但 patch 不碰) |
| `this.viewer.value` 仍用 | ✅ | ✅(`resolveTeam` 不用改) |

constructor 雖增參,但我們只 patch `prototype.{create3DObject,update,dispose}`,不重新 construct,所以 patch 邏輯共用。

### 為什麼需要 freeze hook

Vite 把每個 module namespace 包成:

```js
const SXe = Object.freeze(Object.defineProperty({
  __proto__: null,
  get PipOverlay() { return fXe }
}, Symbol.toStringTag, { value: "Module" }));
```

namespace 變數(`SXe`、`fXe` 等)是 IIFE scope 內 `let`,**外部完全拿不到**。也沒 SystemJS 那種 `System.import(name)` 公開 entry。`window.CdApi` 只 expose battle control / replay 那一層,沒掛 engine internals;`window.r`(DevTools API)只給 `reset`/`help`/`version` 那幾個 command,沒 game state。

唯一可行的路:**在 bundle 跑之前 hook `Object.freeze`**,等 bundle 自己凍 namespace 時攔下來、duck-type 驗證後拿 class ref 出來 stash。

### document_start + MAIN world

content_script 預設 `document_idle` + isolated world,**兩個都不對**:
- `document_idle`:bundle 已 run 完、freeze 都凍完了,hook 沒意義
- isolated world:看不到 page 的 `Object.freeze`

MV3 支援在 manifest 直接宣告 `"run_at": "document_start"` + `"world": "MAIN"`(Chrome 102+ / Firefox 128+)。`src/earlySniff/index.ts` 走這條路。

### 入口分工

| entry | run_at | world | matches | 任務 |
|---|---|---|---|---|
| `dist/contentScripts/index.global.js` | document_idle | isolated | `RA2_MATCHES`(全部 host) | webext-bridge / 注入 `injectedScripts` / auto-apply |
| `dist/earlySniff/index.global.js` | document_start | **MAIN** | `VITE_HOST_MATCHES`(只 wangerhuoda.cn) | freeze hook + class sniff |
| `dist/injectedScripts/index.global.js` | (由 contentScript 注入 `<script>`) | MAIN | — | label / overlay / patch / bridge |

`earlySniff` 與 `injectedScripts` 兩個 MAIN-world entry 共用同一個 `window`,stash 透過 `window.__ra2_runtime` 傳遞,並 dispatch `ra2-runtime-ready` event 通知。

### freeze hook 細節

`src/earlySniff/index.ts`:

```ts
const origFreeze = Object.freeze
Object.freeze = function freezeHook(obj) {
  if (obj?.[Symbol.toStringTag] === 'Module') {
    // 對 PipOverlay / CrateGeneratorTrait / CanvasUtils / SpriteUtils / Coords
    // 做 duck-type 驗證後 stash 進 window.__ra2_runtime
  }
  return origFreeze(obj)
}
```

驗證採嚴格 duck-type(見 Pit #23),避免同名 export 從別處先命中:

| slot | fingerprint |
|---|---|
| `PipOverlay` | `typeof v === 'function' && typeof v.prototype.create3DObject === 'function'` |
| `CrateGeneratorTrait` | `prototype.init` + `prototype.spawnCrateAt` |
| `CanvasUtils` | `typeof v.drawText === 'function'` |
| `SpriteUtils` | `typeof v.createSpriteGeometry === 'function'` |
| `Coords` | `typeof v.tile3dToWorld === 'function'` |

五個全到齊後立即還原 `Object.freeze` 並 dispatch `ra2-runtime-ready` event。30s timeout safety net 還會 unhook 一次(避免長期 perf 負擔 + 若有 slot 漏抓也不會永久 hook 住)。

實際觀察 capture 順序:`Coords → CanvasUtils → CrateGeneratorTrait → SpriteUtils → PipOverlay`,反映 bundle 內部依賴拓樸順序。

### loader dispatch(domain-based)

`src/injectedScripts/system/loader.ts`:

```ts
export const VITE_HOST_SUFFIXES = ['wangerhuoda.cn'] as const

export function isViteHost(hostname: string): boolean {
  return VITE_HOST_SUFFIXES.some(h => hostname === h || hostname.endsWith(`.${h}`))
}

export async function loadClasses() {
  if (runtime.PipOverlay && runtime.CanvasUtils) return true
  return isViteHost(location.hostname) ? loadFromVite() : loadFromSystemJs()
}
```

決策依據是 host(`location.hostname`),不是 bundler 種類。理由見 Pit #21。`isViteHost` 注意 suffix-trick,見 Pit #22;`__tests__/loader-dispatch.test.ts` lock 行為。

### loader-vite 等待邏輯

```ts
async function waitForStash(timeoutMs: number) {
  const present = readStash()
  if (hasAll(present)) return present              // 同步路徑(大部分情況)
  // 否則聽 ra2-runtime-ready event + setTimeout 競賽,先到先贏
}
```

實際 timing:earlySniff 在 document_start 跑、bundle freeze 在 document_loading 中跑、injected.js 在 document_idle 由 contentScript 注入。所以 `loadFromVite` 被呼叫時 stash 多半已 ready,event listener 是 forward-compat 保險(若未來 werhd 把 freeze 延後到 idle 之後)。

### 共用 CrateGeneratorTrait patch

`src/injectedScripts/system/patch-crate-trait.ts` 抽共用 patch。兩個 loader 拿到 class ref 後都呼叫同一支 `patchCrateTrait(CrateGen)`。class shape 兩 bundle 同形(`prototype.init(game)` 捕 `runtime.gameRef`、`prototype.spawnCrateAt` 補捕 fallback ref + 換局清空 `discoveredUnits`)。

### 加新 Vite host 的步驟

1. `src/manifest.ts` 的 `VITE_HOST_MATCHES` 加 host pattern(apex + `*.` 子域兩條)
2. `src/manifest.ts` 的 `RA2_MATCHES` 也要加(共用 host_permissions / 主 content script / WAR)
3. `src/injectedScripts/system/loader.ts` 的 `VITE_HOST_SUFFIXES` 加 hostname(不含 protocol / `*.`)
4. `__tests__/loader-dispatch.test.ts` 加對應 test case
5. `web_accessible_resources` 不用改 —— `world: "MAIN"` 的 content script 不走 WAR

新增 SystemJS host 只動 `RA2_MATCHES`,不需動 dispatch(fallback 路徑)。

### 對 ra2web / chronodivide 的影響

零變動。SystemJS 路徑(`loader-systemjs.ts`)是原 `loader.ts` 邏輯搬位置,無語意改動。manifest 第二條 content_scripts 只 match `wangerhuoda.cn`,不會 attach 到 ra2web。chronodivide 已實機驗證(`apply: labels enabled` + `unit discovered` 等 log 正常)。

### 觀察驗證 log 範本

werhd 開站時 console 預期序列:

```
[ra2-early] freeze hook installed (document_start, MAIN world)
[ra2-early] captured Coords class Vl{...}
[ra2-early] captured CanvasUtils class mF{...}
[ra2-early] captured CrateGeneratorTrait class {...}
[ra2-early] captured SpriteUtils yAe {...}
[ra2-early] captured PipOverlay class Pe{...}
[ra2-early] all targets captured — restoring Object.freeze
[ra2-names] content script loaded
[ra2-names] loader: vite path (host=staging.wangerhuoda.cn)
[ra2-names] CrateGeneratorTrait patched
[ra2-names] PipOverlay.prototype patched
[ra2-names] injected, awaiting commands
```

chronodivide 對照組:

```
[ra2-names] content script loaded
[ra2-names] loader: systemjs path (host=game.chronodivide.com)
[ra2-names] injected, awaiting commands
[ra2-names] CrateGeneratorTrait patched
[ra2-names] PipOverlay.prototype patched
```

(loader log 順序兩邊不同 —— SystemJS 路徑同步、Vite 路徑要等 stash,但 `loadClasses` 都不 block `announceReady`,所以 systemjs 線會看到 `injected, awaiting commands` 早於 `patched` log)

---

## 十一、玩家標記(Player Tags)

- 完全在 **content script(isolated world)** 執行:DOM + `browser.storage` 都拿得到,不經 injected / postMessage。入口 `startPlayerTags()`(`src/contentScripts/playerTags/index.ts`),在 `contentScripts/index.ts` 啟動。
- 偵測三個畫面的名稱格(`slots.ts`):
  - 遊戲中:`.diplo-form td.player-name`
  - 結算:`.score-wrapper td.player-name`
  - 遊戲房:`.player-slots .player-slot:not(.player-slot-header)`,**僅限 `.rank-indicator[data-r-tooltip]` 存在的 slot**(空位「開放 / 關閉」沒有 tooltip);別人是 `div.player-name .select-value > div`,自己是 `input.player-name`(anchor 插在 input 後面、控制項疊在 input 右端)。
- 名稱只取直接子 text node(`ownText`),避免讀到我們 widget 的文字。
- Widget 是 0 寬 `span.ra2pt-anchor` + 絕對定位內容,不改遊戲元素 style。`syncWidget` idempotent(`data-name` / `data-tag` 相同就不動 DOM),`pruneWidgets` 清掉失效 anchor;MutationObserver 過濾自己造成的 mutation,避免無限重掃。
- Dropdown 是 body-level `position:fixed`(`menu.ts`),避開遊戲容器 overflow / z-index;outside mousedown(capture)/ Esc 關閉;同一按鈕再點 = toggle。選單開啟期間按 Esc 會 `e.stopPropagation()` + `e.preventDefault()` 後才 `closeTagMenu()`,避免同一個 Esc 又被遊戲收到(例如把外交畫面也關掉);這個 keydown listener 只在選單開啟時掛著,選單關閉後 Esc 不受影響。
- Storage `ra2PlayerTags`:`Record<玩家名(trim), PlayerTagId>`(內建 id,或符合 `CUSTOM_TAG_ID_RE` 格式的自訂 id),寫入一律 read-modify-write(`all_frames` 下可能多實例)。`onTagsChanged` 讓跨畫面 / 跨分頁即時同步。tag map 一律用 `Object.create(null)` 建構(`normalizeTagMap` / `cloneTagMap`),避免名字剛好是 `constructor`/`toString` 等 `Object.prototype` 成員時查詢誤命中,也讓名字是 `__proto__` 的玩家能正常寫入(一般物件對 `__proto__` 這個 key 走的是 setter,不是一般屬性賦值)。

- **自訂標籤**:定義存在 `ra2CustomPlayerTags`(`{ id, label, bg }[]`,陣列順序 = dropdown 順序,排在四個內建之後)。規則集中在 `constants/playerTags.ts`:ID `/^[a-z0-9][a-z0-9_-]{0,23}$/`、不可與內建相同、label 1–8 字(code point)、顏色 `#rrggbb`、最多 20 個;`normalizeCustomTags` 丟棄(不修補)不合法項目。
- `ra2PlayerTags` 的值只驗 **ID 格式**(`isValidTagId`),不驗定義是否存在。定義存在與否在 `syncWidget` 渲染時用 `getPlayerTag(id, custom)` 判斷;找不到定義 = 視為未標記(顯示「+」且 `data-tag` 為空,點擊開選單而非 `onRemove`)。widget 以 `data-sig`(`label|bg`)偵測同 id 定義變更並重繪;文字色由 `tagTextColor` 依底色亮度選黑 / 白。
- 刪除自訂標籤(`store.deleteCustomTag`)會在**同一次** `storage.local.set` 裡連帶刪除所有指向它的指派;拒絕刪內建 id。編輯不可改 ID(ID 是指派表裡的值)。匯入不做懸空指派清理。
- controller 同時 `loadTags` + `loadCustomTags`,並監聽 `onTagsChanged` / `onCustomTagsChanged`;dropdown 用 `allPlayerTags(customTags)`。

- 限制:名稱為 key,跨伺服器同名視為同一人;`stopPropagation` 只擋冒泡,遊戲若在 capture phase 攔事件仍會收到。

---

## 十二、設定檔匯出 / 匯入

### 檔案格式(v1)

`src/logic/configTransfer.ts` 定義。JSON,四個 section 皆為 optional(存在才代表要匯入該 section):

```json
{
  "format": "ra2web-assistant-config",
  "version": 1,
  "exportedAt": "2026-09-27T12:00:00.000Z",
  "data": {
    "settings": { "...": "Ra2Settings" },
    "snapshots": [{ "name": "...", "shownUnits": "all", "totalCount": 0 }],
    "playerTags": { "玩家名": "reliable" },
    "customPlayerTags": [{ "id": "camper", "label": "蹲家", "bg": "#9333ea" }]
  }
}
```

`format` 必須精確等於 `CONFIG_FILE_FORMAT`(`'ra2web-assistant-config'`),否則整檔拒絕(`NOT_CONFIG` 錯誤)。檔名由 `configFileName(now)` 產生:`ra2web-assistant-config-YYYYMMDD-HHmm.json`。

### Section 覆寫語意

`ConfigData` 四個欄位(`settings` / `snapshots` / `playerTags` / `customPlayerTags`)各自獨立:`parseConfigFile` 只在 JSON 的 `data` 裡**有**該 key 時才填入回傳的 `data` 並把 `ImportSummary` 對應欄位設為非空(`settings: true` / `snapshotCount`、`playerTagCount`、`customTagCount` 為數字);沒有該 key 就整個略過。`confirmImport` → `writeConfigToStorage` 也照這個「有才覆寫」規則逐欄寫入 `browser.storage.local`,檔案裡沒有的 section 完全不動既有 storage。`ImportSummary` 同時驅動 `ConfigTransferRow.vue` 的行內確認文字(「將覆寫目前的:設定、N 個快照、N 個玩家標記、N 個自訂標籤」)。

### Sanitize 規則

`snapshots` / `playerTags` 兩端(匯入 `parseConfigFile`、匯出 `readConfigFromStorage`)共用同一個 normalizer;`settings` 不是——匯出只過 `normalizeSettings`,匯入額外多兩步夾值,兩端結果並不對稱:

- **settings**:`parseConfigFile`(匯入)呼叫私有的 `sanitizeSettings`(`configTransfer.ts:59-68`,唯一呼叫點在 `~108`):先過 `normalizeSettings`(既有的 legacy migration / 預設值邏輯),再夾字級 `fontSize` 到 10–20 並四捨五入,`enabledCrateTypes` 過濾成只保留 `CRATE_TYPES` 白名單內的數字 id(`Set` 去重)。`readConfigFromStorage`(匯出,`~149`)只呼叫裸的 `normalizeSettings`,**不做**這兩步額外夾值——所以匯出的 `fontSize` / `enabledCrateTypes` 就是 storage 裡現有的值,不會被重新 clamp / 過濾
- **snapshots**:兩端都呼叫同一個 `sanitizeSnapshots`,逐筆驗證,不是 plain object、缺 `shownUnits`、`name` 不是非空字串就整筆丟棄(不是整檔失敗);`shownUnits` 過 `normalizeShown`,`totalCount` 非有限數字或負數時 fallback 為 `0`
- **playerTags**:兩端都呼叫同一個 `normalizeTagMap`(`~/contentScripts/playerTags/store`,見第十一節)還原 `Object.create(null)` 不變式
- **customPlayerTags**:兩端都呼叫同一個 `normalizeCustomTags`(`~/constants/playerTags`);非陣列 → 整檔拒絕(`設定檔格式錯誤:customPlayerTags`),陣列內不合法 / 重複 / 撞內建 id 的項目逐筆丟棄。匯入 `playerTags` 但沒帶 `customPlayerTags` 時,指向本機不存在之自訂 id 的指派照樣寫入(渲染時視為未標記)。
- **檔案大小**:`Sidepanel.vue` 的 `pickConfigFile` 先比對 `File.size`(bytes)是否超過 `MAX_CONFIG_FILE_BYTES`(`1_000_000`),超過就直接拒絕、連 `readFileText` 都不呼叫,避免把整個超大檔案讀進記憶體。`parseConfigFile` 內 `text.length`(UTF-16 code unit 數)的檢查留著當 backstop(例如萬一有呼叫端跳過前置檢查直接傳文字進來)
- **`selectedPresetIndex`**:`sanitizeSettings` 額外把它夾成整數且 `>= -1`(`Number.isInteger(i) && i >= -1 ? i : -1`),非整數(如 `0.5`)或小於 `-1`(如 `-7`)一律歸零成 `-1`。`filterMode` 不受影響——只有型別本來就是字面量 union,`normalizeSettings` 的 `raw.filterMode === 'preset' ? 'preset' : 'custom'` 已經是封閉的

### 版本規則

`version` 是數字,`root.version > CONFIG_FILE_VERSION`(目前 `1`)時拒絕匯入並提示「請先更新擴充功能」。等於或小於目前版本才繼續 parse——目前只有 v1,尚未有舊版轉換邏輯;未來若 schema 有不相容變更,升版號並在 `parseConfigFile` 內加對應的舊版轉換分支(見文末提醒)。

加入 `customPlayerTags` section 時**未升版**:它是新增的 optional section,舊 v1 檔沒有此 key 就不動既有 storage,不會產生錯誤資料。較舊版本的擴充功能匯入此格式檔案時,會略過 `customPlayerTags`,且其 `normalizeTagMap` 只認內建 id,自訂標籤的玩家指派會被丟棄(不報錯);擴充功能自動更新下可接受。

### `suppressInstant` + 單次 apply

`Sidepanel.vue` 的 `confirmImport()` 在寫入前把 `suppressInstant = true`,依序 `writeConfigToStorage(data)` → `reloadFromStorage()`(重新 `load()` + `loadSnapshots()`,並重跑「clamp `selectedPresetIndex`」邏輯、同步 `draftFilter`)→ `nextTick()` 才把 `suppressInstant` 放回 `false`。這是因為 `settings` / `snapshots` / `enabledCrateTypes` 等欄位在 `reloadFromStorage` 內會被逐一重新賦值,若不擋著,原本掛在這些欄位上的 instant-apply `watch`(`Sidepanel.vue:259-275`)會在還原過程中被連續觸發好幾次;擋住之後,匯入流程結尾只手動呼叫一次 `sendApply({ source: 'instant' })`,確保「匯入 → 立即 apply」只送一筆 `apply` command,不是欄位數量筆。

### 成功邊界是「寫入 storage + reload」,不是 apply

`confirmImport` 的成功判定**不等 `sendApply` resolve**。`sendApply` 內部經 `useRa2Bridge().apply()` 呼叫 webext-bridge 的 `sendMessage(..., { context: 'content-script', tabId })`,把 command 送去目前 active tab 的 content script。若那個分頁根本不是遊戲頁(或還沒注入 content script),webext-bridge 6.0.1 **不會 reject**——訊息會排進 queue 一直等,永遠不 resolve。若 `confirmImport` 用 `await` 包住這段,`configBusy` 會卡在 `true`,匯出/匯入按鈕永久 disabled,即使 storage 早就寫成功了。

因此 `confirmImport` 把 `writeConfigToStorage` + `reloadFromStorage` + `nextTick()` 視為成功邊界:完成後立刻 `suppressInstant = false`、清空 `pendingImport`、`configBusy = false`、跳出「已匯入設定檔」toast;然後才用 `void sendApply({ source: 'instant' }).catch(() => {})` **不 await** 地把 apply 丟出去——`.catch` 只是防止極端情況下 promise 直接 reject 變成 unhandled rejection,`sendApply` 內部原本就有自己的錯誤 toast / status bar 更新邏輯,失敗與否都不影響匯入本身已成功的事實。若 active tab 不是遊戲頁而使 apply 永遠不 resolve,使用者稍後打開遊戲分頁時,該分頁的 content script 會在收到 `ready` 後自動從 storage 讀設定並 apply(見第六節「指令協定」段落),所以匯入的設定不會遺失,只是不會立刻反映在畫面上。

寫入失敗(`writeConfigToStorage` 或之前的 clamp 邏輯拋出例外)則走 `catch` 分支:顯示「匯入失敗:...」toast,**刻意不清空 `pendingImport`**,讓使用者可以直接重按「確認匯入」重試;`finally` 保證不論成功或失敗都把 `suppressInstant` 和 `configBusy` 收回 `false` / 關閉忙碌狀態。

**額外細節(比原計畫多一步)**:`confirmImport` 在 `writeConfigToStorage` **之前**,若匯入的 `data.settings` 存在,會先把它的 `selectedPresetIndex` 依「匯入後即將存在的快照數」(`data.snapshots ?? snapshots.value`,以匯入檔本身的快照為準,檔案沒帶 snapshots 才 fallback 現有的)夾到 `-1`(若原本的 index 超出範圍)。這一步刻意搬到寫入 storage 之前,而不是留給 `reloadFromStorage` 事後夾:若寫進 storage 的還是未夾過的原始值,`browser.storage.onChanged` 對這次寫入的回呼(在其他分頁/`useRa2Settings` 內的 listener)會在 `suppressInstant` 已經放回 `false` 之後才到達,拿到的又是「與目前記憶體內已夾過的 `settings.value` 不 JSON-相等」的舊值,`useRa2Settings` 的 listener 就會用這筆 echo 覆寫回未夾過的 `settings.value`——等於讓 clamp 被打回原形,還會多觸發一次不受 `suppressInstant`保護的 instant apply。先夾好再寫,確保每一筆 `storage.onChanged` echo 都和記憶體內的 settings JSON-相等,listener 直接 no-op。

這個 clamp 建在一份**本地複製**上(`{ ...p.data, settings: clampedSettings }`),不會回頭改到 `pendingImport.value.data.settings`——若後面 `writeConfigToStorage` 失敗、`catch` 分支保留 `pendingImport` 讓使用者重試,重試按的還是原始未被動過的 pending 物件。

### 未提交 draft 不匯出

`exportConfig()` 呼叫 `readConfigFromStorage()`,直接讀 `browser.storage.local`,**不是**讀 sidepanel 記憶體中的 `settings.value` 或 `draftFilter.value`。所以若使用者在 `FilterSection` 改了 checkbox 但還沒按 `ApplyBar` 的「套用單位篩選」(draft 尚未 commit,見第五節 draft/commit 模型),匯出的檔案裡不會包含這些未提交的變更——匯出的永遠是上一次實際落盤的設定。

### Schema 變更的連動

**新增 storage key,或改動 `Ra2Settings` / `Snapshot` / `PlayerTagMap` 的 schema 時,`configTransfer.ts` 的 `CONFIG_STORAGE_KEYS` 與對應的 sanitize 函式(`sanitizeSettings` / `sanitizeSnapshots` / `normalizeTagMap`)要一起改;`ra2CustomPlayerTags` / `PlayerTagDef` 的 schema 變更同理要連動 `normalizeCustomTags`。若變更不相容(舊檔案匯入會產生錯誤資料而非單純缺欄位),必須升 `CONFIG_FILE_VERSION` 並在 `parseConfigFile` 內加對應的舊版轉換,不能只加欄位就當作向下相容。**
