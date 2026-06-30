import { useState } from "react";
import { Download, Info } from "lucide-react";
import Modal from "../../../../components/modal/Modal.jsx";
import { avisoError } from "../../../../lib/alertas.js";
import { NOMBRES_MES } from "../../../../lib/fechas.js";
import { construirDatosAnual, construirDatosMensual } from "./datosPdf.js";
import { descargarPdf } from "./descargarPdf.js";
import CalendarioPDF from "./CalendarioPDF.jsx";
import styles from "./ModalExportarPdf.module.css";

/**
 * Diálogo previo a la descarga: elige la vista (anual o mensual)
 * @param {array}  eventosFiltrados  
 * @param {array}  eventosTodos      
 * @param {array}  tipos             
 * @param {number} defaultAnioCiclo  
 * @param {number} defaultAnio      
 * @param {number} defaultMes        
 * @param {string} calendarioNombre  
 */

export default function ModalExportarPdf({
  eventosFiltrados,
  eventosTodos,
  tipos,
  defaultAnioCiclo,
  defaultAnio,
  defaultMes,
  calendarioNombre,
  plantelesAsignados = [],
  onCerrar,
}) {
  const [vista, setVista] = useState("anual");
  const [anioCiclo, setAnioCiclo] = useState(defaultAnioCiclo);
  const [mes, setMes] = useState(defaultMes);
  const [anio, setAnio] = useState(defaultAnio);
  const [aplicarFiltros, setAplicarFiltros] = useState(true);
  const [generando, setGenerando] = useState(false);

  const ciclos = [defaultAnioCiclo - 1, defaultAnioCiclo, defaultAnioCiclo + 1];
  const anios = [defaultAnio - 1, defaultAnio, defaultAnio + 1];

  const generar = async (e) => {
    e.preventDefault();
    setGenerando(true);
    try {
      let eventos = aplicarFiltros ? eventosFiltrados : eventosTodos;
      // Con filtros activos y plantel asignado: solo los eventos de ese plantel
      // (excluye los generales de todos los planteles, que tienen plantel == null).
      if (aplicarFiltros && plantelesAsignados.length > 0) {
        eventos = eventos.filter((ev) => ev.plantel && plantelesAsignados.includes(ev.plantel));
      }
      let documento;
      let nombre;
      if (vista === "mensual") {
        const datos = construirDatosMensual({ eventos, tipos, anio, mes });
        documento = <CalendarioPDF vista="mensual" datos={datos} calendarioNombre={calendarioNombre} />;
        nombre = `Calendario_${NOMBRES_MES[mes]}_${anio}.pdf`;
      } else {
        const datos = construirDatosAnual({ eventos, tipos, anioCiclo });
        documento = <CalendarioPDF vista="anual" datos={datos} calendarioNombre={calendarioNombre} />;
        nombre = `Calendario_${anioCiclo}-${anioCiclo + 1}.pdf`;
      }
      await descargarPdf(documento, nombre);
      onCerrar();
    } catch (err) {
      avisoError(err.message || "No se pudo generar el PDF.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Modal
      abierto
      titulo="Descargar calendario (PDF)"
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton boton--fantasma" onClick={onCerrar} disabled={generando}>
            Cancelar
          </button>
          <button type="submit" form="form-exportar-pdf" className="boton boton--primario" disabled={generando}>
            <Download size={16} />
            {generando ? "Generando…" : "Descargar"}
          </button>
        </>
      }
    >
      <form id="form-exportar-pdf" className="formulario" onSubmit={generar}>
        <label className="formulario__campo">
          <span className="formulario__etiqueta">Vista</span>
          <select value={vista} onChange={(e) => setVista(e.target.value)}>
            <option value="anual">Anual (ciclo escolar)</option>
            <option value="mensual">Mensual (un solo mes)</option>
          </select>
        </label>

        {vista === "anual" ? (
          <label className="formulario__campo">
            <span className="formulario__etiqueta">Ciclo escolar</span>
            <select value={anioCiclo} onChange={(e) => setAnioCiclo(Number(e.target.value))}>
              {ciclos.map((a) => (
                <option key={a} value={a}>{a} – {a + 1}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="formulario__fila">
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Mes</span>
              <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                {NOMBRES_MES.map((nombre, i) => (
                  <option key={i} value={i}>{nombre}</option>
                ))}
              </select>
            </label>
            <label className="formulario__campo">
              <span className="formulario__etiqueta">Año</span>
              <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                {anios.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        <label className={`${styles.opcion} ${aplicarFiltros ? styles.opcionActiva : ""}`}>
          <input
            type="checkbox"
            className={styles.check}
            checked={aplicarFiltros}
            onChange={(e) => setAplicarFiltros(e.target.checked)}
          />
          <span className={styles.opcionTexto}>
            <span className={styles.opcionTitulo}>Aplicar los filtros activos en pantalla</span>
            <span className={styles.opcionDesc}>
              {plantelesAsignados.length > 0
                ? "Respeta los filtros de tipo, turno, semestre y fechas, e incluye únicamente los eventos de tu plantel (no los generales de todos los planteles). Desactívalo para incluir todos los eventos."
                : "Respeta tipo, plantel, turno y semestre seleccionados. Desactívalo para incluir todos los eventos."}
            </span>
          </span>
        </label>

        <div className={styles.hint}>
          <Info size={16} className={styles.hintIcono} />
          <span>
            {vista === "anual"
              ? "Vista horizontal de los 12 meses del ciclo (ago–jul) con los días coloreados y la simbología a la derecha. Una sola hoja."
              : "Vista horizontal con el mes en grande, las actividades marcadas en los días y la simbología a la derecha."}
          </span>
        </div>
      </form>
    </Modal>
  );
}
