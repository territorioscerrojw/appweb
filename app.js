// app.js - Versión Ultra-Premium Corregida (Fondo de Ciudad, Tarjetas Horizontales y Fijado de Errores)
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
  inyectarEstilosEstructuralesPremium(); 
  
  const parametros = new URLSearchParams(window.location.search);
  grupoFiltro = parametros.get("grupo");
  idHermanoUrl = parametros.get("id");
  
  if (!grupoFiltro && tipoUsuario === "encargado") {
    document.body.innerHTML = "<div style='padding:40px; text-align:center; font-family:var(--font-premium); color:var(--texto-principal);'><h2>🚨 Error de Acceso</h2><p style='opacity:0.6; margin-top:10px;'>Falta especificar el número de grupo (?grupo=1)</p></div>";
    return;
  }
  
  await descargarDatosDesdeSheets();
}

function descargarDatosDesdeSheets() {
  return new Promise((resolve, reject) => {
    const nombreCallback = "googleSheetsCallback_" + new Date().getTime();
    
    window[nombreCallback] = function(datos) {
      if (datos.error) {
        document.body.innerHTML = `<div style="padding:40px; color:#ff3b30; font-family:var(--font-premium); text-align:center;">🚨 <b>Error:</b><br>${datos.mensaje}</div>`;
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
    
    opt.innerText = esDeEsteGrupo ? `● ${nombre}` : nombre;
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

function filtrarYRenderizar() {
  const grid = document.getElementById("contenedor-principal-grid");
  if (!grid) return;
  
  // Capturar buscador
  const barraBusquedaInput = document.getElementById("input-busqueda");
  const contenedorBuscadorEstilo = document.querySelector(".bloque-busqueda") || document.getElementById("input-busqueda")?.parentNode;
  
  // Ocultar buscador e inyectar agrupadores según pestaña
  if (vistaActual === "disponibles") {
    eliminarSelectorDeAgrupacionAsignados();
    if (contenedorBuscadorEstilo) contenedorBuscadorEstilo.style.display = "block";
  } else {
    if (contenedorBuscadorEstilo) contenedorBuscadorEstilo.style.display = "none";
    inyectarSelectorDeAgrupacionAsignados();
  }
  
  const buscadorValue = barraBusquedaInput && vistaActual === "disponibles" ? barraBusquedaInput.value.toLowerCase() : "";
  grid.innerHTML = "";
  
  let dataset = baseDatosCompleta.filter(m => m.grupo == grupoFiltro);
  dataset = vistaActual === "disponibles" ? dataset.filter(m => m.entregado === false) : dataset.filter(m => m.entregado === true);
  
  // Búsqueda estricta sólo por ID o Barriada en Disponibles
  if (buscadorValue && vistaActual === "disponibles") {
    dataset = dataset.filter(m => 
      m.id.toString().includes(buscadorValue) || 
      m.barriada.toLowerCase().includes(buscadorValue)
    );
  }
  
  // Ordenamiento correcto e inteligente sin errores
  if (vistaActual === "disponibles") {
    dataset.sort((a, b) => {
      let aPrio = a.prioritario === "SI" || a.prioritario === true || String(a.prioritario).toUpperCase() === "TRUE";
      let bPrio = b.prioritario === "SI" || b.prioritario === true || String(b.prioritario).toUpperCase() === "TRUE";
      if (aPrio && !bPrio) return -1;
      if (!aPrio && bPrio) return 1;
      return parseInt(a.id) - parseInt(b.id);
    });
  } else {
    if (criterioOrdenacionAsignados === "hermano") {
      dataset.sort((a, b) => (a.hermano || "").localeCompare(b.hermano || "") || parseInt(a.id) - parseInt(b.id));
    } else if (criterioOrdenacionAsignados === "fecha") {
      dataset.sort((a, b) => parseInt(b.id) - parseInt(a.id)); 
    } else {
      dataset.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    }
  }
  
  // Renderizado Condicional de Tarjetas (Normal o la nueva Horizontal de Asignados)
  dataset.forEach(mapa => {
    const div = document.createElement("div");
    const esPrio = mapa.prioritario === "SI" || mapa.prioritario === true || String(mapa.prioritario).toUpperCase() === "TRUE";
    const seleccionadoActivo = territoriosSeleccionados.includes(mapa.id.toString());
    
    if (vistaActual === "disponibles") {
      // 📌 DISEÑO PESTAÑA DISPONIBLES (TARJETA VERTICAL TRADICIONAL)
      div.className = `tarjeta-apple ${esPrio ? 'prioritaria-row' : ''} ${seleccionadoActivo ? 'seleccionada' : ''}`;
      div.id = `tarjeta-real-${mapa.id}`;
      div.setAttribute("onclick", `alternarSeleccionTarjeta('${mapa.id}', event)`);
      
      let visualCheckHTML = `
        <div class="contenedor-check">
          <div class="check-apple-custom ${seleccionadoActivo ? 'checked' : ''}" id="circulo-check-${mapa.id}"></div>
        </div>
      `;
      let subFirmaHTML = esPrio ? `<span class="tag-prioritario-abajo">PRIORITARIO</span>` : `<span class="tag-vacio-espacio"></span>`;
      
      div.innerHTML = `
        <div class="cabecera-tarjeta">
          <div class="bloque-id" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
            <span class="num-mapa">${parseInt(mapa.id)}</span>
            <span class="nombre-barrio-centrado">${mapa.barriada}</span>
            <div style="width: 24px;"></div> 
          </div>
          ${visualCheckHTML}
        </div>
        <div class="imagen-mapa-wrapper">
          <button class="btn-lupa-flotante" onclick="abrirVisorPantallaCompleta('${mapa.rutaMapa}', '${parseInt(mapa.id)} - ${mapa.barriada}', event)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
          <img src="${mapa.rutaMapa}" class="imagen-mapa-asset" onerror="this.src='https://placehold.co/400x300?text=Mapa+no+disponible'">
        </div>
        <div class="pie-tarjeta-firma">${subFirmaHTML}</div>
      `;
    } else {
      // 📌 NUEVO DISEÑO SOLICITADO PARA ASIGNADOS (TARJETA COMPACTA HORIZONTAL)
      div.className = `tarjeta-horizontal-premium ${esPrio ? 'borde-prioritario' : ''}`;
      
      div.innerHTML = `
        <div class="zona-izquierda-mapa">
          <img src="${mapa.rutaMapa}" class="img-horizontal-asset" onclick="abrirVisorPantallaCompleta('${mapa.rutaMapa}', '${parseInt(mapa.id)} - ${mapa.barriada}', event)" onerror="this.src='https://placehold.co/100x100?text=Mapa'">
          <span class="badge-id-horizontal">${parseInt(mapa.id)}</span>
        </div>
        <div class="zona-derecha-contenido">
          <div class="fila-superior-barrio">${mapa.barriada}</div>
          <div class="fila-inferior-hermano">
            <span class="lbl-avatar">👤</span> 
            <span class="lbl-nombre-h">${mapa.hermano}</span>
          </div>
          <div class="fila-estado-tag">
            <span class="indicador-circulo ${mapa.trabajado ? 'color-calle' : 'color-hecho'}"></span>
            <span class="texto-estado-lbl">${mapa.trabajado ? "En la calle" : "Completado"}</span>
          </div>
        </div>
      `;
    }
    
    grid.appendChild(div);
  });
  
  actualizarPanelAsignacionFlotante();
}

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
  criterioOrdenacionAsignados = criterio;
  filtrarYRenderizar();
}

function alternarSeleccionTarjeta(idMapa, evento) {
  if (evento.target.closest('.btn-lupa-flotante') || vistaActual !== "disponibles") return;
  
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
    evaluarEstadoBotonAsignar();
  } else {
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
  
  // Buscar número telefónico mapeado desde HERMANOS
  let telefonoWhatsApp = "";
  baseDatosCompleta.forEach(m => {
    if (m.hermano && m.hermano.trim() === nombreH && m.whatsapp) {
      telefonoWhatsApp = m.whatsapp.toString().replace(/\s+/g, '').replace('+', '');
    }
  });
  
  // Lanzar peticiones síncronas contra la hoja de cálculo
  for (let id of territoriosSeleccionados) {
    await lanzarPeticionGoogleAsincrona(id, nombreH);
  }
  
  // 🔥 REDIRECCIÓN CORRECTA Y PROBADA A WHATSAPP
  if (telefonoWhatsApp && telefonoWhatsApp !== "") {
    let listadoMapasTexto = territoriosSeleccionados.map(id => `• Territorio ${id}`).join('%0A');
    let mensajeCompleto = `Hola ${nombreH}, se te han asignado los siguientes territorios para la campaña:%0A%0A${listadoMapasTexto}%0A%0A¡Muchas gracias por tu labor!`;
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
    grid.innerHTML = "<p style='padding:50px; text-align:center; opacity:0.5; font-size:14px;'>No tienes mapas asignados.</p>";
    return;
  }
  
  asignadosHermano.sort((a,b) => b.trabajado - a.trabajado);
  
  asignadosHermano.forEach(mapa => {
    const div = document.createElement("div");
    div.className = `tarjeta-horizontal-premium`;
    
    let accionBotonHTML = `<button class="btn-completar-hermano" onclick="ejecutarHechoHermano(${mapa.id}, this)">Completado</button>`;
    if (!mapa.trabajado) {
      accionBotonHTML = `<span style='color:var(--apple-verde); font-weight:700; font-size:12px;'>✓ Hecho</span>`;
    }
    
    div.innerHTML = `
      <div class="zona-izquierda-mapa">
        <img src="${mapa.rutaMapa}" class="img-horizontal-asset" onclick="abrirVisorPantallaCompleta('${mapa.rutaMapa}', '${parseInt(mapa.id)} - ${mapa.barriada}', event)">
        <span class="badge-id-horizontal">${parseInt(mapa.id)}</span>
      </div>
      <div class="zona-derecha-contenido" style="justify-content: center; gap: 6px;">
        <div class="fila-superior-barrio">${mapa.barriada}</div>
        <div>${accionBotonHTML}</div>
      </div>
    `;
    grid.appendChild(div);
  });
}

function ejecutarHechoHermano(idMapa, btn) {
  btn.disabled = true;
  btn.innerText = "...";
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
  actualizarIconoTemaEstructural(t);
}

function conmutarTema() {
  const actual = document.documentElement.getAttribute("data-theme");
  const nuevo = actual === "oscuro" ? "claro" : "oscuro";
  document.documentElement.setAttribute("data-theme", nuevo);
  localStorage.setItem("tema_app", nuevo);
  actualizarIconoTemaEstructural(nuevo);
}

function actualizarIconoTemaEstructural(tema) {
  const btn = document.getElementById("btn-cambiar-tema");
  if (!btn) return;
  if (tema === "oscuro") {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  } else {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }
}

// 🔥 INYECTOR TOTAL DE DISEÑO MINIMALISTA, ARREGLO DE BARRA, CONTADORES Y FONDO DE CIUDAD ABSTRACTA
function inyectarEstilosEstructuralesPremium() {
  if (document.getElementById("estilos-reestatales-premium")) return;
  
  // Cambiar etiquetas de texto fijas en los contadores directamente desde la raíz
  const widgetsTextos = document.querySelectorAll(".widget-anillo");
  if (widgetsTextos.length >= 4) {
    widgetsTextos[2].querySelector("p").innerText = "Asignados";
    widgetsTextos[3].querySelector("p").innerText = "Completados";
  }

  const style = document.createElement("style");
  style.id = "estilos-reestatales-premium";
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    :root {
      --font-premium: 'Inter', -apple-system, sans-serif;
      --apple-verde: #34c759;
    }
    
    /* Configuración del Fondo del Mapa de la Ciudad Difuminado */
    body {
      font-family: var(--font-premium) !important;
      background-image: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000&auto=format&fit=crop') !important;
      background-size: cover !important;
      background-position: center !important;
      background-attachment: fixed !important;
    }
    
    [data-theme="claro"] body {
      background-image: linear-gradient(rgba(255,255,255,0.75), rgba(255,255,255,0.75)), url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000&auto=format&fit=crop') !important;
    }
    
    /* Separar Barra de Progreso de Contadores Gigantes */
    .bloque-progreso-tiempo {
      margin-top: 24px !important;
      padding: 16px !important;
      background: rgba(255,255,255,0.06) !important;
      border-radius: 12px;
    }
    [data-theme="claro"] .bloque-progreso-tiempo {
      background: rgba(0,0,0,0.04) !important;
    }
    
    /* Números Gigantes de Contadores */
    .widget-anillo span, [id^="w-"] {
      font-size: 34px !important;
      font-weight: 700 !important;
    }
    
    /* Estilo Centrado de Barriada */
    .nombre-barrio-centrado {
      font-weight: 600;
      font-size: 15px;
      text-align: center;
      flex-grow: 1;
    }
    
    /* NUEVO DISEÑO: Tarjeta Horizontal Premium para Pestaña Asignados */
    .tarjeta-horizontal-premium {
      display: flex !important;
      background: rgba(30, 30, 32, 0.7) !important;
      backdrop-filter: blur(15px) !important;
      -webkit-backdrop-filter: blur(15px) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      border-radius: 12px !important;
      overflow: hidden;
      height: 90px !important;
      margin-bottom: 10px;
      box-sizing: border-box;
      align-items: center;
    }
    
    [data-theme="claro"] .tarjeta-horizontal-premium {
      background: rgba(255, 255, 255, 0.75) !important;
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
    }
    
    .borde-prioritario {
      border: 1.5px solid #ff3b30 !important;
    }
    
    .zona-izquierda-mapa {
      position: relative;
      width: 95px;
      height: 100%;
      min-width: 95px;
      background: #000;
    }
    
    .img-horizontal-asset {
      width: 100%;
      height: 100%;
      object-fit: contain !important; /* Muestra el mapa completo sin cortes */
    }
    
    .badge-id-horizontal {
      position: absolute;
      bottom: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
    }
    
    .zona-derecha-contenido {
      display: flex;
      flex-direction: column;
      padding: 10px 14px;
      justify-content: space-between;
      height: 100%;
      flex-grow: 1;
      overflow: hidden;
    }
    
    .fila-superior-barrio {
      font-weight: 600;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--texto-principal);
    }
    
    .fila-inferior-hermano {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      opacity: 0.8;
      color: var(--texto-principal);
    }
    
    .fila-estado-tag {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .indicador-circulo {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
    }
    .color-calle { background-color: #ff9500; }
    .color-hecho { background-color: var(--apple-verde); }
    
    .texto-estado-lbl {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.7;
    }
    
    /* DISEÑO TOTAL EN PANTALLA COMPLETA PARA PANEL DE ASIGNACIÓN (ABRAZA TODO EL ANCHO) */
    #panel-asignacion-unico {
      position: fixed !important;
      bottom: 54px !important; /* Pegado justo arriba de la barra de control de pestañas inferior */
      left: 0 !important;
      right: 0 !important;
      transform: none !important;
      width: 100% !important;
      max-width: 100% !important;
      background: rgba(20, 20, 22, 0.85) !important;
      backdrop-filter: blur(25px) !important;
      -webkit-backdrop-filter: blur(25px) !important;
      border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-left: none !important;
      border-right: none !important;
      border-bottom: none !important;
      border-radius: 16px 16px 0 0 !important;
      padding: 14px 20px !important;
      box-shadow: 0 -10px 30px rgba(0,0,0,0.3) !important;
      box-sizing: border-box !important;
      gap: 12px;
      z-index: 99999 !important;
    }
    
    [data-theme="claro"] #panel-asignacion-unico {
      background: rgba(255, 255, 255, 0.85) !important;
      border-top: 1px solid rgba(0, 0, 0, 0.08) !important;
      box-shadow: 0 -10px 30px rgba(0,0,0,0.05) !important;
    }
    
    #sel-hermano-unico {
      flex-grow: 1 !important;
      background: rgba(255,255,255,0.08) !important;
      color: var(--texto-principal) !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      border-radius: 8px;
      padding: 10px !important;
      font-size: 13px;
    }
    
    [data-theme="claro"] #sel-hermano-unico {
      background: rgba(0,0,0,0.05) !important;
      border: 1px solid rgba(0,0,0,0.08) !important;
    }
    
    #btn-asignar-multiple {
      padding: 10px 18px !important;
      white-space: nowrap !important;
      border-radius: 8px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
    }
    
    /* Menú de Sub-Agrupación Superior Premium para Asignados */
    .menu-agrupacion-premium {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: rgba(255,255,255,0.04);
      border-radius: 10px;
      margin-bottom: 14px;
    }
    [data-theme="claro"] .menu-agrupacion-premium {
      background: rgba(0,0,0,0.03);
    }
    .titulo-filtro-lbl {
      font-size: 12px;
      font-weight: 600;
      opacity: 0.6;
    }
    .btn-sub-filtro {
      background: rgba(120, 120, 128, 0.12);
      border: none;
      color: var(--texto-principal);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-sub-filtro.activo {
      background: var(--texto-principal);
      color: var(--fondo-principal);
      font-weight: 600;
    }
    .tag-prioritario-abajo {
      background: rgba(255, 59, 48, 0.15) !important;
      color: #ff3b30 !important;
      font-size: 9px !important;
      font-weight: 700 !important;
      padding: 2px 6px !important;
      border-radius: 4px;
    }
  `;
  document.head.appendChild(style);
}
