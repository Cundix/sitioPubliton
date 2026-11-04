// stage-controller: decide qué espacio mostrar (hub o uno de los tres escenarios) según el
// estado de la sesión, lo construye, lo conecta con la interfaz espacial y lo libera al cambiar.

import { app } from '../app-context.js';
import { Kit } from '../scenes/scene-kit.js';
import { buildHub } from '../scenes/hub.js';
import { buildSala } from '../scenes/sala.js';
import { buildCliente } from '../scenes/cliente.js';
import { buildAuditorio } from '../scenes/auditorio.js';
import { TeleportPad } from '../scenes/interactives.js';
import { PitchUI } from '../ui/pitch-ui.js';
import { resolveScenario } from '../core/layouts.js';
import { getScenario } from '../config/scenarios.js';
import { S } from '../core/state-machine.js';

const HUB_STATES = [S.LOADING, S.HOME, S.TUTORIAL, S.SELECT];
const POSE_INTERVAL_MS = 50; // las animaciones del público se actualizan ~20 veces por segundo

/** Qué espacio corresponde al estado actual. */
export function environmentFor(session) {
  const state = session.state === S.SETTINGS ? session.data.settingsReturn : session.state;
  if (HUB_STATES.includes(state)) return 'hub';
  return session.data.scenarioId || 'hub';
}

AFRAME.registerComponent('stage-controller', {
  init() {
    this.key = null;
    this.env = null;
    this.root = null;
    this.ui = null;
    this.pads = [];
    this.lastPose = 0;
    this.lastReduced = null;
    app.stage = this; // útil para depurar y para las pruebas automáticas
    this._offs = [
      app.session.on('state', () => this.sync()),
      app.session.on('change', () => this.refreshInteractivity()),
      app.settings.on('change', ({ key }) => { if (key === 'reducedMotion') this.lastPose = 0; }),
    ];
    this.sync();
  },

  remove() {
    this._offs.forEach((off) => off());
    this.teardown();
    if (app.stage === this) app.stage = null;
  },

  sync() {
    const key = environmentFor(app.session);
    if (key === this.key) { this.refreshInteractivity(); return; }
    this.build(key);
  },

  build(key) {
    this.teardown();
    this.key = key;
    const kit = new Kit();
    const onPress = (a) => app.pressAction(a);
    let env;
    if (key === 'hub') {
      env = buildHub(kit, {
        onPick: (id) => app.pressAction({ id: `pick-${id}`, kind: 'choice', event: 'PICK_SCENARIO', payload: { id } }),
        onHover: () => {},
      });
    } else {
      const sc = resolveScenario(getScenario(key));
      const builder = { sala: buildSala, cliente: buildCliente, auditorio: buildAuditorio }[key];
      env = builder(kit, sc, { onPress });
    }

    const root = document.createElement('a-entity');
    root.setAttribute('id', `env-${key}`);
    root.setObject3D('static', kit.group);
    env.entities.forEach((e) => root.appendChild(e));
    env.pads.forEach((pad) => {
      const tp = new TeleportPad(pad, { onTeleport: (p) => app.walk?.teleportTo(p) });
      this.pads.push(tp);
      root.appendChild(tp.root);
    });

    this.ui = new PitchUI({
      parent: root,
      hub: app.hub,
      settings: app.settings,
      onPress,
      onDenied: (a) => app.cues?.play('denied', a),
      anchors: env.anchors,
      getScenarioName: () => app.session.scenario?.name || '',
      getBrief: () => app.session.brief,
      getEnv: () => app.hub.env,
      getHasView: () => env.pads.some((p) => p.id === 'publico'),
    });

    this.kit = kit;
    this.env = env;
    this.root = root;
    this.el.appendChild(root);

    const scene = this.el.sceneEl.object3D;
    scene.background = new AFRAME.THREE.Color(env.background);
    scene.fog = env.fog ? new AFRAME.THREE.Fog(env.fog.color, env.fog.near, env.fog.far) : null;

    app.walk?.blink();
    if (app.walk) app.walk.setEnvironment(env);
    else app.pendingEnv = env;
    this.refreshInteractivity();
    this.lastPose = 0;
    this.el.sceneEl.emit('pitchlab-environment', { key });
  },

  /** Las maquetas del hub solo se pueden elegir en el paso "elegir escenario". */
  refreshInteractivity() {
    if (!this.env?.maquettes) return;
    const selecting = app.session.state === S.SELECT;
    this.env.maquettes.forEach((m) => {
      m.setInteractive(selecting);
      m.setSelected(app.session.data.scenarioId === m.sc.id);
    });
  },

  teardown() {
    this.ui?.dispose();
    this.ui = null;
    this.pads.forEach((p) => p.dispose());
    this.pads = [];
    this.env?.disposers?.forEach((d) => d());
    this.kit?.dispose();
    this.kit = null;
    this.root?.removeObject3D('static');
    this.root?.remove();
    this.root = null;
    this.env = null;
    this.key = null;
  },

  tick(time) {
    if (!this.env?.update) return;
    const reduced = app.settings.get('reducedMotion');
    if (time - this.lastPose < POSE_INTERVAL_MS && reduced === this.lastReduced) return;
    this.lastPose = time;
    this.lastReduced = reduced;
    this.env.update(time / 1000, reduced);
  },
});
