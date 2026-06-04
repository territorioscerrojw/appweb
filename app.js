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
let criterioOrdenacionAsignados = "pendiente"; 

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
  
  selectorUnico.innerHTML = '<option value="" data-tiene-territorio="no" data-telefono="">Seleccionar Hermano/a...</option>';
  
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
  
  // Calcular porcentaje de tiempo transcurrido
  const tiempoTotal = fin - inicio;
  const tiempoTranscurrido = ahora - inicio;
  let porcentaje = Math.floor((tiempoTranscurrido / tiempoTotal) * 100);
  porcentaje = Math.max(0, Math.min(100, porcentaje));
  
  // Lógica de textos según el momento
  let msgTiempo = "";
  let dias = 0;

  if (ahora < inicio) {
    // Aún no ha empezado
    dias = Math.ceil((inicio - ahora) / (1000 * 60 * 60 * 24));
    msgTiempo = `Faltan ${dias} días para que empiece la campaña`;
    porcentaje = 0; // Barra vacía si no ha empezado
  } else if (ahora > fin) {
    // Ya terminó
    msgTiempo = "Campaña concluida";
    porcentaje = 100;
  } else {
    // Durante la campaña
    dias = Math.ceil((fin - ahora) / (1000 * 60 * 60 * 24));
    msgTiempo = `Quedan ${dias} días de campaña`;
  }
  
  // Actualizar etiquetas
  if (document.getElementById("lbl-tiempo-restante")) document.getElementById("lbl-tiempo-restante").innerText = msgTiempo;
  if (document.getElementById("lbl-porcentaje-tiempo")) document.getElementById("lbl-porcentaje-tiempo").innerText = `${porcentaje}%`;
  
  const barra = document.getElementById("barra-progreso-elemento");
  if (barra) {
    barra.style.width = `${porcentaje}%`;
    
    // Limpiar clases
    barra.classList.remove("neon-verde", "neon-naranja", "neon-rojo");
    
    // Asignar color solo si la campaña está en curso (o cerca de terminar)
    if (ahora >= inicio && ahora <= fin) {
        if (dias <= 3) {
            barra.classList.add("neon-rojo");
        } else if (dias <= 7) {
            barra.classList.add("neon-naranja");
        } else {
            barra.classList.add("neon-verde");
        }
    }
  }
}
function actualizarAnillosEstadisticos() {
  const grupoMapas = baseDatosCompleta.filter(m => m.grupo == grupoFiltro);
  const total = grupoMapas.length;
  
  const prio = grupoMapas.filter(m => m.prioritario === "SI" || m.prioritario === true || String(m.prioritario).toUpperCase() === "TRUE").length;
  
  // CORRECCIÓN AQUÍ:
  // 'asignados' ahora cuenta todos los que tienen entregado = true (sin importar el estado de trabajo)
  const asignadosTotales = grupoMapas.filter(m => m.entregado === true).length;
  
  // 'calle' (pendientes) sigue siendo entregado = true Y trabajado = false
  const calle = grupoMapas.filter(m => m.entregado === true && m.trabajado === false).length;
  
  // 'hechos' (completados) sigue siendo entregado = true Y trabajado = true
  const hechos = grupoMapas.filter(m => m.entregado === true && m.trabajado === true).length;
  
  if (document.getElementById("w-totales")) document.getElementById("w-totales").innerText = total;
  if (document.getElementById("w-prioritarios")) document.getElementById("w-prioritarios").innerText = prio;
  
  // Cambiamos el valor de w-asignados para mostrar el total de asignados
  if (document.getElementById("w-asignados")) document.getElementById("w-asignados").innerText = asignadosTotales;
  if (document.getElementById("w-completados")) document.getElementById("w-completados").innerText = hechos;
  
  // Actualizamos los arcos (puedes ajustar el valor de asignados a 'asignadosTotales' o 'calle' según prefieras mostrar)
  inyectarArcoProgreso("progreso-prioritarios", prio, total);
  inyectarArcoProgreso("progreso-asignados", asignadosTotales, total); 
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
  // Actualiza los botones activos visualmente
  actualizarEstadosBotonesFiltro();
  // Vuelve a filtrar y pintar todo con el nuevo orden
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
  
  // Lógica de ordenación
  if (vistaActual === "disponibles") {
    dataset.sort((a, b) => {
      let aPrio = a.prioritario === "SI" || a.prioritario === true || String(a.prioritario).toUpperCase() === "TRUE";
      let bPrio = b.prioritario === "SI" || b.prioritario === true || String(b.prioritario).toUpperCase() === "TRUE";
      return (aPrio === bPrio) ? (parseInt(a.id) - parseInt(b.id)) : (aPrio ? -1 : 1);
    });
    // Lógica de ordenación corregida
  } else {
    dataset.sort((a, b) => {
      if (criterioOrdenacionAsignados === "territorio") {
        return parseInt(a.id) - parseInt(b.id);
      } 
      if (criterioOrdenacionAsignados === "hermano") {
        return (a.hermano || "").localeCompare(b.hermano || "");
      }
      if (criterioOrdenacionAsignados === "fecha") {
        return new Date(b.fechaEntrega || 0) - new Date(a.fechaEntrega || 0);
      }
      // NUEVA LÓGICA: Filtro por pendientes primero
      if (criterioOrdenacionAsignados === "pendiente") {
        // Si a es pendiente (trabajado = false) y b no, a va primero (-1)
        return (a.trabajado === b.trabajado) ? 0 : (a.trabajado ? 1 : -1);
      }
      return 0;
    });
  }

  
  dataset.forEach(mapa => {
    const div = document.createElement("div");
    const esPrio = mapa.prioritario === "SI" || mapa.prioritario === true || String(mapa.prioritario).toUpperCase() === "TRUE";
    const seleccionadoActivo = territoriosSeleccionados.includes(mapa.id.toString());
    
    if (vistaActual === "disponibles") {
      // --- FORMATO DISPONIBLES ORIGINAL RESTAURADO ---
  
div.className = `tarjeta-apple ${esPrio ? 'prioritaria' : ''} ${seleccionadoActivo ? 'seleccionada' : ''}`;

      div.id = `tarjeta-real-${mapa.id}`;
      div.setAttribute("onclick", `alternarSeleccionTarjeta('${mapa.id}', event)`);
      
      div.innerHTML = `
        <div class="fila-tarjeta-superior">
          <span class="num-mapa-gigante">${parseInt(mapa.id)}</span>
          <span class="barriada-derecha">${mapa.barriada}</span>
        </div>
        <div class="imagen-mapa-wrapper">
          <button class="btn-lupa-flotante" onclick="abrirVisorPantallaCompleta('${mapa.rutaMapa}', '${parseInt(mapa.id)} - ${mapa.barriada}', event)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
          <img src="${mapa.rutaMapa}" class="imagen-mapa-asset" onerror="this.src='https://placehold.co/400x300?text=Mapa+no+disponible'">
        </div>
                          <div class="fila-tarjeta-inferior">
          <div class="bloque-prio-izq" style="min-height: 25px;">
            ${esPrio ? `<span class="tag-prioritario-esquina">⚠️ PRIORITARIO</span>` : ''}
          </div>
          <button class="btn-check-rectangular" type="button" onclick="alternarSwitchHaptico(this)"></button>
         </div>`;
    } else {
      // --- FORMATO ASIGNADOS (MANTIENE EL QUE TE GUSTABA) ---
      div.className = `tarjeta-apple-horizontal ${esPrio ? 'prioritaria-row' : ''}`;
      let fechaFormateada = (mapa.fechaEntrega && mapa.fechaEntrega !== "Sin fecha") ? new Date(mapa.fechaEntrega).toLocaleDateString("es-ES", {day:'2-digit', month:'2-digit', year:'2-digit'}) : "Sin fecha";
      
              // Dentro de la sección 'else' de filtrarYRenderizar:
div.innerHTML = `
 <div class="contenedor-columna-imagen">
    ${esPrio ? `<span class="tag-prio-bloque">⚠️ PRIORITARIO</span>` : ''}
    <div class="img-lateral-wrapper-rectangular">
      
<button class="btn-lupa-flotante" 
        onclick="abrirVisorPantallaCompleta('${mapa.rutaMapa}', '${parseInt(mapa.id)}', event)">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
</button>

       <img src="${mapa.rutaMapa}" class="imagen-lateral-asset-rect">
    </div>
  </div>
  <div class="contenido-lateral-datos">
    <div class="cabecera-datos-linea">
      <span class="num-mapa-chico">${parseInt(mapa.id)}</span>
      <span class="nombre-barrio-chico">${mapa.barriada}</span>
    </div>
    
    <div class="fila-dato-simple">👤 ${mapa.hermano || 'No asignado'}</div>
    <div class="fila-dato-simple">📅 ${fechaFormateada}</div>
    
    <div class="estado-badge-linea" style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
      <span class="badge-estado-pill ${!mapa.trabajado ? 'estado-calle' : 'estado-hecho'}">
        ${!mapa.trabajado ? "Pendiente" : "Completado"}
      </span>
      
      <button class="btn-check-apple ${mapa.trabajado ? 'activo' : ''}" 
              onclick="toggleEstadoTrabajo(${mapa.id}, event)"
              style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid #34c759; background: ${mapa.trabajado ? '#34c759' : 'transparent'}; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;">
        ${mapa.trabajado ? '<span style="color:white; font-size: 16px; font-weight:bold;">✓</span>' : ''}
      </button>
    </div>
    
  </div>`;


    }
    grid.appendChild(div);
  });
}

async function toggleEstadoTrabajo(idMapa, event) {
  event.preventDefault();
  const btn = event.currentTarget;
  
  const mapa = baseDatosCompleta.find(m => m.id.toString() === idMapa.toString());
  if (!mapa) return;

  // 1. Determinar la acción y el mensaje
  const nuevoEstado = !mapa.trabajado;
  const mensaje = nuevoEstado 
    ? `¿Marcar como terminado el territorio ${mapa.id}?` 
    : `¿Reactivar el territorio ${mapa.id}?`;

  // 2. Mostrar la ventana de confirmación
  if (!confirm(mensaje)) {
    // Si el usuario presiona "Cancelar", no hacemos nada y salimos
    return;
  }

  // 3. SI EL USUARIO ACEPTÓ, procedemos con la lógica:
  
  // Actualizar la "Fuente de la Verdad"
  mapa.trabajado = nuevoEstado;
  
  // Actualizar Interfaz (Visual + Contadores)
  actualizarAnillosEstadisticos();
  
  btn.classList.toggle('activo', nuevoEstado);
  btn.style.background = nuevoEstado ? '#34c759' : 'transparent';
  btn.innerHTML = nuevoEstado ? '<span style="color:white; font-size: 16px; font-weight:bold;">✓</span>' : '';
  
  filtrarYRenderizar(); 
  
  // 4. Llamada al servidor
  const s = document.createElement("script");
  s.src = `${URL_API_SHEETS}?accion=actualizarTrabajo&id=${idMapa}&estado=${nuevoEstado}`;
  s.onload = () => s.remove();
  document.body.appendChild(s);
}

function inyectarSelectorDeAgrupacionAsignados() {
  if (document.getElementById("contenedor-agrupador-asignados")) {
    actualizarEstadosBotonesFiltro();
    return;
  }
  const mainContenido = document.getElementById("contenedor-principal-grid");
  if (!mainContenido) return;
  
  const navAgrupador = document.createElement("div");
  navAgrupador.id = "contenedor-agrupador-asignados";
  navAgrupador.style = "display: flex; gap: 6px; padding: 10px 0; width: 100%; overflow-x: auto;";
  mainContenido.parentNode.insertBefore(navAgrupador, mainContenido);
  
  actualizarEstadosBotonesFiltro();
}

function actualizarEstadosBotonesFiltro() {
  const contenedor = document.getElementById("contenedor-agrupador-asignados");
  if (!contenedor) return;
  
  contenedor.innerHTML = `
    <span style="font-size: 12px; opacity: 0.6; align-self: center; margin-right: 4px; white-space: nowrap;">Ordenar por:</span>
    <button class="btn-sub-filtro btn-pendientes ${criterioOrdenacionAsignados === 'pendiente' ? 'activo' : ''}" 
            onclick="cambiarCriterioAsignados('pendiente')">Pendientes</button>
    <button class="btn-sub-filtro ${criterioOrdenacionAsignados === 'territorio' ? 'activo' : ''}" 
            onclick="cambiarCriterioAsignados('territorio')">Territorio</button>
    <button class="btn-sub-filtro ${criterioOrdenacionAsignados === 'hermano' ? 'activo' : ''}" 
            onclick="cambiarCriterioAsignados('hermano')">Hermano</button>
    <button class="btn-sub-filtro ${criterioOrdenacionAsignados === 'fecha' ? 'activo' : ''}" 
            onclick="cambiarCriterioAsignados('fecha')">Fecha Entrega</button>
  `;
}


function eliminarSelectorDeAgrupacionAsignados() {
  const el = document.getElementById("contenedor-agrupador-asignados");
  if (el) el.remove();
}

function alternarSeleccionTarjeta(idMapa, evento) {
  if (evento.target.closest('.btn-lupa-flotante')) return;
   // --- INICIO DE LA PULSACIÓN HÁPTICA ---
  // Vibrar 10ms (muy breve y sutil, ideal para interfaces)
  if (window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(10); 
  }
  // --- FIN DE LA PULSACIÓN HÁPTICA ---
  
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

function procesarAsignacionMultiple() {
  const selector = document.getElementById("sel-hermano-unico");
  const nombreH = selector.value;
  
  if (!nombreH || territoriosSeleccionados.length === 0) return;

  const opcionSeleccionada = selector.options[selector.selectedIndex];
  const textoVisible = opcionSeleccionada.innerText; 
  const telefonoWhatsApp = opcionSeleccionada.getAttribute("data-telefono") || "";

  if (textoVisible.includes("₍₋₎") && telefonoWhatsApp !== "") {
    const enlacePersonal = `https://project-n5rfv.vercel.app/personalweb.html?id=${encodeURIComponent(nombreH.trim())}`;
    const mensaje = `Hola ${nombreH.trim()}, te damos la bienvenida a tu panel personal de territorios para la campaña. 🗺️\n\nDesde este enlace podrás ver y gestionar todos los territorios que se te vayan asignando:\n\n${enlacePersonal}\n\n¡Muchas gracias por tu apoyo!`;
    const urlWhatsApp = `https://api.whatsapp.com/send?phone=${telefonoWhatsApp}&text=${encodeURIComponent(mensaje)}`;

    const enlaceFantasma = document.createElement("a");
    enlaceFantasma.href = urlWhatsApp;
    enlaceFantasma.target = "_blank";
    enlaceFantasma.rel = "noopener noreferrer";
    document.body.appendChild(enlaceFantasma);
    enlaceFantasma.click();
    enlaceFantasma.remove();
  }

  const copiaSeleccionados = [...territoriosSeleccionados];

  baseDatosCompleta.forEach(mapa => {
    if (copiaSeleccionados.includes(mapa.id.toString())) {
      mapa.entregado = true;
      mapa.hermano = nombreH;
      mapa.fechaEntrega = new Date().toISOString();
      mapa.trabajado = false; // NUEVA LÓGICA: Se guarda en FALSO al asignar (Significa Pendiente/En la calle)
    }
  });

  territoriosSeleccionados = [];
  actualizarPanelAsignacionFlotante();
  actualizarAnillosEstadisticos();
  filtrarYRenderizar(); 

  ejecutarEnvioParaleloServidor(copiaSeleccionados, nombreH);
}

async function ejecutarEnvioParaleloServidor(listaIds, nombreHermano) {
  try {
    const promesas = listaIds.map(id => lanzarPeticionGoogleAsincrona(id, nombreHermano));
    await Promise.all(promesas); 
    await descargarDatosDesdeSheets();
  } catch (e) {
    console.error("Error al guardar en background", e);
  }
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
  
  // Ordenar para que los pendientes (trabajado === false) aparezcan al principio
  asignadosHermano.sort((a,b) => a.trabajado - b.trabajado);
  
  asignadosHermano.forEach(mapa => {
    const div = document.createElement("div");
    // NUEVA LÓGICA: Si ya está trabajado (true), se le añade la opacidad visual de 'terminado'
    div.className = `tarjeta-apple ${mapa.trabajado ? 'terminado' : ''}`;
    
    // NUEVA LÓGICA: Si NO está trabajado (false), se le ofrece el botón para completarlo
    let accionBotonHTML = `<button class="btn-completar-hermano" onclick="ejecutarHechoHermano(${mapa.id}, this)">Completado</button>`;
    if (mapa.trabajado) {
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

function alternarEstadoTrabajo(idMapa, checkbox) {
  const nuevoEstado = checkbox.checked; // true o false
  
  // Feedback visual rápido
  console.log("Cambiando ID " + idMapa + " a: " + nuevoEstado);
  
  const s = document.createElement("script");
  // La URL debe ser exacta. Verifica que URL_API_SHEETS esté bien definida al inicio
  s.src = `${URL_API_SHEETS}?accion=actualizarTrabajo&id=${idMapa}&estado=${nuevoEstado}&callback=callback_${new Date().getTime()}`;
  
  // Creamos un callback único para esta petición
  window["callback_" + new Date().getTime()] = () => {
    s.remove();
    descargarDatosDesdeSheets(); // Recarga la vista
  };

  document.body.appendChild(s);
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
}

function inyectarEstilosCorreccionSelector() {
  if (document.getElementById("hoja-estilos-dinamica-selector")) return;
  const style = document.createElement("style");
  style.id = "hoja-estilos-dinamica-selector";
  style.innerHTML = `
    #panel-asignacion-unico {
      background-color: rgba(0, 0, 0, 0.75) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
      /* Eliminamos el borde sólido si es lo que genera la línea blanca */
      border: none !important; 
      border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
    }

    [data-theme="claro"] #panel-asignacion-unico {
      background-color: rgba(255, 255, 255, 0.75) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
      border: none !important;
      border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
    }
       [data-theme="oscuro"] .tarjeta-apple {
      background: var(--glass-fondo) !important; /* Ajusta este color */
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
    }
    
    /* Aseguramos que el contenido interno no tenga fondo opaco */
    .contenido-panel-flotante {
      background: transparent !important;
    }
  `;
  document.head.appendChild(style);
}

function limpiarSeleccionYEsconder() {
  console.log("Limpiando selección...");

  // 1. Vaciar el array principal
  territoriosSeleccionados = [];
  
  // 2. BUSCAR Y DESMARCAR: 
  // Aquí debes usar el nombre de la clase que aplicas cuando seleccionas un territorio.
  // Si en tu código usas '.seleccionada', asegúrate de que sea ese nombre.
  const seleccionados = document.querySelectorAll('.seleccionada'); 
  
  console.log("Elementos encontrados para desmarcar: " + seleccionados.length);
  
  seleccionados.forEach(el => {
    el.classList.remove('seleccionada');
  });
  
  // 3. Esconder el panel
  const panel = document.getElementById("panel-asignacion-unico");
  if (panel) panel.classList.remove("visible");
  
  // 4. Resetear el selector
  const selector = document.getElementById("sel-hermano-unico");
  if (selector) selector.value = "";
  
  // 5. Actualizar botón
  evaluarEstadoBotonAsignar();
}
function alternarSwitchHaptico(element) {
  // 1. Efecto háptico (vibración de 15ms)
  if (window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(15);
  }

  // 2. Lógica visual: Cambiar el estado de la tarjeta
  // Si tu tarjeta tiene el ID asociado, aquí lo manejamos:
  element.parentElement.parentElement.classList.toggle('seleccionada');
  
  // 3. Si necesitas que esto también actualice tu array territoriosSeleccionados:
  // (Esto depende de cómo hayas implementado la selección en tu HTML)
}
