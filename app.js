// app.js - VERSIÓN CORREGIDA (Lógica de estados invertida según requerimiento)
// Estado Pendiente: entregado=true, trabajado=false
// Estado Terminado: entregado=true, trabajado=true

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
  inyectarEstilosCorreccionSelector();
  
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
    const infoA = diccionarioGruposHermanos[a];
    const infoB = diccionarioGruposHermanos[b];
    const grupoA = infoA && typeof infoA === 'object' ? String(infoA.grupo).trim() : String(infoA || "").trim();
    const grupoB = infoB && typeof infoB === 'object' ? String(infoB.grupo).trim() : String(infoB || "").trim();
    
    const grupoActualStr = String(grupoFiltro).trim();

    if (grupoA === grupoActualStr && grupoB !== grupoActualStr) return -1;
    if (grupoA !== grupoActualStr && grupoB === grupoActualStr) return 1;
    return a.localeCompare(b);
  });
  
  const selectorUnico = document.getElementById("sel-hermano-unico");
  if (!selectorUnico) return;
  
  selectorUnico.innerHTML = '<option value="" data-tiene-territorio="no" data-telefono="">Seleccionar Hermano...</option>';
  
  listaHermanosPool.forEach(nombre => {
    const opt = document.createElement("option");
    opt.value = nombre;
    
    const tieneMapasAsignados = baseDatosCompleta.some(m => m.hermano && m.hermano.trim().toLowerCase() === nombre.trim().toLowerCase() && m.entregado === true);
    opt.setAttribute("data-tiene-territorio", tieneMapasAsignados ? "si" : "no");
    
    let telClean = "";
    const infoHermano = diccionarioGruposHermanos[nombre];
    if (infoHermano && typeof infoHermano === 'object' && infoHermano.whatsapp) {
      telClean = infoHermano.whatsapp.toString().replace(/\s+/g, '').replace('+', '').replace('-', '');
    } else {
      const mapaConWA = baseDatosCompleta.find(m => m.hermano && m.hermano.trim().toLowerCase() === nombre.toLowerCase() && m.whatsapp);
      if (mapaConWA && mapaConWA.whatsapp) {
        telClean = mapaConWA.whatsapp.toString().replace(/\s+/g, '').replace('+', '').replace('-', '');
      }
    }
    
    if (telClean !== "" && !telClean.startsWith("34")) telClean = "34" + telClean;
    opt.setAttribute("data-telefono", telClean);

    const marcaDiscreta = tieneMapasAsignados ? " ₍✓₎" : " ₍₋₎";
    
    const infoH = diccionarioGruposHermanos[nombre];
    const grupoH = infoH && typeof infoH === 'object' ? infoH.grupo : infoH;
    const esDeEsteGrupo = (String(grupoH).trim() === String(grupoFiltro).trim());
    const prefijoGrupo = esDeEsteGrupo ? "● " : "";
    
    opt.innerText = `${prefijoGrupo}${nombre}${marcaDiscreta}`;
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
  const calle = grupoMapas.filter(m => m.entregado === true && m.trabajado === false).length;
  const hechos = grupoMapas.filter(m => m.entregado === true && m.trabajado === true).length;
  
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
  criterioOrdenacionAsignados = criterion;
  criterioOrdenacionAsignados = criterio;
  filtrarYRenderizar();
}

function filtrarYRenderizar() {
  const grid = document.getElementById("contenedor-principal-grid");
  if (!grid) return;
  
  const contenedorBusqueda = document.querySelector(".contenedor-busqueda");
  if (contenedorBusqueda) {
    contenedorBusqueda.style.display = vistaActual === "asignados" ? "none" : "block";
  }

  const buscadorValue = vistaActual === "disponibles" && document.getElementById("input-busqueda") 
    ? document.getElementById("input-busqueda").value.toLowerCase() 
    : "";
    
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
      dataset.sort((a, b) => {
        let fA = a.fechaEntrega || 0;
        let fB = b.fechaEntrega || 0;
        if (fA === "Sin fecha" || !fA) return 1;
        if (fB === "Sin fecha" || !fB) return -1;
        return new Date(fB) - new Date(fA);
      });
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
      div.className = `tarjeta-apple-horizontal ${esPrio ? 'prioritaria-row' : ''}`;
      div.setAttribute("data-id-mapa", mapa.id);
      
      let rawFecha = mapa.fechaEntrega;
      let fechaFormateada = "Sin fecha";
      if (rawFecha && rawFecha !== "Sin fecha") {
        const f = new Date(rawFecha);
        if (!isNaN(f.getTime())) {
          fechaFormateada = f.toLocaleDateString("es-ES", { day: '2-digit', month: '2-digit', year: '2-digit' });
        } else {
          fechaFormateada = rawFecha;
        }
      }

      div.innerHTML = `
        <div class="contenido-deslizable" id="capa-swipe-${mapa.id}">
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
            </div>
            <div class="pie-fechas-horizontal">
              <span class="txt-horizontal-fecha">Entrega: ${fechaFormateada}</span>
              <div class="contenedor-estado-pill">
                ${mapa.trabajado === true 
                  ? `<span class="pill-estado terminado">Hecho</span>` 
                  : `<span class="pill-estado pendiente">Calle</span>`
                }
              </div>
            </div>
          </div>
        </div>
        <div class="acciones-deslizable-derecha">
          <button class="btn-accion-swipe desasignar" onclick="cambiarEstadoTerritorioDirecto('${mapa.id}', 'desasignar')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>Quitar</span>
          </button>
          <button class="btn-accion-swipe completar" onclick="cambiarEstadoTerritorioDirecto('${mapa.id}', 'completar')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>${mapa.trabajado === true ? 'Deshacer' : 'Hecho'}</span>
          </button>
        </div>
      `;
      
      asociarGestosDeslizamiento(div, mapa.id);
    }
    grid.appendChild(div);
  });
}

function asociarGestosDeslizamiento(elementoTarjeta, idMapa) {
  let xInicial = null;
  let yInicial = null;
  let desplazado = false;
  const capaMovil = elementoTarjeta.querySelector('.contenido-deslizable');
  const anchoMaximoBotones = 140;

  elementoTarjeta.addEventListener('touchstart', (e) => {
    xInicial = e.touches[0].clientX;
    yInicial = e.touches[0].clientY;
  }, { passive: true });

  elementoTarjeta.addEventListener('touchmove', (e) => {
    if (!xInicial || !yInicial) return;
    
    let xActual = e.touches[0].clientX;
    let yActual = e.touches[0].clientY;
    
    let diferenciaX = xInicial - xActual;
    let diferenciaY = yInicial - yActual;

    if (Math.abs(diferenciaX) > Math.abs(diferenciaY)) {
      if (diferenciaX > 35 && !desplazado) {
        capaMovil.style.transform = `translateX(-${anchoMaximoBotones}px)`;
        desplazado = true;
      } else if (diferenciaX < -35 && desplazado) {
        capaMovil.style.transform = 'translateX(0px)';
        desplazado = false;
      }
    }
  }, { passive: true });
}

async function cambiarEstadoTerritorioDirecto(idMapa, accion) {
  const indice = baseDatosCompleta.findIndex(m => m.id.toString() === idMapa.toString());
  if (indice === -1) return;

  const capaMovil = document.getElementById(`capa-swipe-${idMapa}`);
  if (capaMovil) capaMovil.style.transform = 'translateX(0px)';

  const originalEntregado = baseDatosCompleta[indice].entregado;
  const originalTrabajado = baseDatosCompleta[indice].trabajado;
  const originalHermano = baseDatosCompleta[indice].hermano;
  const originalFecha = baseDatosCompleta[indice].fechaEntrega;

  let urlPeticion = "";

  if (accion === 'desasignar') {
    baseDatosCompleta[indice].entregado = false;
    baseDatosCompleta[indice].trabajado = false;
    baseDatosCompleta[indice].hermano = "";
    baseDatosCompleta[indice].fechaEntrega = "Sin fecha";
    urlPeticion = `${URL_API_SHEETS}?accion=desasignar&id=${encodeURIComponent(idMapa)}`;
  } else if (accion === 'completar') {
    baseDatosCompleta[indice].trabajado = !baseDatosCompleta[indice].trabajado;
    const modoApi = baseDatosCompleta[indice].trabajado ? "completar" : "deshacer";
    urlPeticion = `${URL_API_SHEETS}?accion=${modoApi}&id=${encodeURIComponent(idMapa)}`;
  }

  actualizarAnillosEstadisticos();
  filtrarYRenderizar();

  try {
    await fetch(urlPeticion, { method: "GET", mode: "no-cors" });
    console.log(`Sincronización exitosa: ${accion} - #${idMapa}`);
  } catch (error) {
    console.error("Fallo de conexión diferida:", error);
    alert("Error de red. Revirtiendo cambio...");
    baseDatosCompleta[indice].entregado = originalEntregado;
    baseDatosCompleta[indice].trabajado = originalTrabajado;
    baseDatosCompleta[indice].hermano = originalHermano;
    baseDatosCompleta[indice].fechaEntrega = originalFecha;
    actualizarAnillosEstadisticos();
    filtrarYRenderizar();
  }
}

function alternarSeleccionTarjeta(idMapa, event) {
  if (event && event.target.closest(".btn-lupa-flotante")) return;
  
  const idStr = idMapa.toString();
  const index = territoriosSeleccionados.indexOf(idStr);
  
  if (index > -1) {
    territoriosSeleccionados.splice(index, 1);
  } else {
    territoriosSeleccionados.push(idStr);
  }
  
  const tarjeta = document.getElementById(`tarjeta-real-${idStr}`);
  const circulo = document.getElementById(`circulo-check-${idStr}`);
  
  if (tarjeta && circulo) {
    if (territoriosSeleccionados.includes(idStr)) {
      tarjeta.classList.add("seleccionada");
      circulo.classList.add("checked");
    } else {
      tarjeta.classList.remove("seleccionada");
      circulo.classList.remove("checked");
    }
  }
  actualizarPanelAsignacionFlotante();
}

function conmutarVista(vista) {
  vistaActual = vista;
  document.getElementById("tab-disponibles").classList.toggle("activa", vista === "disponibles");
  document.getElementById("tab-asignados").classList.toggle("activa", vista === "asignados");
  filtrarYRenderizar();
}

function actualizarPanelAsignacionFlotante() {
  const panel = document.getElementById("panel-asignacion-unico");
  if (!panel) return;
  
  if (vistaActual === "disponibles" && territoriosSeleccionados.length > 0) {
    panel.style.display = "flex";
    const txtContador = document.getElementById("txt-contador-seleccionados");
    if (txtContador) {
      txtContador.innerText = `${territoriosSeleccionados.length} select.`;
    }
  } else {
    panel.style.display = "none";
  }
}

async function ejecutarAsignacionMasivaEncargado() {
  const selector = document.getElementById("sel-hermano-unico");
  if (!selector) return;
  
  const hermanoDestino = selector.value;
  if (!hermanoDestino || hermanoDestino.trim() === "") {
    alert("Por favor, selecciona un hermano de la lista.");
    return;
  }
  
  if (territoriosSeleccionados.length === 0) return;
  
  const totalAsignar = territoriesSeleccionados.length;
  const listadoIdsCopia = [...territoriosSeleccionados];
  
  const btnCarga = document.getElementById("btn-confirmar-asignacion-masiva");
  let textoOriginalBtn = btnCarga ? btnCarga.innerHTML : "Asignar";
  if (btnCarga) {
    btnCarga.disabled = true;
    btnCarga.innerText = "Sincronizando...";
  }

  // Actualización local UI optimista
  listadoIdsCopia.forEach(idMapa => {
    const idx = baseDatosCompleta.findIndex(m => m.id.toString() === idMapa.toString());
    if (idx !== -1) {
      baseDatosCompleta[idx].entregado = true;
      baseDatosCompleta[idx].trabajado = false;
      baseDatosCompleta[idx].hermano = hermanoDestino;
      baseDatosCompleta[idx].fechaEntrega = new Date().toISOString();
    }
  });

  territoriosSeleccionados = [];
  actualizarPanelAsignacionFlotante();
  actualizarAnillosEstadisticos();
  filtrarYRenderizar();
  extraerNombresDeHermanos();

  try {
    const idsString = listadoIdsCopia.join(",");
    const url = `${URL_API_SHEETS}?accion=asignarMasivo&ids=${encodeURIComponent(idsString)}&hermano=${encodeURIComponent(hermanoDestino)}`;
    
    await fetch(url, { method: "GET", mode: "no-cors" });
    console.log("Asignación masiva completada correctamente.");
  } catch (err) {
    console.error("Error de red masivo:", err);
    alert("Ocurrió un inconveniente al conectar con el servidor.");
    await descargarDatosDesdeSheets();
  } finally {
    if (btnCarga) {
      btnCarga.disabled = false;
      btnCarga.innerHTML = textoOriginalBtn;
    }
  }
}

function inyectarSelectorDeAgrupacionAsignados() {
  if (document.getElementById("contenedor-sub-filtros-asignados")) return;
  const cabeceraGrid = document.getElementById("contenedor-principal-grid");
  if (!cabeceraGrid) return;
  
  const contenedorFiltros = document.createElement("div");
  contenedorFiltros.id = "contenedor-sub-filtros-asignados";
  contenedorFiltros.className = "contenedor-sub-filtros";
  contenedorFiltros.innerHTML = `
    <button class="btn-sub-filtro ${criterioOrdenacionAsignados === 'territorio' ? 'activo' : ''}" onclick="cambiarCriterioAsignados('territorio')">Nº Mapa</button>
    <button class="btn-sub-filtro ${criterioOrdenacionAsignados === 'hermano' ? 'activo' : ''}" onclick="cambiarCriterioAsignados('hermano')">Hermano</button>
    <button class="btn-sub-filtro ${criterioOrdenacionAsignados === 'fecha' ? 'activo' : ''}" onclick="cambiarCriterioAsignados('fecha')">Fecha</button>
  `;
  cabeceraGrid.parentNode.insertBefore(contenedorFiltros, cabeceraGrid);
}

function eliminarSelectorDeAgrupacionAsignados() {
  const el = document.getElementById("contenedor-sub-filtros-asignados");
  if (el) el.remove();
}

function abrirVisorPantallaCompleta(src, titulo, event) {
  if (event) event.stopPropagation();
  const modal = document.getElementById("modal-visor-pantalla-completa");
  const img = document.getElementById("img-visor-completa");
  const txt = document.getElementById("titulo-visor-completo");
  
  if (modal && img) {
    img.src = src;
    if (txt) txt.innerText = titulo;
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
}

function cerrarVisorPantallaCompleta() {
  const modal = document.getElementById("modal-visor-pantalla-completa");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }
}

function configurarTemaInicial() {
  const temaGuardado = localStorage.getItem("tema-premium") || "oscuro";
  document.documentElement.setAttribute("data-theme", temaGuardado);
}

function conmutarTema() {
  const actual = document.documentElement.getAttribute("data-theme");
  const nuevo = actual === "claro" ? "oscuro" : "claro";
  document.documentElement.setAttribute("data-theme", nuevo);
  localStorage.setItem("tema-premium", nuevo);
}

function inyectarEstilosCorreccionSelector() {
  const idStyle = "estilo-correccion-select-flotante";
  if (document.getElementById(idStyle)) return;
  const style = document.createElement("style");
  style.id = idStyle;
  style.innerHTML = `
    #panel-asignacion-unico {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 84px;
      display: none;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 1500;
      background-color: rgba(18, 18, 20, 0.95) !important;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    #txt-contador-seleccionados { color: #ffffff !important; font-weight: 600; }
    #sel-hermano-unico {
      background-color: rgba(255, 255, 255, 0.08) !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      font-size: 14px !important;
    }
    #sel-hermano-unico option { background-color: #1c1c1e !important; color: #ffffff !important; }

    [data-theme="claro"] #panel-asignacion-unico {
      background-color: rgba(242, 242, 247, 0.9) !important;
      border-top: 1px solid rgba(0, 0, 0, 0.1) !important;
      box-shadow: 0 -4px 12px rgba(0,0,0,0.05);
    }
    [data-theme="claro"] #txt-contador-seleccionados { color: #1c1c1e !important; }
    [data-theme="claro"] #sel-hermano-unico {
      background-color: #ffffff !important;
      color: #1c1c1e !important;
      border: 1px solid rgba(0, 0, 0, 0.15) !important;
    }
    [data-theme="claro"] #sel-hermano-unico option { background-color: #ffffff !important; color: #1c1c1e !important; }
  `;
  document.head.appendChild(style);
}
