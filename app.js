// app.js - Versión Estabilizada con Selector Inteligente de Hermanos e Iconos SVG
const URL_API_SHEETS = "https://script.google.com/macros/s/AKfycbw0Vt1KuZyBTeJtLuuy7BV6nF2v_PpVDMy_DpD7o6iL8gxsZ1aSDCcjUsyUOb0m_ouVbQ/exec";

let baseDatosCompleta = [];
let listaHermanosPool = [];
let territoriosSeleccionados = []; 
let vistaActual = "disponibles"; 
let tipoUsuario = ""; 
let grupoFiltro = null;
let idHermanoUrl = null;
let diccionarioGruposHermanos = {};
let criterioOrdenacionAsignados = "territorio"; 

async function inicializarPantalla(tipo) {
  tipoUsuario = tipo;
  configurarTemaInicial();
  
  const parametros = new URLSearchParams(window.location.search);
  grupoFiltro = parametros.get("grupo");
  idHermanoUrl = parametros.get("id");
  
  if (!grupoFiltro && tipoUsuario === "encargado") {
    document.body.innerHTML = "<div style='padding:40px; text-align:center; font-family:sans-serif;'><h2>🚨 Error de Acceso</h2><p style='color:gray; margin-top:10px;'>Falta especificar el número de grupo (?grupo=1)</p></div>";
    return;
  }
  
  await descargarDatosDesdeSheets();
}

function descargarDatosDesdeSheets() {
  return new Promise((resolve, reject) => {
    const nombreCallback = "googleSheetsCallback_" + new Date().getTime();
    
    window[nombreCallback] = function(datos) {
      if (datos.error) {
        document.body.innerHTML = `<div style="padding:40px; color:#ff3b30; font-family:sans-serif; text-align:center;">🚨 <b>Error:</b><br>${datos.mensaje}</div>`;
        return;
      }

      baseDatosCompleta = datos;
      territoriosSeleccionados = [];
      actualizarPanelAsignacionFlotante();
      
      if (baseDatosCompleta.length > 0) {
        procesarFechasYBarras(baseDatosCompleta[0].inicio, baseDatosCompleta[0].fin);
        
        const campanaNombre = baseDatosCompleta[0].campana || "Campaña Activa";
        if (document.getElementById("txt-campana-titulo")) {
          document.getElementById("txt-campana-titulo").innerText = campanaNombre;
        }

        // Recuperamos el diccionario inteligente de hermanos del código que sí funcionaba
        diccionarioGruposHermanos = baseDatosCompleta[0].grupoRealHermano || {};
        extraerNombresDeHermanos();
      }
      
      if (tipoUsuario === "encargado") {
        if (document.getElementById("txt-grupo-sub")) {
          document.getElementById("txt-grupo-sub").innerText = `Grupo ${grupoFiltro}`;
        }
        actualizarAnillosEstadisticos();
        filtrarYRenderizar();
      } else if (tipoUsuario === "hermano") {
        filtrarYRenderizarHermano();
      }
      
      const elScript = document.getElementById(nombreCallback);
      if (elScript) elScript.remove();
      delete window[nombreCallback];
      resolve();
    };

    const script = document.createElement("script");
    script.id = nombreCallback;
    script.src = `${URL_API_SHEETS}?accion=leerDatos&callback=${nombreCallback}`;
    script.onerror = () => { console.error("Fallo de red"); reject(); };
    document.body.appendChild(script);
  });
}

// Adaptación de la función del código original que cargaba los listados perfectamente
function extraerNombresDeHermanos() {
  let listado = Object.keys(diccionarioGruposHermanos);
  
  if (listado.length === 0) {
    baseDatosCompleta.forEach(m => {
      if (m.hermano && m.hermano.trim() !== "") {
        const n = m.hermano.trim();
        if (!listado.includes(n)) listado.push(n);
      }
    });
  }
  
  listaHermanosPool = listado.sort((a, b) => {
    const grupoA = diccionarioGruposHermanos[a] ? String(diccionarioGruposHermanos[a]).trim() : "";
    const grupoB = diccionarioGruposHermanos[b] ? String(diccionarioGruposHermanos[b]).trim() : "";
    const grupoActualStr = String(grupoFiltro).trim();

    if (grupoA === grupoActualStr && grupoB !== grupoActualStr) return -1;
    if (grupoA !== grupoActualStr && grupoB === grupoActualStr) return 1;
    return a.localeCompare(b);
  });
  
  const selectorUnico = document.getElementById("sel-hermano-unico");
  if (!selectorUnico) return;
  
  selectorUnico.innerHTML = '<option value="">Seleccionar Hermano...</option>';
  listaHermanosPool.forEach(nombre => {
    const opt = document.createElement("option");
    opt.value = nombre;
    
    const grupoH = diccionarioGruposHermanos[nombre] ? String(diccionarioGruposHermanos[nombre]).trim() : "";
    const esDeEsteGrupo = grupoH === String(grupoFiltro).trim();
    
    // Muestra discretamente un puntito para priorizar los hermanos asignados a este grupo específico
    opt.innerText = esDeEsteGrupo ? `● ${nombre} (G. ${grupoFiltro})` : nombre;
    selectorUnico.appendChild(opt);
  });
}

function procesarFechasYBarras(inicioStr, finStr) {
  if (!inicioStr || !finStr) return;
  const ahora = new Date();
  const fin = new Date(finStr);
  const inicio = new Date(inicioStr);
  
  const tiempoTotal = fin - inicio;
  const tiempoTranscurrido = ahora - inicio;
  let porcentaje = Math.floor((tiempoTranscurrido / tiempoTotal) * 100);
  porcentaje = Math.max(0, Math.min(100, porcentaje));
  
  const diasRestantes = Math.ceil((fin - ahora) / (1000 * 60 * 60 * 24));
  const msgTiempo = diasRestantes > 0 ? `Quedan ${diasRestantes} días de campaña` : "Campaña concluida";
  
  if (document.getElementById("lbl-tiempo-restante")) document.getElementById("lbl-tiempo-restante").innerText = msgTiempo;
  if (document.getElementById("lbl-porcentaje-tiempo")) document.getElementById("lbl-porcentaje-tiempo").innerText = `${porcentaje}%`;
  
  const barra = document.getElementById("barra-progreso-elemento");
  if (barra) barra.style.width = `${porcentaje}%`;
}

function actualizarAnillosEstadisticos() {
  const grupoMapas = baseDatosCompleta.filter(m => m.grupo == grupoFiltro);
  const total = grupoMapas.length;
  
  const prio = grupoMapas.filter(m => m.prioritario === "SI" || m.prioritario === true || String(m.prioritario).toUpperCase() === "TRUE").length;
  const calle = grupoMapas.filter(m => m.entregado === true && m.trabajado === true).length;
  const hechos = grupoMapas.filter(m => m.entregado === true && m.trabajado === false).length;
  
  if (document.getElementById("w-totales")) document.getElementById("w-totales").innerText = total;
  if (document.getElementById("w-prioritarios")) document.getElementById("w-prioritarios").innerText = prio;
  if (document.getElementById("w-asignados")) document.getElementById("w-asignados").innerText = calle;
  if (document.getElementById("w-completados")) document.getElementById("w-completados").innerText = hechos;
  
  inyectarArcoProgreso("progreso-prioritarios", prio, total);
  inyectarArcoProgreso("progreso-asignados", calle, total);
  inyectarArcoProgreso("progreso-completados", hechos, total);
}

function inyectarArcoProgreso(idPath, valor, total) {
  const el = document.getElementById(idPath);
  if (!el || total === 0) return;
  let porcentaje = Math.min(100, Math.floor((valor / total) * 100));
  el.setAttribute("stroke-dasharray", `${porcentaje}, 100`);
}

function cambiarCriterioAsignados(criterio) {
  criterioOrdenacionAsignados = criterio;
  document.querySelectorAll(".btn-sub-filtro").forEach(b => b.classList.remove("activo"));
  filtrarYRenderizar();
}

function filtrarYRenderizar() {
  const grid = document.getElementById("contenedor-principal-grid");
  if (!grid) return;
  const buscadorValue = document.getElementById("input-busqueda").value.toLowerCase();
  grid.innerHTML = "";
  
  const panelAsignacion = document.getElementById("panel-asignacion-unico");
  
  if (vistaActual === "disponibles") {
    eliminarSelectorDeAgrupacionAsignados();
    actualizarPanelAsignacionFlotante();
  } else {
    if (panelAsignacion) panelAsignacion.style.display = "none";
    inyectarSelectorDeAgrupacionAsignados();
  }
  
  let dataset = baseDatosCompleta.filter(m => m.grupo == grupoFiltro);
  dataset = vistaActual === "disponibles" ? dataset.filter(m => m.entregado === false) : dataset.filter(m => m.entregado === true);
  
  if (buscadorValue) {
    dataset = dataset.filter(m => 
      m.id.toString().includes(buscadorValue) || 
      m.barriada.toLowerCase().includes(buscadorValue)
    );
  }
  
  // ORDENACIÓN Y AGRUPACIÓN EFECTIVA
  if (vistaActual === "disponibles") {
    dataset.sort((a, b) => {
      let aPrio = a.prioritario === "SI" || a.prioritario === true || String(a.prioritario).toUpperCase() === "TRUE";
      let bPrio = b.prioritario === "SI" || b.prioritario === true || String(b.prioritario).toUpperCase() === "TRUE";
      if (aPrio && !bPrio) return -1;
      if (!aPrio && bPrio) return 1;
      return parseInt(a.id) - parseInt(b.id);
    });
  } else {
    if (criterioOrdenacionAsignados === "territorio") {
      dataset.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    } else if (criterioOrdenacionAsignados === "hermano") {
      dataset.sort((a, b) => (a.hermano || "").localeCompare(b.hermano || "") || parseInt(a.id) - parseInt(b.id));
    } else if (criterioOrdenacionAsignados === "fecha") {
      dataset.sort((a, b) => new Date(b.fechaEntrega || 0) - new Date(a.fechaEntrega || 0));
    }
  }
  
  dataset.forEach(mapa => {
    const div = document.createElement("div");
    const esPrio = mapa.prioritario === "SI" || mapa.prioritario === true || String(mapa.prioritario).toUpperCase() === "TRUE";
    
    if (vistaActual === "disponibles") {
      const seleccionadoActivo = territoriosSeleccionados.includes(mapa.id.toString());
      div.className = `tarjeta-apple ${esPrio ? 'prioritaria-row' : ''} ${seleccionadoActivo ? 'seleccionada' : ''}`;
      div.id = `tarjeta-real-${mapa.id}`;
      div.setAttribute("onclick", `alternarSeleccionTarjeta('${mapa.id}', event)`);
      
      div.innerHTML = `
        <div class="cabecera-tarjeta">
          <div class="bloque-id">
            <span class="num-mapa">${parseInt(mapa.id)}</span>
            <span class="nombre-barrio">${mapa.barriada}</span>
          </div>
          <div class="contenedor-check">
            <div class="check-apple-custom ${seleccionadoActivo ? 'checked' : ''}" id="circulo-check-${mapa.id}"></div>
          </div>
        </div>
        <div class="imagen-mapa-wrapper">
          <button class="btn-lupa-flotante" onclick="abrirVisorPantallaCompleta('${mapa.rutaMapa}', '${parseInt(mapa.id)} - ${mapa.barriada}', event)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="ico-minimalista"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
          <img src="${mapa.rutaMapa}" class="imagen-mapa-asset" onerror="this.src='https://placehold.co/400x300?text=Mapa+no+disponible'">
        </div>
        <div class="pie-tarjeta-firma">
          ${esPrio ? `<span class="tag-prioritario-abajo">⚠️ PRIORITARIO</span>` : `<span class="tag-vacio-espacio"></span>`}
        </div>
      `;
    } else {
      // DISEÑO HORIZONTAL CON IMAGEN RECTANGULAR E ICONOS SVG MINIMALISTAS
      div.className = `tarjeta-apple-horizontal ${esPrio ? 'prioritaria-row' : ''}`;
      
      let fechaFormateada = "Sin fecha";
      if (mapa.fechaEntrega) {
        const f = new Date(mapa.fechaEntrega);
        if (!isNaN(f.getTime())) {
          fechaFormateada = f.toLocaleDateString("es-ES", { day: '2-digit', month: '2-digit', year: '2-digit' });
        }
      }

      div.innerHTML = `
        <div class="img-lateral-wrapper-rectangular">
          <button class="btn-lupa-flotante" onclick="abrirVisorPantallaCompleta('${mapa.rutaMapa}', '${parseInt(mapa.id)} - ${mapa.barriada}', event)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="ico-minimalista"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
          <img src="${mapa.rutaMapa}" class="imagen-lateral-asset-rect" onerror="this.src='https://placehold.co/150x100?text=Mapa'">
        </div>
        <div class="contenido-lateral-datos">
          <div class="cabecera-datos-linea">
            <span class="num-mapa-chico">${parseInt(mapa.id)}</span>
            <span class="nombre-barrio-chico">${mapa.barriada}</span>
          </div>
          <div class="info-hermano-linea">
            <span class="txt-horizontal-hermano">
              <svg class="svg-icono-chico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              ${mapa.hermano || 'No asignado'}
            </span>
            <span class="txt-horizontal-fecha">
              <svg class="svg-icono-chico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              ${fechaFormateada}
            </span>
          </div>
          <div class="estado-badge-linea">
            <span class="badge-estado-pill ${mapa.trabajado ? 'estado-calle' : 'estado-hecho'}">
              <svg class="svg-icono-mini" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              ${mapa.trabajado ? "En la calle" : "Hecho"}
            </span>
            ${esPrio ? `<span class="tag-prio-mini">⚠️ PRIORITARIO</span>` : ''}
          </div>
        </div>
      `;
    }
    grid.appendChild(div);
  });
}

function inyectarSelectorDeAgrupacionAsignados() {
  if (document.getElementById("contenedor-agrupador-asignados")) return;
  const mainContenido = document.getElementById("contenedor-principal-grid");
  if (!mainContenido) return;
  
  const navAgrupador = document.createElement("div");
  navAgrupador.id = "contenedor-agrupador-asignados";
  navAgrupador.className = "menu-agrupacion-premium";
  navAgrupador.style = "display: flex; gap: 6px; padding: 10px 0; width: 100%; overflow-x: auto;";
  navAgrupador.innerHTML = `
    <span style="font-size: 12px; opacity: 0.6; align-self: center; margin-right: 4px;">Ordenar por:</span>
    <button class="btn-sub-filtro ${criterioOrdenacionAsignados === 'territorio' ? 'activo' : ''}" onclick="cambiarCriterioAsignados('territorio')">Territorio</button>
    <button class="btn-sub-filtro ${criterioOrdenacionAsignados === 'hermano' ? 'activo' : ''}" onclick="cambiarCriterioAsignados('hermano')">Hermano</button>
    <button class="btn-sub-filtro ${criterioOrdenacionAsignados === 'fecha' ? 'activo' : ''}" onclick="cambiarCriterioAsignados('fecha')">Fecha Entrega</button>
  `;
  mainContenido.parentNode.insertBefore(navAgrupador, mainContenido);
}

function eliminarSelectorDeAgrupacionAsignados() {
  const el = document.getElementById("contenedor-agrupador-asignados");
  if (el) el.remove();
}

function alternarSeleccionTarjeta(idMapa, evento) {
  if (evento.target.closest('.btn-lupa-flotante')) return;
  
  const idStr = idMapa.toString();
  const index = territoriosSeleccionados.indexOf(idStr);
  const card = document.getElementById(`tarjeta-real-${idMapa}`);
  const customCheck = document.getElementById(`circulo-check-${idMapa}`);
  
  if (index === -1) {
    territoriosSeleccionados.push(idStr);
    if (card) card.classList.add("seleccionada");
    if (customCheck) customCheck.classList.add("checked");
  } else {
    territoriosSeleccionados.splice(index, 1);
    if (card) card.classList.remove("seleccionada");
    if (customCheck) customCheck.classList.remove("checked");
  }
  
  actualizarPanelAsignacionFlotante();
}

function actualizarPanelAsignacionFlotante() {
  const panel = document.getElementById("panel-asignacion-unico");
  const textContador = document.getElementById("txt-contador-seleccionados");
  
  if (!panel) return;
  
  if (territoriosSeleccionados.length > 0 && vistaActual === "disponibles") {
    if (textContador) textContador.innerText = `${territoriosSeleccionados.length} seleccionado(s)`;
    panel.style.display = "flex";
    panel.classList.add("visible");
    evaluarEstadoBotonAsignar();
  } else {
    panel.classList.remove("visible");
    panel.style.display = "none";
  }
}

function evaluarEstadoBotonAsignar() {
  const selector = document.getElementById("sel-hermano-unico");
  const btn = document.getElementById("btn-asignar-multiple");
  if (!selector || !btn) return;
  
  if (selector.value !== "" && territoriosSeleccionados.length > 0) {
    btn.disabled = false;
    btn.className = "btn-apple-verde-activo";
  } else {
    btn.disabled = true;
    btn.className = "btn-apple-bloqueado";
  }
}

async function procesarAsignacionMultiple() {
  const selector = document.getElementById("sel-hermano-unico");
  const btn = document.getElementById("btn-asignar-multiple");
  const nombreH = selector.value;
  
  if (!nombreH || territoriosSeleccionados.length === 0) return;
  
  btn.disabled = true;
  btn.innerText = "Asignando...";

  const mapaAsignadoElegido = baseDatosCompleta.find(m => m.hermano && m.hermano.trim() === nombreH);
  let telefonoWhatsApp = "";
  if (mapaAsignadoElegido && mapaAsignadoElegido.whatsapp) {
    telefonoWhatsApp = mapaAsignadoElegido.whatsapp.toString().replace(/\s+/g, '').replace('+', '');
  }
  
  for (let id of territoriosSeleccionados) {
    await lanzarPeticionGoogleAsincrona(id, nombreH);
  }
  
  if (telefonoWhatsApp && telefonoWhatsApp !== "") {
    let listadoMapasTexto = territoriosSeleccionados.map(id => `• Territorio ${id}`).join('%0A');
    let mensajeCompleto = `Hola ${nombreH}, se te han asignado los siguientes territorios para la campaña:%0A%0A${listadoMapasTexto}%0A%0A¡Muchas gracias por tu apoyo!`;
    let enlaceWhatsAppFinal = `https://api.whatsapp.com/send?phone=${telefonoWhatsApp}&text=${mensajeCompleto}`;
    
    window.open(enlaceWhatsAppFinal, '_blank');
  }
  
  await descargarDatosDesdeSheets();
}

function lanzarPeticionGoogleAsincrona(idMapa, hermanoNombre) {
  return new Promise((resolve) => {
    const scriptTag = document.createElement("script");
    scriptTag.src = `${URL_API_SHEETS}?accion=asignar&id=${idMapa}&hermano=${encodeURIComponent(hermanoNombre)}`;
    scriptTag.onload = () => { scriptTag.remove(); resolve(); };
    scriptTag.onerror = () => { scriptTag.remove(); resolve(); };
    document.body.appendChild(scriptTag);
  });
}

function filtrarYRenderizarHermano() {
  const grid = document.getElementById("contenedor-hermano-grid");
  if (!grid) return;
  grid.innerHTML = "";
  
  const asignadosHermano = baseDatosCompleta.filter(m => m.hermano.toLowerCase() === idHermanoUrl.toLowerCase() && m.entregado === true);
  
  if (asignadosHermano.length === 0) {
    grid.innerHTML = "<p style='padding:50px; text-align:center; color:var(--texto-secundario); font-size:14px;'>No tienes mapas asignados.</p>";
    return;
  }
  
  asignadosHermano.sort((a,b) => b.trabajado - a.trabajado);
  
  asignadosHermano.forEach(mapa => {
    const div = document.createElement("div");
    div.className = `tarjeta-apple ${!mapa.trabajado ? 'terminado' : ''}`;
    
    let accionBotonHTML = `<button class="btn-completar-hermano" onclick="ejecutarHechoHermano(${mapa.id}, this)">Completado</button>`;
    if (!mapa.trabajado) {
      accionBotonHTML = `<p style='color:var(--apple-verde); text-align:center; font-weight:700; font-size:14px; margin-top:8px;'>✅ Terminado</p>`;
    }
    
    div.innerHTML = `
      <div class="cabecera-tarjeta">
        <div class="bloque-id">
          <span class="num-mapa">${parseInt(mapa.id)}</span>
          <span class="nombre-barrio">${mapa.barriada}</span>
        </div>
      </div>
      <div class="imagen-mapa-wrapper">
        <button class="btn-lupa-flotante" onclick="abrirVisorPantallaCompleta('${mapa.rutaMapa}', '${parseInt(mapa.id)} - ${mapa.barriada}', event)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="ico-minimalista"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </button>
        <img src="${mapa.rutaMapa}" class="imagen-mapa-asset">
      </div>
      <div style="margin-top:4px;">${accionBotonHTML}</div>
    `;
    grid.appendChild(div);
  });
}

function ejecutarHechoHermano(idMapa, btn) {
  btn.disabled = true;
  btn.innerText = "Guardando...";
  const sCompletar = document.createElement("script");
  sCompletar.src = `${URL_API_SHEETS}?accion=completar&id=${idMapa}`;
  sCompletar.onload = async () => { sCompletar.remove(); await descargarDatosDesdeSheets(); };
  document.body.appendChild(sCompletar);
}

function abrirVisorPantallaCompleta(src, descrip, evento) {
  if (evento) evento.stopPropagation();
  const modal = document.getElementById("modal-visor-pantalla-completa");
  const imgTarget = document.getElementById("img-visor-completa");
  const tituloTarget = document.getElementById("titulo-visor-completo");
  
  if (!modal || !imgTarget) return;
  
  tituloTarget.innerText = descrip;
  imgTarget.src = src;
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function cerrarVisorPantallaCompleta() {
  const modal = document.getElementById("modal-visor-pantalla-completa");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "auto";
}

function cambiarPestana(vista, btn) {
  vistaActual = vista;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("activa"));
  btn.classList.add("activa");
  filtrarYRenderizar();
}

function configurarTemaInicial() {
  const t = localStorage.getItem("tema_app") || "oscuro";
  document.documentElement.setAttribute("data-theme", t);
}

function conmutarTema() {
  const actual = document.documentElement.getAttribute("data-theme");
  const nuevo = actual === "oscuro" ? "claro" : "oscuro";
  document.documentElement.setAttribute("data-theme", nuevo);
  localStorage.setItem("tema_app", nuevo);
  document.getElementById("btn-cambiar-tema").innerText = nuevo === "oscuro" ? "☀️" : "🌙";
}
