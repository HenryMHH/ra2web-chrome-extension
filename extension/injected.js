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
    CanvasUtils: null,
    SpriteUtils: null,
    Coords: null,
    enabled: false,
    showNeutral: false,
    showIndicators: false,
    fontSize: 14,
    patched: false,
    origCreate: null,
    origUpdate: null,
    origDispose: null,
    activeCamera: null,
    alliances: null,
    viewer: null,
    strings: null,
    overlayCanvas: null,
    overlayCtx: null,
    rafId: null,
  };

  async function loadClasses() {
    if (state.PipOverlay && state.CanvasUtils) return true;
    if (typeof System === 'undefined' || !System.import) return false;
    try {
      const [P, CU, SU, CO] = await Promise.all([
        System.import('engine/renderable/entity/PipOverlay'),
        System.import('engine/gfx/CanvasUtils'),
        System.import('engine/gfx/SpriteUtils'),
        System.import('game/Coords'),
      ]);
      state.PipOverlay  = P.PipOverlay;
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
      if (owner.isNeutral) return 'neutral';
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

  function resolveNameFromGo(go) {
    try {
      const rules = go.rules;
      if (!rules) return null;
      const key = rules.uiName;
      if (key && state.strings && typeof state.strings.get === 'function') {
        const v = state.strings.get(key);
        if (v && v !== key) return v;
      }
      return rules.name || null;
    } catch (_) { return null; }
  }

  function buildLabel(self) {
    const name = resolveName(self);
    if (!name) return null;

    const team = resolveTeam(self);
    const bgColor = team === 'enemy'   ? 'rgba(160,0,0,0.88)'
                  : team === 'neutral' ? 'rgba(0,130,50,0.88)'
                  : team === 'unknown' ? 'rgba(70,70,70,0.88)'
                  : 'rgba(0,50,160,0.88)';

    // Build canvas texture (mirrors DebugLabel.createTexture with backgroundColor)
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 0;
    const ctx = canvas.getContext('2d');
    let y = 0;
    for (const line of name.split('\n')) {
      const metrics = state.CanvasUtils.drawText(ctx, line, 0, y, {
        color: 'white',
        backgroundColor: bgColor,
        outlineColor: 'rgba(0,0,0,0.45)',
        outlineWidth: 1,
        fontFamily: "'Fira Sans Condensed', Arial, sans-serif",
        fontSize: state.fontSize,
        fontWeight: '400',
        paddingTop: 3,
        paddingBottom: 3,
        paddingLeft: 5,
        paddingRight: 5,
        autoEnlargeCanvas: true,
      });
      y += metrics.height;
    }

    // Shift content 1px (same post-processing as DebugLabel)
    const w = canvas.width, h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    canvas.width += 1;
    canvas.height += 1;
    ctx.putImageData(imgData, 1, 1);

    const tex = new THREE.Texture(canvas);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    tex.flipY = true;

    // Sprite geometry (same params as DebugLabel.createMesh)
    const Coords = state.Coords;
    const geom = state.SpriteUtils.createSpriteGeometry({
      texture: tex,
      camera: self.camera,
      align: { x: 0, y: -1 },
      offset: { x: 0, y: Coords.ISO_TILE_SIZE / 4 },
      scale: Coords.ISO_WORLD_SCALE,
    });
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 999998;
    mesh.userData.__unameLbl = true;

    return {
      _team: team,
      get3DObject() { return mesh; },
      dispose() { tex.dispose(); mat.dispose(); geom.dispose(); },
    };
  }

  function shouldShowLabel(self) {
    if (!state.enabled) return false;
    const team = resolveTeam(self);
    if (team === 'neutral' && !state.showNeutral) return false;
    return true;
  }

  function attachLabel(self) {
    if (!self.rootObj || self.__unameLbl) return;
    const lbl = buildLabel(self);
    if (!lbl) return;
    self.__unameLbl         = lbl;
    self.__unameLblText     = resolveName(self);
    self.__unameLblOwner    = self.gameObject && self.gameObject.owner;
    self.__unameLblTeam     = lbl._team;
    self.__unameLblFontSize = state.fontSize;
    self.rootObj.add(lbl.get3DObject());
  }

  function refreshLabel(self) {
    if (!self.rootObj) return;
    const newName     = resolveName(self);
    const newOwner    = self.gameObject && self.gameObject.owner;
    const newTeam     = resolveTeam(self);
    const newFontSize = state.fontSize;
    if (newName === self.__unameLblText &&
        newOwner === self.__unameLblOwner &&
        newTeam  === self.__unameLblTeam  &&
        newFontSize === self.__unameLblFontSize) return;
    if (self.__unameLbl) {
      self.rootObj.remove(self.__unameLbl.get3DObject());
      self.__unameLbl.dispose();
      self.__unameLbl = null;
    }
    self.__unameLblText     = newName;
    self.__unameLblOwner    = newOwner;
    self.__unameLblTeam     = newTeam;
    self.__unameLblFontSize = newFontSize;
    if (newName) {
      const lbl = buildLabel(self);
      if (lbl) { self.__unameLbl = lbl; self.rootObj.add(lbl.get3DObject()); }
    }
  }

  function detachLabel(self) {
    if (!self.__unameLbl) return;
    if (self.rootObj) self.rootObj.remove(self.__unameLbl.get3DObject());
    self.__unameLbl.dispose();
    self.__unameLbl         = null;
    self.__unameLblText     = undefined;
    self.__unameLblOwner    = undefined;
    self.__unameLblTeam     = undefined;
    self.__unameLblFontSize = undefined;
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
        this.__unameLblTracked = true;
        if (!state.activeCamera && this.camera) state.activeCamera = this.camera;
        if (!state.alliances && this.alliances) state.alliances = this.alliances;
        if (!state.viewer && this.viewer) state.viewer = this.viewer;
        if (!state.strings && this.strings) state.strings = this.strings;
        if (shouldShowLabel(this)) attachLabel(this);
      } catch (e) { warn('create patch:', e); }
      return ret;
    };

    P.prototype.update = function () {
      const ret = state.origUpdate ? state.origUpdate.apply(this, arguments) : undefined;
      try {
        if (!this.__unameLblTracked) {
          this.__unameLblTracked = true;
          if (!state.activeCamera && this.camera) state.activeCamera = this.camera;
          if (!state.alliances && this.alliances) state.alliances = this.alliances;
          if (!state.viewer && this.viewer) state.viewer = this.viewer;
          if (!state.strings && this.strings) state.strings = this.strings;
        }
        if (!shouldShowLabel(this)) {
          if (this.__unameLbl) detachLabel(this);
          return ret;
        }
        if (!this.__unameLbl) attachLabel(this);
        else refreshLabel(this);
      } catch (e) { warn('update patch:', e); }
      return ret;
    };

    if (state.origDispose) {
      P.prototype.dispose = function () {
        try {
          detachLabel(this);
        } catch (e) { warn('dispose patch:', e); }
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

  function initOverlay() {
    if (state.overlayCanvas) return;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    state.overlayCanvas = canvas;
    state.overlayCtx    = canvas.getContext('2d');
  }

  function removeOverlay() {
    if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
    if (state.overlayCanvas) {
      state.overlayCanvas.remove();
      state.overlayCanvas = null;
      state.overlayCtx    = null;
    }
  }

  let _tmpV3 = null;

  function drawIndicators() {
    if (!state.showIndicators) { state.rafId = null; return; }
    state.rafId = requestAnimationFrame(drawIndicators);
    if (!state.overlayCanvas || !state.activeCamera) return;
    if (!_tmpV3) _tmpV3 = new THREE.Vector3();

    const canvas = state.overlayCanvas;
    const ctx    = state.overlayCtx;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (canvas.width !== W)  canvas.width  = W;
    if (canvas.height !== H) canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const camera     = state.activeCamera;
    const MARGIN     = 24;   // px inset from the viewport edge
    const ARROW_HALF = 10;   // half-length of arrow head

    if (!state.alliances || !state.viewer) return;
    const local = state.viewer.value;
    const cx = W / 2, cy = H / 2;

    for (const player of state.alliances.playerList.players) {
      if (player === local || player.isNeutral || state.alliances.areAllied(player, local)) continue;
      try {
        for (const go of player.getOwnedObjects()) {
          if (go.isDestroyed || !go.position) continue;
          try {
            const wp = go.position.worldPosition;
            _tmpV3.set(wp.x, wp.y, wp.z);
            _tmpV3.project(camera);

            const sx = (_tmpV3.x + 1) / 2 * W;
            const sy = (-_tmpV3.y + 1) / 2 * H;
            if (sx >= MARGIN && sx <= W - MARGIN && sy >= MARGIN && sy <= H - MARGIN) continue;

            const angle = Math.atan2(sy - cy, sx - cx);
            const cos = Math.cos(angle), sin = Math.sin(angle);

            const scaleX = (cos !== 0) ? (W / 2 - MARGIN) / Math.abs(cos) : Infinity;
            const scaleY = (sin !== 0) ? (H / 2 - MARGIN) / Math.abs(sin) : Infinity;
            const scale  = Math.min(scaleX, scaleY);
            const ex = cx + cos * scale;
            const ey = cy + sin * scale;

            ctx.save();
            ctx.translate(ex, ey);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(ARROW_HALF, 0);
            ctx.lineTo(-ARROW_HALF, -ARROW_HALF * 0.6);
            ctx.lineTo(-ARROW_HALF * 0.4, 0);
            ctx.lineTo(-ARROW_HALF, ARROW_HALF * 0.6);
            ctx.closePath();
            ctx.fillStyle   = 'rgba(210,30,30,0.9)';
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth   = 1.5;
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            const goName = resolveNameFromGo(go);
            if (goName) {
              ctx.save();
              const LABEL_FS = 11;
              ctx.font = `600 ${LABEL_FS}px 'Fira Sans Condensed', Arial, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              const PX = 5, PY = 3;
              const tw = ctx.measureText(goName).width;
              const lw = tw + PX * 2;
              const lh = LABEL_FS + PY * 2;
              const lx = Math.max(1, Math.min(ex - lw / 2, W - lw - 1));
              const lyRaw = ey + ARROW_HALF + 4;
              const ly = Math.min(lyRaw, H - lh - 1);
              ctx.fillStyle = 'rgba(210,30,30,0.9)';
              ctx.fillRect(lx, ly, lw, lh);
              ctx.strokeStyle = 'rgba(255,255,255,0.6)';
              ctx.lineWidth = 1;
              ctx.strokeRect(lx, ly, lw, lh);
              ctx.fillStyle = 'white';
              ctx.fillText(goName, lx + lw / 2, ly + PY);
              ctx.restore();
            }
          } catch (_) { /* skip bad go */ }
        }
      } catch (_) { /* skip bad player */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Public commands, called from the content script via postMessage
  // ---------------------------------------------------------------------------
  async function apply({ enabled, showNeutral, showIndicators, fontSize }) {
    state.enabled        = !!enabled;
    state.showNeutral    = !!showNeutral;
    state.showIndicators = !!showIndicators;
    state.fontSize       = (typeof fontSize === 'number' && fontSize >= 10 && fontSize <= 20)
                             ? fontSize
                             : (warn('apply: invalid fontSize', fontSize, '— using 14'), 14);

    const needPatch = state.enabled || state.showIndicators;
    if (needPatch) {
      const ok = await loadClasses();
      if (!ok) return { ok: false, error: 'modules not available' };
      patchPrototype();
    }

    if (state.enabled) {
      log('apply: labels enabled, showNeutral=' + state.showNeutral + ', fontSize=' + state.fontSize);
    } else {
      await sweepLeftoverLabels();
      log('apply: labels disabled, swept');
    }

    if (state.showIndicators) {
      initOverlay();
      if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
      drawIndicators();
      log('apply: indicators enabled');
    } else {
      removeOverlay();
      log('apply: indicators disabled');
    }

    return { ok: true, state: { enabled: state.enabled, showNeutral: state.showNeutral, showIndicators: state.showIndicators, fontSize: state.fontSize } };
  }

  function getStatus() {
    return {
      injected: true,
      patched: state.patched,
      classesReady: !!(state.PipOverlay && state.CanvasUtils && state.SpriteUtils && state.Coords),
      enabled: state.enabled,
      showNeutral: state.showNeutral,
      showIndicators: state.showIndicators,
      fontSize: state.fontSize,
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
