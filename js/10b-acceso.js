/* =====================================================================
   ACCESO · acciones de sesión propias del ambiente (APIH Prototipo): ingreso con correo corporativo y contraseña
   propia (Supabase Auth), recuperación, alta y cambio de contraseña. En el Corporativo este archivo está vacío
   (Microsoft Entra ID). Junto con 01t-transporte.js, es lo único de js/ que difiere entre ambos (tools/paridad).
   ===================================================================== */
import { esc, icon } from './01-nucleo.js';
import { AuthService, Sesion as SB, PantallaAcceso as SBLogin } from './02-datos.js';
import { Acts, Modal, closePops, render, toast } from './03-interfaz.js';

/* Versión visible en las pantallas de acceso (la etiqueta la define apih-config.js) */
const VER = (b => ({ v: b.v || '', b: b.b || '' }))(window.APIH_BUILD || {});

(function () {
  const sr = (s, p = document) => p.querySelector(s);
  /* opción del menú de la persona (10-extensiones.js la muestra si el ambiente la define) */
  SB.menuExtra = () => `<button data-act="pwchange">${icon('lock', 15)} Cambiar mi contraseña</button>`;
  /* ======================= Login individual (Supabase Auth) ======================= */
  const SB2 = {
    async rest(token, path, opt = {}) {
      const r = await fetch(SB.cfg.url + '/rest/v1/' + path, { method: opt.method || 'GET', headers: Object.assign({ apikey: SB.cfg.anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, opt.headers || {}), body: opt.body });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      const t = r.status === 204 ? '' : await r.text(); return t ? JSON.parse(t) : null;
    },
    async recover(email) {
      const r = await fetch(SB.cfg.url + '/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', headers: { apikey: SB.cfg.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(r.status === 429 ? 'Demasiados intentos; espera unos minutos e inténtalo de nuevo' : (j.msg || j.error_description || 'No se pudo enviar el correo (' + r.status + ')')); }
    },
    async registrar(nombre, email, pw) {
      const r = await fetch(SB.cfg.url + '/auth/v1/signup?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', headers: { apikey: SB.cfg.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw, data: { nombre } }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 429 ? 'Demasiados intentos; espera unos minutos e inténtalo de nuevo' : r.status === 422 && /password|weak/i.test(j.msg || j.error_code || '') ? 'La contraseña es muy débil' : (j.msg || j.error_description || 'No se pudo crear la cuenta (' + r.status + ')'));
      return j;
    },
    async setPassword(token, auth) {
      const r = await fetch(SB.cfg.url + '/auth/v1/user', { method: 'PUT', headers: { apikey: SB.cfg.anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: auth }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(j.msg || j.error_description || ('HTTP ' + r.status)); e.status = r.status; e.code = j.error_code; throw e; }
    },
    /* cambia la contraseña: verifica la actual y luego fija la nueva */
    async cambiar(actual, nueva) {
      try { await SB._auth('password', { email: SB.sess.email, password: actual }); } catch (e) { if ([400, 401, 422].includes(e.status)) throw new Error('La contraseña actual no es correcta'); throw e; }
      try { await SB2.setPassword(await SB.token(), nueva); } catch (e) { throw new Error(e.code === 'same_password' ? 'La contraseña nueva debe ser distinta a la actual' : 'No se pudo cambiar la contraseña: ' + e.message); }
    },
    valida(pw, email) {
      if (String(pw).length < 10) return 'Usa al menos 10 caracteres';
      if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Mezcla letras y números';
      if (String(email).split('@')[0].toLowerCase() === String(pw).toLowerCase()) return 'No uses tu nombre de usuario como contraseña';
      return '';
    },
    fuerza(pw) { let s = 0; if (pw.length >= 10) s++; if (pw.length >= 14) s++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++; return s; }
  };
  (window.V22 = window.V22 || {}).SB2 = SB2;
  SB.login = async function (email, pw, remember) {
    email = String(email || '').trim().toLowerCase();
    if (!email || !pw) throw new Error('Ingresa tu correo y tu contraseña');
    const store = remember ? 'l' : 's', exp = j => Math.floor(Date.now() / 1000) + (j.expires_in || 3600);
    try { const j = await SB._auth('password', { email, password: pw }); SB.sess = { email, access: j.access_token, refresh: j.refresh_token, exp: exp(j), _st: store }; SB.persist(); return {}; }
    catch (e) { if ([400, 401, 422].includes(e.status)) throw new Error('Correo o contraseña incorrectos'); throw e; }
  };
  SBLogin.show = function (msg) {
    if (document.getElementById('sb-login')) { const m = document.getElementById('sb-msg'); if (m && msg) m.textContent = msg; return; }
    const d = document.createElement('div'); d.id = 'sb-login'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Iniciar sesión');
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:var(--bg,#f3f4f6);padding:16px';
    document.body.appendChild(d);
    const paso1 = () => {
      d.innerHTML = `<form class="sb-card" autocomplete="on"><h1>APIH</h1><p class="sb-sub">Portfolio Intelligence Hub</p>
        <label for="sb-mail">Correo corporativo</label><input id="sb-mail" type="email" autocomplete="username" required placeholder="nombre.apellido@aramark.cl">
        <label for="sb-key">Contraseña</label><input id="sb-key" type="password" autocomplete="current-password" required>
        <label class="sb-chk"><input id="sb-rem" type="checkbox"> Recordar en este dispositivo</label>
        <button class="btn pri" id="sb-go" type="submit">Entrar</button><button type="button" class="sb-lnk" id="sb-forgot">¿Olvidaste tu contraseña?</button><button type="button" class="sb-lnk" id="sb-new">¿No tienes cuenta? Crear cuenta</button><p id="sb-msg" role="alert">${msg ? String(msg).replace(/</g, '&lt;') : ''}</p>
        <small>Si olvidaste tu contraseña, escribe tu correo y presiona el enlace: te llegará un correo para crear una nueva.</small><small style="text-align:center;opacity:.6;margin-top:6px">APIH ${VER.v} · ${VER.b}</small></form>`;
      const f = d.querySelector('form'), m = d.querySelector('#sb-msg'), b = d.querySelector('#sb-go');
      d.querySelector('#sb-forgot').addEventListener('click', async () => {
        const em = d.querySelector('#sb-mail').value.trim().toLowerCase(); m.style.color = '#c0392b';
        if (!em) { m.textContent = 'Escribe tu correo corporativo y vuelve a presionar el enlace'; return; }
        m.style.color = ''; m.textContent = 'Enviando…';
        try { await SB2.recover(em); m.textContent = 'Si el correo está autorizado, te llegará un enlace para crear tu contraseña.'; } catch (e) { m.style.color = '#c0392b'; m.textContent = e.message; }
      });
      d.querySelector('#sb-new').addEventListener('click', () => paso2());
      f.addEventListener('submit', async ev => {
        ev.preventDefault(); b.disabled = true; m.style.color = ''; m.textContent = 'Verificando…';
        try { await SB.login(d.querySelector('#sb-mail').value, d.querySelector('#sb-key').value, d.querySelector('#sb-rem').checked); location.reload(); }
        catch (e) { m.style.color = '#c0392b'; m.textContent = e.message; b.disabled = false; }
      });
      setTimeout(() => { const i = d.querySelector('#sb-mail'); if (i) i.focus(); }, 50);
    };
    /* crear cuenta: queda pendiente hasta que Administra le asigne un rol */
    const paso2 = () => {
      d.innerHTML = `<form class="sb-card" autocomplete="on"><h2>Crear cuenta</h2><p class="sb-sub">Tu cuenta quedará pendiente hasta que un administrador te asigne un rol.</p>
        <label for="sb-nom">Nombre y apellido</label><input id="sb-nom" autocomplete="name" required>
        <label for="sb-mail">Correo</label><input id="sb-mail" type="email" autocomplete="username" required>
        <label for="sb-n1">Contraseña</label><input id="sb-n1" type="password" autocomplete="new-password" required><div class="sb-str"><i id="sb-bar"></i></div>
        <label for="sb-n2">Repítela</label><input id="sb-n2" type="password" autocomplete="new-password" required>
        <small>Mínimo 10 caracteres, con letras y números.</small><button class="btn pri" id="sb-go" type="submit">Crear cuenta</button><button type="button" class="sb-lnk" id="sb-back">Ya tengo cuenta: entrar</button><p id="sb-msg" role="alert"></p></form>`;
      const f = d.querySelector('form'), m = d.querySelector('#sb-msg'), b = d.querySelector('#sb-go'), n1 = d.querySelector('#sb-n1'), bar = d.querySelector('#sb-bar');
      d.querySelector('#sb-back').addEventListener('click', () => paso1());
      n1.addEventListener('input', () => { const s = SB2.fuerza(n1.value); bar.style.width = s * 20 + '%'; bar.style.background = s < 3 ? '#c0392b' : s < 4 ? '#F2A100' : '#107C10'; });
      f.addEventListener('submit', async ev => {
        ev.preventDefault(); m.style.color = '#c0392b';
        const nom = d.querySelector('#sb-nom').value.trim(), em = d.querySelector('#sb-mail').value.trim().toLowerCase(), pw = n1.value;
        if (!nom) { m.textContent = 'Escribe tu nombre'; return; }
        const err = SB2.valida(pw, em); if (err) { m.textContent = err; return; } if (pw !== d.querySelector('#sb-n2').value) { m.textContent = 'Las contraseñas no coinciden'; return; }
        b.disabled = true; m.style.color = ''; m.textContent = 'Creando cuenta…';
        try {
          const j = await SB2.registrar(nom, em, pw);
          if (j.access_token) { SB.sess = { email: em, access: j.access_token, refresh: j.refresh_token, exp: Math.floor(Date.now() / 1000) + (j.expires_in || 3600), _st: 's' }; SB.persist(); location.reload(); return; }
          m.textContent = 'Cuenta creada. Revisa tu correo para confirmarla y luego entra con tu contraseña. Un administrador te asignará un rol.';
        } catch (e) { m.style.color = '#c0392b'; m.textContent = e.message; b.disabled = false; }
      });
      setTimeout(() => { const i = d.querySelector('#sb-nom'); if (i) i.focus(); }, 50);
    };
    /* llegada desde el correo de recuperación: #access_token=…&type=recovery */
    const paso3 = () => {
      const q = new URLSearchParams(location.hash.slice(1)), tk = q.get('access_token'), rf = q.get('refresh_token'); let em = '';
      let ex = 0, okTk = false;   // S-19: el token debe ser un JWT no vencido
      try { const pl = JSON.parse(atob(tk.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); em = String(pl.email || '').toLowerCase(); ex = +pl.exp || 0; okTk = tk.split('.').length === 3; } catch (e) { }
      if (!okTk || !rf || (ex && ex * 1000 < Date.now())) { location.hash = ''; setTimeout(paso1, 0); return; }
      d.innerHTML = `<form class="sb-card" autocomplete="off"><h2>Crea tu contraseña</h2><p class="sb-note">${em ? esc(em) : ''}</p>
        <label for="sb-n1">Contraseña nueva</label><input id="sb-n1" type="password" autocomplete="new-password" required><div class="sb-str"><i id="sb-bar"></i></div>
        <label for="sb-n2">Repítela</label><input id="sb-n2" type="password" autocomplete="new-password" required>
        <small>Mínimo 10 caracteres, con letras y números.</small><button class="btn pri" id="sb-go" type="submit">Guardar y entrar</button><p id="sb-msg" role="alert"></p><small style="text-align:center;opacity:.6">APIH ${VER.v} · ${VER.b}</small></form>`;
      const f = d.querySelector('form'), m = d.querySelector('#sb-msg'), b = d.querySelector('#sb-go'), n1 = d.querySelector('#sb-n1'), n2 = d.querySelector('#sb-n2'), bar = d.querySelector('#sb-bar');
      n1.addEventListener('input', () => { const s = SB2.fuerza(n1.value); bar.style.width = s * 20 + '%'; bar.style.background = s < 3 ? '#c0392b' : s < 4 ? '#F2A100' : '#107C10'; });
      f.addEventListener('submit', async ev => {
        ev.preventDefault(); m.style.color = '#c0392b';
        if (!tk || !em) { m.textContent = 'El enlace no es válido o expiró. Pide uno nuevo.'; return; }
        const err = SB2.valida(n1.value, em); if (err) { m.textContent = err; return; } if (n1.value !== n2.value) { m.textContent = 'Las contraseñas no coinciden'; return; }
        b.disabled = true; m.style.color = ''; m.textContent = 'Guardando…';
        try {
          await SB2.setPassword(tk, n1.value);
          SB.sess = { email: em, access: tk, refresh: rf, exp: Math.floor(Date.now() / 1000) + (+q.get('expires_in') || 3600), _st: 's' }; SB.persist();
          history.replaceState(null, '', location.pathname + location.search); location.reload();
        } catch (e) { m.style.color = '#c0392b'; m.textContent = e.code === 'same_password' ? 'La contraseña nueva debe ser distinta a la anterior' : e.message; b.disabled = false; }
      });
      setTimeout(() => n1.focus(), 50);
    };
    if (/type=recovery/.test(location.hash)) paso3(); else paso1();
  };
  /* cuenta sin rol: pantalla de espera (cubre la aplicación; no se ve ningún dato) */
  SBLogin.espera = function (estado, email) {
    if (document.getElementById('sb-espera')) return;
    const d = document.createElement('div'); d.id = 'sb-espera'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Cuenta pendiente');
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:var(--bg,#f3f4f6);padding:16px';
    const em = email || (SB.sess && SB.sess.email) || '';
    d.innerHTML = `<div class="sb-card"><h1>APIH</h1>${estado === 'inactivo'
      ? `<h2>Acceso desactivado</h2><p class="sb-sub">${esc(em)}</p><p>Tu acceso no está habilitado. Si crees que es un error, pide a un administrador que lo revise.</p>`
      : `<h2>Cuenta pendiente</h2><p class="sb-sub">${esc(em)}</p><p>Tu cuenta fue creada y está esperando que un administrador te asigne un rol. Cuando lo haga, presiona «Revisar de nuevo».</p>`}
      <button class="btn pri" id="sb-re">Revisar de nuevo</button><button type="button" class="sb-lnk" id="sb-out">Cerrar sesión</button></div>`;
    document.body.appendChild(d);
    d.querySelector('#sb-re').addEventListener('click', () => location.reload());
    d.querySelector('#sb-out').addEventListener('click', () => { SB.logout(); location.reload(); });
  };
  /* cambiar mi contraseña */
  Acts.pwchange = () => {
    if (!(SB.sess && AuthService.provider === 'supabase')) return toast('El cambio de contraseña aplica al acceso con Supabase', 'err');
    closePops();
    Modal.open({ title: 'Cambiar mi contraseña', body: `<div class="v22-f"><p class="mut" style="margin:0 0 6px;line-height:1.45">Solo tú conoces tu contraseña. Si la olvidas, puedes pedir un enlace por correo desde la pantalla de acceso.</p>
      <label for="pw0">Contraseña actual</label><input id="pw0" type="password" autocomplete="current-password" style="width:100%">
      <label for="pw1">Contraseña nueva</label><input id="pw1" type="password" autocomplete="new-password" style="width:100%"><label for="pw2">Repite la nueva</label><input id="pw2" type="password" autocomplete="new-password" style="width:100%"><small>Mínimo 10 caracteres, con letras y números.</small><p id="pwmsg" role="alert" style="color:var(--red);min-height:18px;margin:6px 0 0"></p></div>`,
      footer: `<button class="btn" data-act="mclose">Cancelar</button><button class="btn pri" data-act="pwsave" id="pwgo">Guardar contraseña</button>` });
  };
  Acts.pwsave = async () => {
    const m = sr('#pwmsg'), v = id => (sr(id) || {}).value || '', b = sr('#pwgo'); m.textContent = '';
    const err = SB2.valida(v('#pw1'), SB.sess.email); if (err) { m.textContent = err; return; } if (v('#pw1') !== v('#pw2')) { m.textContent = 'Las contraseñas no coinciden'; return; }
    if (!v('#pw0')) { m.textContent = 'Escribe tu contraseña actual'; return; }
    b.disabled = true; m.style.color = 'var(--tx2)'; m.textContent = 'Guardando…';
    try { await SB2.cambiar(v('#pw0'), v('#pw1')); Modal.close(); toast('Contraseña actualizada'); render(); }
    catch (e) { m.style.color = 'var(--red)'; m.textContent = e.message; b.disabled = false; }
  };
})();
