import { ENLACES } from './00-registro.js';
import { $, seedState } from './01-nucleo.js';
import { DataService, SB } from './02-datos.js';
import { Acts, UI, Views, applyTheme, loadUI, render, shell } from './03-interfaz.js';

/* ============================================================ APIH V4 · Arranque ============================================================ */
Acts.sbout = () => { SB.logout(); location.reload(); };   // cerrar sesión (proveedor Supabase)
(async function boot() {
  ENLACES.St = seedState();                       // estado provisional para pintar el shell
  loadUI(); UI.panel = false; UI.navOpen = false;   // panel contextual y menú «Iniciativas» arrancan cerrados; el panel abre al elegir una ficha
  const h = (location.hash || '').replace('#/', ''); if (Views[h]) UI.view = h; if (!Views[UI.view]) UI.view = 'dashboard';
  shell(); applyTheme(); $('#main').innerHTML = V22.skeleton();
  ENLACES.St = await DataService.init();          // SharePoint (Graph/REST) o demo en memoria
  UI.sel = null; shell(); applyTheme(); render();
  try { V22.ready(); } catch (e) { console.error(e); }
  /* avisa si se cierra con cambios sin guardar (demo) o sin sincronizar (SharePoint) */
  window.addEventListener('beforeunload', e => { if (DataService.dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && DataService.svc) DataService.refresh(true); });
})();

