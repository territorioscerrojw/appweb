// app.js - Versión Minimalista Premium, Agrupaciones Avanzadas y Enlace Automático WhatsApp
const URL_API_SHEETS = "https://script.google.com/macros/s/AKfycbw0Vt1KuZyBTeJtLuuy7BV6nF2v_PpVDMy_DpD7o6iL8gxsZ1aSDCcjUsyUOb0m_ouVbQ/exec";

let baseDatosCompleta = [];
let listaHermanosPool = [];
let territoriosSeleccionados = [];
let vistaActual = "disponibles"; 
let tipoUsuario = ""; 
let grupoFiltro = null;
let idHermanoUrl = null;
let diccionarioGruposHermanos = {};
let criterioOrdenacionAsignados = "territorio"; // Valores: 'territorio', 'hermano', 'fecha'

async function inicializarPantalla(tipo) {
  tipoUsuario = tipo;
  configurarTemaInicial();
  inyectarEstilosModernosDinamicos(); // Inyecta la nueva tipografía, tamaños gigantes y transparencias de diseño
  
  const parametros = new URLSearchParams(window.location.search);
  grupoFiltro = parametros.get("grupo");
  idHermanoUrl = parametros.get("id");
  
  if (!grupoFiltro && tipoUsuario === "encargado") {
    document.body.innerHTML = "<div style='padding:40px; text-align:center; font-family:var(--font-moderna); color:var(--texto-principal);'><h2>🚨 Error de Acceso</h2><p style='color:var(--texto-secundario); margin-top:10px;'>Falta especificar el número de grupo (?grupo=1)</p></div>";
    return;
  }
  
  await descargarDatosDesdeSheets();
}

function descargarDatosDesdeSheets() {
  return new Promise((resolve, reject) => {
    const nombreCallback = "googleSheetsCallback_" + new Date().getTime();
    
    window[nombreCallback] = function(datos) {
      if (datos.error) {
        document.body.innerHTML = `<div style="padding:40px; color:#ff3b30; font-family:var(--font-moderna); text-align:center;">🚨 <b>Error:</b><br>${datos.mensaje}</div>`;
        return;
      }

      baseDatosCompleta = datos;
      territoriosSeleccionados = [];
      actualizarPanelAsignacionFlotante();
      
      if (baseDatosCompleta.length > 0) {
        procesarFechasYBarras(baseDatosCompleta[0].inicio, baseDatosCompleta[0].fin);
        const campanaNombre = baseDatosCompleta[0].campana || "Campaña Activa";
        if (document.getElementById("txt-campana-titulo")) document.getElementById("txt-campana-titulo").innerText = campanaNombre;
        
        diccionarioGruposHermanos = baseDatosCompleta[0].grupoRealHermano || {};
        extraerNombresDeHermanos();
      }
      
      if (tipoUsuario === "encargado") {
        if (document.getElementById("txt-grupo-sub")) document.getElementById("txt-grupo-sub").innerText = `Grupo ${grupoFiltro}`;
        actualizarAnillosEstadisticos();
        filtrarYRenderizar();
      } else if (tipoUsuario === "hermano") {
        filtrarYRenderizarHermano();
      }
      
      document.getElementById(nombreCallback).remove();
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
    
    // Cambiado: Quita la chincheta molesta y añade un puntito verde minimalista discretamente
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
  if (barra) {
    barra.style.width = `${porcentaje}%`;
  }
}

function actualizarAnillosEstadisticos() {
  const grupoMapas = baseDatosCompleta.filter(m => m.grupo == grupoFiltro);
  const total = grupoMapas.length;
  
  const prio = grupoMapas.filter(m => m.prioritario === "SI" || m.prioritario === true || String(m.prioritario).toUpperCase() === "TRUE").length;
  const calle = grupoMapas.filter(m => m.entregado === true && m.trabajado === true).length;
  const hechos = grupoMapas.filter(m => m.entregado === true && m.trabajado === false).length;
  
  // Modificación solicitada: Títulos modernizados de Contadores y Estética limpia
  const contenedorStats = document.querySelector(".contenedor-estadisticas-anillos") || document.body;
  
  if (document.getElementById("w-totales")) document.getElementById("w-totales").innerText = total;
  if (document.getElementById("w-prioritarios")) document.getElementById("w-prioritarios").innerText = prio;
  
  // Cambiados los textos solicitados: "ASIGNADOS" y "COMPLETADOS"
  const lblAsignados = document.getElementById("w-asignados");
  if (lblAsignados) {
    lblAsignados.innerText = calle;
    let pNode = lblAsignados.parentNode.querySelector("p") || lblAsignados.parentNode.querySelectorAll("span")[1];
    if (pNode) pNode.innerText = "Asignados";
  }
  
  const lblCompletados = document.getElementById("w-completados");
  if (lblCompletados) {
    lblCompletados.innerText = hechos;
    let pNode = lblCompletados.parentNode.querySelector("p") || lblCompletados.parentNode.querySelectorAll("span")[1];
    if (pNode) pNode.innerText = "Completados";
  }
  
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

function filtrarYRenderizar() {
  const grid = document.getElementById("contenedor-principal-grid");
  if (!grid) return;
  const buscadorValue = document.getElementById("input-busqueda").value.toLowerCase();
  grid.innerHTML = "";
  
  // Ocultar o mostrar dinámicamente controles según la pestaña
  const panelAsignacion = document.getElementById("panel-asignacion-unico");
  const barraProgresoContenedor = document.getElementById("contenedor-barra-progreso-global") || document.querySelector(".bloque-progreso-tiempo");
  
  // Controlar visibilidad del menú de asignación flotante
  if (vistaActual === "disponibles") {
    eliminarSelectorDeAgrupacionAsignados();
    if (territoriosSeleccionados.length > 0) {
      if (panelAsignacion) panelAsignacion.style.display = "flex";
    }
  } else {
    // Pestaña ASIGNADOS: Ocultar menú de selección de hermano por completo
    if (panelAsignacion) panelAsignacion.style.display = "none";
    inyectarSelectorDeAgrupacionAsignados();
  }
  
  let dataset = baseDatosCompleta.filter(m => m.grupo == grupoFiltro);
  dataset = vistaActual === "disponibles" ? dataset.filter(m => m.entregado === false) : dataset.filter(m => m.entregado === true);
  
  // Modificado: Búsqueda estricta SÓLO por ID (Territorio) o Barriada. Ya no filtra por nombre de Hermano.
  if (buscadorValue) {
    dataset = dataset.filter(m => 
      m.id.toString().includes(buscadorValue) || 
      m.barriada.toLowerCase().includes(buscadorValue)
    );
  }
  
  // Ordenar según criterios establecidos
  if (vistaActual === "disponibles") {
    dataset.sort((a, b) => {
      let aPrio = a.prioritario === "SI" || a.prioritario === true || String(a.prioritario).toUpperCase() === "TRUE";
      let bPrio = b.prioritario === "SI" || b.prioritario === true || String(b.prioritario).toUpperCase() === "TRUE";
      if (aPrio && !bPrio) return -1;
      if (!aPrio && bPrio) return 1;
      return parseInt(a.id) - parseInt(b.id);
    });
  } else {
    // Lógica avanzada de ordenamiento y agrupación para la pestaña Asignados
    if (criterioOrdenacionAsignados === "hermano") {
      dataset.sort((a, b) => (a.hermano || "").localeCompare(b.hermano || "") || parseInt(a.id) - parseInt(b.id));
    } else if (criterioOrdenacionAsignados === "fecha") {
      dataset.sort((a, b) => parseInt(b.id) - parseInt(a.id)); // Histórico alternativo por proximidad de ID
    } else {
      dataset.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    }
  }
  
  dataset.forEach(mapa => {
    const div = document.createElement("div");
    const esPrio = mapa.prioritario === "SI" || mapa.prioritario === true || String(mapa.prioritario).toUpperCase() === "TRUE";
    const seleccionadoActivo = territoriosSeleccionados.includes(mapa.id.toString());
    
    // Configuración estética de tarjetas (Asignados son mucho más compactas y elegantes)
    if (vistaActual === "disponibles") {
      div.className = `tarjeta-apple ${esPrio ? 'prioritaria-row' : ''} ${seleccionadoActivo ? 'seleccionada' : ''}`;
    } else {
      div.className = `tarjeta-apple tarjeta-asignada-compacta ${esPrio ? 'prioritaria-row' : ''}`;
    }
    
    div.id = `tarjeta-real-${mapa.id}`;
    
    if (vistaActual === "disponibles") {
      div.setAttribute("onclick", `alternarSeleccionTarjeta('${mapa.id}', event)`);
    }
    
    let subFirmaHTML = "";
    let visualCheckHTML = "";
    
    if (vistaActual === "disponibles") {
      visualCheckHTML = `
        <div class="contenedor-check">
          <div class="check-apple-custom ${seleccionadoActivo ? 'checked' : ''}" id="circulo-check-${mapa.id}"></div>
        </div>
      `;
      // Modificado: Ahora dice únicamente PRIORITARIO en lugar de MAPA PRIORITARIO
      subFirmaHTML = esPrio ? `<span class="tag-prioritario-abajo">PRIORITARIO</span>` : `<span class="tag-vacio-espacio"></span>`;
    } else {
      // Iconografía y botones minimalistas limpios de estado para asignados
      subFirmaHTML = `
        <div class="info-entrega-bloque">
          <p class="txt-hermano-nombre"><span class="mini-icon-dot"></span> ${mapa.hermano}</p>
          <p class="txt-hermano-estado ${mapa.trabajado ? 'estado-calle' : 'estado-hecho'}">${mapa.trabajado ? "En la calle" : "Completado"}</p>
        </div>
      `;
    }
    
    // Diseño estructural centrado para la barriada
    div.innerHTML = `
      <div class="cabecera-tarjeta">
        <div class="bloque-id" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
          <span class="num-mapa">${parseInt(mapa.id)}</span>
          <span class="nombre-barrio-centrado">${mapa.barriada}</span>
          <div style="width: 24px;"></div> </div>
        ${visualCheckHTML}
      </div>
      <div class="imagen-mapa-wrapper">
        <button class="btn-lupa-flotante" onclick="abrirVisorPantallaCompleta('${mapa.rutaMapa}', '${parseInt(mapa.id)} - ${mapa.barriada}', event)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </button>
        <img src="${mapa.rutaMapa}" class="imagen-mapa-asset" onerror="this.src='https://placehold.co/400x300?text=Mapa+no+disponible'">
      </div>
      <div class="pie-tarjeta-firma">${subFirmaHTML}</div>
    `;
    
    grid.appendChild(div);
  });
}

// Inyección e interactividad del nuevo agrupador minimalista de la pestaña asignados
function inyectarSelectorDeAgrupacionAsignados() {
  if (document.getElementById("contenedor-agrupador-asignados")) return;
  const mainContenido = document.getElementById("contenedor-principal-grid");
  if (!mainContenido) return;
  
  const navAgrupador = document.createElement("div");
  navAgrupador.id = "contenedor-agrupador-asignados";
  navAgrupador.className = "menu-agrupacion-premium";
  navAgrupador.innerHTML = `
    <span class="titulo-filtro-lbl">Ordenar por:</span>
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

function cambiarCriterioAsignados(criterio) {
  criterioOrdenacionAsignados = criterion;
  const botones = document.querySelectorAll(".btn-sub-filtro");
  botones.forEach(b => b.classList.remove("activo"));
  filtrarYRenderizar();
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
    if (textContador) textContador.innerText = `${territoriosSeleccionados.length} Seleccionado(s)`;
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
  
  // Buscar información de contacto del hermano seleccionado para la redirección
  const mapaAsignadoElegido = baseDatosCompleta.find(m => m.hermano && m.hermano.trim() === nombreH);
  let telefonoWhatsApp = "";
  if (mapaAsignadoElegido && mapaAsignadoElegido.whatsapp) {
    telefonoWhatsApp = mapaAsignadoElegido.whatsapp.toString().replace(/\s+/g, '').replace('+', '');
  }
  
  // Ejecutar asignación asíncrona contra Google Sheets
  for (let id of territoriosSeleccionados) {
    await lanzarPeticionGoogleAsincrona(id, nombreH);
  }
  
  // 🔥 SOLUCIÓN REDIRECCIÓN WHATSAPP AUTOMÁTICA
  if (telefonoWhatsApp && telefonoWhatsApp !== "") {
    let listadoMapasTexto = territoriosSeleccionados.map(id => `• Territorio ${id}`).join('%0A');
    let mensajeCompleto = `Hola ${nombreH}, se te han asignado los siguientes territorios para la campaña:%0A%0A${listadoMapasTexto}%0A%0A¡Muchas gracias por tu apoyo!`;
    let enlaceWhatsAppFinal = `https://api.whatsapp.com/send?phone=${telefonoWhatsApp}&text=${mensajeCompleto}`;
    
    // Abrir enlace dinámico de WhatsApp en nueva ventana/pestaña limpia
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
    grid.innerHTML = "<p style='padding:50px; text-align:center; color:var(--texto-secundario); font-size:14px; font-family:var(--font-moderna);'>No tienes mapas asignados.</p>";
    return;
  }
  
  asignadosHermano.sort((a,b) => b.trabajado - a.trabajado);
  
  asignadosHermano.forEach(mapa => {
    const div = document.createElement("div");
    div.className = `tarjeta-apple tarjeta-asignada-compacta ${!mapa.trabajado ? 'terminado' : ''}`;
    
    let accionBotonHTML = `<button class="btn-completar-hermano" onclick="ejecutarHechoHermano(${mapa.id}, this)">Completado</button>`;
    if (!mapa.trabajado) {
      accionBotonHTML = `<p style='color:var(--apple-verde); text-align:center; font-weight:600; font-size:13px; margin-top:8px;'>Completado</p>`;
    }
    
    div.innerHTML = `
      <div class="cabecera-tarjeta">
        <div class="bloque-id" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
          <span class="num-mapa">${parseInt(mapa.id)}</span>
          <span class="nombre-barrio-centrado">${mapa.barriada}</span>
          <div style="width: 24px;"></div>
        </div>
      </div>
      <div class="imagen-mapa-wrapper">
        <button class="btn-lupa-flotante" onclick="abrirVisorPantallaCompleta('${mapa.rutaMapa}', '${parseInt(mapa.id)} - ${mapa.barriada}', event)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
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

// 🔥 INYECTOR GLOBAL DE ESTILOS PREMIUM INTERNOS: Cambia tipografía, transparencias, alturas y modo claro translúcido impecable
function inyectarEstilosModernosDinamicos() {
  if (document.getElementById("hoja-estilos-dinamica-premium")) return;
  const style = document.createElement("style");
  style.id = "hoja-estilos-dinamica-premium";
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@300;400;600;700&display=swap');
    
    :root {
      --font-moderna: 'SF Pro Display', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --apple-verde: #34c759;
    }
    
    body, input, select, button, p, span, h2, div {
      font-family: var(--font-moderna) !important;
      letter-spacing: -0.2px;
    }
    
    /* Modificación de Números de Contadores Gigantes y Estilo Ultra Limpio */
    .widget-anillo span, [id^="w-"] {
      font-size: 32px !important;
      font-weight: 700 !important;
      font-feature-settings: "tnum";
      display: block;
      margin-bottom: 2px;
    }
    
    .widget-anillo p {
      font-size: 11px !important;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      opacity: 0.7;
    }
    
    /* Centrado Absoluto de la Barriada */
    .nombre-barrio-centrado {
      font-weight: 600;
      font-size: 15px;
      text-align: center;
      flex-grow: 1;
    }
    
    /* Tag Prioritario Simplificado */
    .tag-prioritario-abajo {
      background: rgba(255, 59, 48, 0.12) !important;
      color: #ff3b30 !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      letter-spacing: 0.8px;
      padding: 3px 8px !important;
      border-radius: 4px !important;
      text-transform: uppercase;
    }
    
    /* Rediseño de la barra Flotante Inferior de Selección de Hermano Pegada al Progreso */
    #panel-asignacion-unico {
      position: fixed !important;
      bottom: 58px !important; /* Ajustado perfectamente para unirse sin espacios a la barra de progreso */
      left: 50% !important;
      transform: translateX(-50%) translateY(0) !important;
      width: 92% !important;
      max-width: 500px !important;
      background: rgba(28, 28, 30, 0.75) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      border-radius: 14px 14px 0px 0px !important; /* Pegado estético */
      padding: 12px 16px !important;
      box-shadow: 0 -8px 24px rgba(0,0,0,0.15) !important;
      display: none;
      align-items: center;
      gap: 10px;
      z-index: 9999 !important;
    }
    
    /* Corrección de Modo Claro para Fondos Translúcidos */
    [data-theme="claro"] #panel-asignacion-unico {
      background: rgba(255, 255, 255, 0.75) !important;
      border: 1px solid rgba(0, 0, 0, 0.06) !important;
      box-shadow: 0 -8px 24px rgba(0,0,0,0.06) !important;
    }
    
    /* Ajuste Anti-Corte en el Botón Asignar / Asignando */
    #btn-asignar-multiple {
      white-space: nowrap !important;
      min-width: 110px !important;
      padding: 10px 14px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      border-radius: 8px !important;
      text-align: center;
    }
    
    /* Tarjetas Compactas Estrechas para Pestaña Asignados */
    .tarjeta-asignada-compacta {
      padding: 8px 12px !important;
    }
    
    .tarjeta-asignada-compacta .imagen-mapa-wrapper {
      height: 110px !important; /* Reducción de la altura de la imagen para hacerla estrecha */
      min-height: 110px !important;
    }
    
    /* Menu Agrupación Superior Premium en pestaña Asignados */
    .menu-agrupacion-premium {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 14px 14px 14px;
      overflow-x: auto;
      width: 100%;
      box-sizing: border-box;
    }
    
    .titulo-filtro-lbl {
      font-size: 12px;
      font-weight: 600;
      opacity: 0.6;
      margin-right: 4px;
      white-space: nowrap;
    }
    
    .btn-sub-filtro {
      background: rgba(120, 120, 128, 0.12);
      border: none;
      color: var(--texto-principal);
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    
    .btn-sub-filtro.activo {
      background: var(--texto-principal);
      color: var(--fondo-principal);
      font-weight: 600;
    }
    
    /* Iconografía minimalista en texto de asignados */
    .mini-icon-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      background: var(--apple-verde);
      border-radius: 50%;
      margin-right: 4px;
      vertical-align: middle;
    }
    
    .txt-hermano-estado {
      font-size: 11px !important;
      font-weight: 600;
    }
    .estado-calle { color: #ff9500; }
    .estado-hecho { color: var(--apple-verde); }
  `;
  document.head.appendChild(style);
}
