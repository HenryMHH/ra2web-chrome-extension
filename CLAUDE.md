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

`useRa2Snapshots.ts:38-58` load 時過濾掉舊 shape(`hiddenUnits` 欄位)並 console.info 告知 dropped 數量,再覆寫 storage —— **單向遷移**,沒有相容回退。

---

## 六、Chrome Extension 結構

### 檔案(vitesse-webext + Vite 多入口)

```
src/
├── manifest.ts                      # 動態產 manifest.json;RA2_MATCHES 常數集中 host pattern
├── background/
│   ├── main.ts                      # service worker:setIcon listener + tab url 監聽
│   └── contentScriptHMR.ts          # dev-only HMR injection
├── contentScripts/
│   ├── index.ts                     # isolated world：注入 + auto-apply + webext-bridge 中繼
│   ├── views/App.vue                # 內容腳本內掛載的 Vue 元件(若有用)
│   └── utils/{dom,pageBridge}.ts    # injectScript + pageCmd promise wrapper
├── injectedScripts/
│   ├── index.ts                     # IIFE 入口
│   ├── types.ts                     # Team / ApplyOpts / LabelCache / PipOverlayLike
│   ├── state/                       # settings / runtime / tracking / overlay / log
│   ├── system/                      # loader (System.import + CrateGeneratorTrait patch) + three-compat
│   ├── pip/                         # resolvers + PipOverlay.prototype patch
│   ├── label/                       # build / policy / lifecycle / sweep
│   ├── overlay/                     # canvas / indicators / crates / draw RAF
│   ├── rules/enumerate.ts           # enumerateRulesUnits + getUnitNames
│   ├── bridge/                      # commands(apply / status / getUnitNames) + window.postMessage
│   └── __tests__/                   # vitest: resolvers / policy / policy.faction / three-compat / enumerate
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
│   └── powerups.ts                  # CRATE_TYPES + POWERUP_LABELS (sidepanel + injected 共用)
├── logic/
│   ├── storage.ts
│   ├── tab-status.ts                # RA2 hostname 匹配 + updateIcon
│   ├── common-setup.ts
│   └── index.ts
├── styles/                          # unocss + 全域 css
└── types/webext-bridge.d.ts         # popup↔content ProtocolMap

extension/                           # build 產物(勿手動編輯)
├── manifest.json                    # 由 src/manifest.ts 產生
└── dist/{background,contentScripts,injectedScripts,sidepanel,options}/...
```

### Vite 多入口

四個獨立 config:`vite.config.mts`(sidepanel + options)、`vite.config.background.mts`、`vite.config.content.mts`、`vite.config.injected.mts`。Inject script 必須以 IIFE bundle 輸出才能直接塞進 `<script>` 注入到 MAIN world。

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
- **已套用篩選**(`ActiveFilterInfo`):顯示上一次 apply 的模式 / 名稱 / 已顯示計數
- **StatusBar**:`idle | ok | active | error` 四態,Sidepanel mount 時 ping `status` + 監聽 `chrome.tabs.onActivated` 更新

設定持久化:`ra2NamesSettings`(主)、`ra2NamesSnapshots`(快照陣列)。兩支 composable 各自掛 `storage.onChanged` listener,在跨頁修改時即時同步。

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
    "https://ra2web.com/*"
  ],
  "options_ui": { "page": "dist/options/index.html", "open_in_tab": true },
  "background": { "service_worker": "dist/background/index.mjs" },
  "side_panel": { "default_path": "dist/sidepanel/index.html" },      // Chromium
  "sidebar_action": { "default_panel": "dist/sidepanel/index.html" }, // Firefox
  "content_scripts": [{ "matches": RA2_MATCHES, "js": ["dist/contentScripts/index.global.js"], "run_at": "document_idle", "all_frames": true }],
  "web_accessible_resources": [{
    "resources": ["dist/contentScripts/style.css", "dist/injectedScripts/index.global.js"],
    "matches": RA2_MATCHES
  }],
  "content_security_policy": { "extension_pages": "script-src 'self'; object-src 'self'" }
}
```

host pattern apex (`ra2web.com`) 和子網域 (`*.ra2web.com`) 必須分開列 —— MV3 match pattern 的 `*.` 不涵蓋裸網域。

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
