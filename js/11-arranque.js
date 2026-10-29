import { ENLACES } from './00-registro.js';
import { $, seedState } from './01-nucleo.js';
import { DataService, Sesion } from './02-datos.js';
import { Acts, UI, Views, applyTheme, loadUI, render, shell } from './03-interfaz.js';

/* ============================================================ APIH V4 · Arranque ============================================================ */
Acts.sbout = async () => { try { await Sesion.logout(); } catch (e) { } location.reload(); };   // cerrar sesión
(async function boot() {
  ENLACES.St = seedState();                       // estado provisional para pintar el shell
  loadUI(); UI.panel = false; UI.navOpen = false;   // panel contextual y menú «Iniciativas» arrancan cerrados; el panel abre al elegir una ficha
  const h = (location.hash || '').replace('#/', ''); if (Views[h]) UI.view = h; if (!Views[UI.view]) UI.view = 'dashboard';
  shell(); applyTheme(); $('#main').innerHTML = V22.skeleton();
  ENLACES.St = await DataService.init();          // API o demo en memoria
  UI.sel = null; shell(); applyTheme(); render();
  try { V22.ready(); } catch (e) { console.error(e); }
  /* avisa si se cierra con cambios sin guardar (demo) o sin sincronizar (servidor) */
  window.addEventListener('beforeunload', e => { if (DataService.dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && DataService.svc) DataService.refresh(true); });
})();

