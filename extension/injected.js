// Injected into the page's MAIN world. Has access to `System` and `THREE`.
//
// Communicates with the content script via window.postMessage. The content
// script listens with window.addEventListener('message') and bridges to the
// popup via chrome.runtime.

(() => {
  const TAG = '[ra2-names]';
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  if (window.__ra2NamesInstalled) {
    log('already injected, skipping'); return;
  }
  window.__ra2NamesInstalled = true;

  const state = {
    PipOverlay: null,
    DebugLabel: null,
    CanvasUtils: null,
    SpriteUtils: null,
    Coords: null,
    enabled: false,
    labelExisting: false,
    showIndicators: false,
    patched: false,
    origCreate: null,
    origUpdate: null,
    origDispose: null,
    enemyInstances: new Set(),
    activeCamera: null,
    overlayCanvas: null,
    overlayCtx: null,
    rafId: null,
  };

  async function loadClasses() {
    if (state.PipOverlay && state.CanvasUtils) return true;
    if (typeof System === 'undefined' || !System.import) return false;
    try {
      const [P, L, CU, SU, CO] = await Promise.all([
        System.import('engine/renderable/entity/PipOverlay'),
        System.import('engine/renderable/entity/unit/DebugLabel'),
        System.import('engine/gfx/CanvasUtils'),
        System.import('engine/gfx/SpriteUtils'),
        System.import('game/Coords'),
      ]);
      state.PipOverlay  = P.PipOverlay;
      state.DebugLabel  = L.DebugLabel;
      state.CanvasUtils = CU.CanvasUtils;
      state.SpriteUtils = SU.SpriteUtils;
      state.Coords      = CO.Coords;
      return !!(state.PipOverlay && state.CanvasUtils && state.SpriteUtils && state.Coords);
    } catch (e) {
      warn('System.import failed:', e); return false;
    }
  }

  function resolveTeam(self) {
    try {
      const local = self.viewer && self.viewer.value;
      const owner = self.gameObject && self.gameObject.owner;
      if (!local || !owner) return 'unknown';
      if (owner === local) return 'self';
      if (self.alliances && self.alliances.areAllied(owner, local)) return 'ally';
      return 'enemy';
    } catch (_) { return 'unknown'; }
  }

  function resolveName(self) {
    try {
      const rules = self.gameObject && self.gameObject.rules;
      if (!rules) return null;
      const key = rules.uiName;
      if (key && self.strings && typeof self.strings.get === 'function') {
        const v = self.strings.get(key);
        if (v && v !== key) return v;
      }
      return rules.name || null;
    } catch (_) { return null; }
  }

  function ownerColorHex(self) {
    try { return self.gameObject.owner.color.asHex(); }
    catch (_) { return '#ffffff'; }
  }

  function buildLabel(self) {
    const name = resolveName(self);
    if (!name) return null;
    const lbl = new state.DebugLabel(name, ownerColorHex(self), self.camera);
    lbl.create3DObject();
    const o = lbl.get3DObject();
    if (o) {
      o.renderOrder = 999998;
      o.userData.__unameLbl = true;
    }
    return lbl;
  }

  function attachLabel(self) {
    if (!self.rootObj || self.__unameLbl) return;
    const lbl = buildLabel(self);
    if (!lbl) return;
    self.__unameLbl = lbl;
    self.__unameLblText = resolveName(self);
    self.__unameLblOwner = self.gameObject && self.gameObject.owner;
    self.rootObj.add(lbl.get3DObject());
  }

  function refreshLabel(self) {
    if (!self.rootObj) return;
    const newName = resolveName(self);
    const newOwner = self.gameObject && self.gameObject.owner;
    if (newName === self.__unameLblText && newOwner === self.__unameLblOwner) return;
    if (self.__unameLbl) {
      self.rootObj.remove(self.__unameLbl.get3DObject());
      self.__unameLbl.dispose();
      self.__unameLbl = null;
    }
    self.__unameLblText = newName;
    self.__unameLblOwner = newOwner;
    if (newName) {
      const lbl = buildLabel(self);
      if (lbl) { self.__unameLbl = lbl; self.rootObj.add(lbl.get3DObject()); }
    }
  }

  function detachLabel(self) {
    if (!self.__unameLbl) return;
    if (self.rootObj) self.rootObj.remove(self.__unameLbl.get3DObject());
    self.__unameLbl.dispose();
    self.__unameLbl = null;
    self.__unameLblText = undefined;
    self.__unameLblOwner = undefined;
  }

  function patchPrototype() {
    if (state.patched) return;
    const P = state.PipOverlay;
    state.origCreate  = P.prototype.create3DObject;
    state.origUpdate  = P.prototype.update;
    state.origDispose = P.prototype.dispose;

    P.prototype.create3DObject = function () {
      const ret = state.origCreate.apply(this, arguments);
      try {
        this.__unameLblBornHere = true;
        if (state.enabled) attachLabel(this);
      } catch (e) { warn('create patch:', e); }
      return ret;
    };

    P.prototype.update = function () {
      const ret = state.origUpdate ? state.origUpdate.apply(this, arguments) : undefined;
      try {
        if (!state.enabled) return ret;
        const isExisting = !this.__unameLblBornHere;
        if (isExisting && !state.labelExisting) return ret;
        if (isExisting && !this.__unameLbl) attachLabel(this);
        else refreshLabel(this);
      } catch (e) { warn('update patch:', e); }
      return ret;
    };

    if (state.origDispose) {
      P.prototype.dispose = function () {
        try { detachLabel(this); }
        catch (e) { warn('dispose patch:', e); }
        return state.origDispose.apply(this, arguments);
      };
    }

    state.patched = true;
    log('PipOverlay.prototype patched');
  }

  // Sweep label Object3Ds out of the live three.js scene by piggybacking on
  // the next WebGLRenderer.prototype.render call.
  function sweepLeftoverLabels() {
    if (typeof THREE === 'undefined' || !THREE.WebGLRenderer) return Promise.resolve(0);
    return new Promise(resolve => {
      const origRender = THREE.WebGLRenderer.prototype.render;
      let done = false;
      THREE.WebGLRenderer.prototype.render = function (scene, camera) {
        if (!done) {
          done = true;
          THREE.WebGLRenderer.prototype.render = origRender;
          try {
            let root = scene;
            if (root && !root.isScene) {
              let n = root; while (n.parent) n = n.parent; root = n;
            }
            let removed = 0;
            if (root) {
              const victims = [];
              root.traverse(o => { if (o && o.userData && o.userData.__unameLbl) victims.push(o); });
              victims.forEach(o => { if (o.parent) o.parent.remove(o); removed++; });
            }
            resolve(removed);
          } catch (e) { warn('sweep failed:', e); resolve(0); }
        }
        return origRender.apply(this, arguments);
      };
      setTimeout(() => { if (!done) { THREE.WebGLRenderer.prototype.render = origRender; resolve(0); } }, 2000);
    });
  }

  // ---------------------------------------------------------------------------
  // Public commands, called from the content script via postMessage
  // ---------------------------------------------------------------------------
  async function apply({ enabled, labelExisting }) {
    state.enabled = !!enabled;
    state.labelExisting = !!labelExisting;
    if (state.enabled) {
      const ok = await loadClasses();
      if (!ok) return { ok: false, error: 'modules not available' };
      patchPrototype();
      log('apply: enabled, labelExisting=' + state.labelExisting);
    } else {
      // disabled: keep the patch in place but it becomes a no-op (cheap),
      // and sweep visible labels off the field for instant feedback.
      await sweepLeftoverLabels();
      log('apply: disabled, swept labels');
    }
    return { ok: true, state: { enabled: state.enabled, labelExisting: state.labelExisting } };
  }

  function getStatus() {
    return {
      injected: true,
      patched: state.patched,
      classesReady: !!(state.PipOverlay && state.CanvasUtils),
      enabled: state.enabled,
      labelExisting: state.labelExisting,
      systemAvailable: typeof System !== 'undefined' && !!System.import,
      threeAvailable: typeof THREE !== 'undefined' && !!THREE.WebGLRenderer,
    };
  }

  // Listen for commands from the content script
  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return;
    const msg = ev.data;
    if (!msg || msg.__ra2names !== 'cmd') return;
    let result;
    try {
      if (msg.cmd === 'apply')      result = await apply(msg.opts || {});
      else if (msg.cmd === 'status') result = getStatus();
      else                          result = { ok: false, error: 'unknown cmd' };
    } catch (e) {
      result = { ok: false, error: String(e && e.message || e) };
    }
    window.postMessage({ __ra2names: 'res', id: msg.id, result }, '*');
  });

  // Announce that the page-side is ready
  window.postMessage({ __ra2names: 'ready' }, '*');
  log('injected, awaiting commands');
})();
