import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar, Clock, MapPin, Building2, CalendarDays, CalendarCheck, ChevronRight, Hourglass, Megaphone,
} from "lucide-react";
import {
  ZONA, ABREV_MES, ahoraMexico, aClaveFecha, desdeClaveFecha, formatoHora,
} from "../../lib/fechas.js";
import { listarAnuncios } from "../../services/anunciosService.js";
import { useSesion } from "../../hooks/useSesion.js";
import { usePreferencia } from "../../hooks/usePreferencia.js";
import { RANGOS_PROXIMOS, limiteRango } from "../../lib/rangosEventos.js";
import { useCalendarioEventos } from "../../hooks/useCalendarioEventos.js";
import MiniCalendario from "../mini-calendario/MiniCalendario.jsx";
import ListaAnuncios from "../anuncios/ListaAnuncios.jsx";
import TarjetaColapsable from "../tarjeta-colapsable/TarjetaColapsable.jsx";
import styles from "./InicioResumen.module.css";

function saludoPorHora(h) {
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function diasRestantes(claveHoy, clave) {
  const a = desdeClaveFecha(claveHoy);
  const b = desdeClaveFecha(clave);
  return Math.round((b - a) / 86400000);
}

function cuenta(dias) {
  if (dias <= 0) return { texto: "Hoy", color: "azul" };
  if (dias === 1) return { texto: "Mañana", color: "naranja" };
  return { texto: `En ${dias} días`, color: "gris" };
}

// Resumen de inicio (solo lectura) compartido por alumno y docente.
export default function InicioResumen({ rutaCalendario, rutaAnuncios }) {
  const navigate = useNavigate();
  const { nombre, planteles = [] } = useSesion();
  const variosPlanteles = new Set(
    planteles.map((p) => p.plantel?.id).filter(Boolean)
  ).size > 1;
  const hoy = useMemo(() => ahoraMexico(), []);
  const claveHoy = aClaveFecha(hoy);
  const {
    eventos, tipos, calendarios, calendarioActivo, setCalendarioActivo,
    colorTipo, etiquetaTipo,
  } = useCalendarioEventos();

  const [anuncios, setAnuncios] = useState([]);
  useEffect(() => {
    let vigente = true;
    listarAnuncios()
      .then((lista) => { if (vigente) setAnuncios(lista); })
      .catch(() => { if (vigente) setAnuncios([]); });
    return () => { vigente = false; };
  }, []);

  // máximo de anuncios mostrados en el inicio (alumno, docente, personal)
  const anunciosResumen = useMemo(() => anuncios.slice(0, 5), [anuncios]); 

  const saludo = saludoPorHora(hoy.getHours());

  const fechaLarga = useMemo(() => {
    const t = new Intl.DateTimeFormat("es-MX", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ZONA,
    }).format(hoy);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }, [hoy]);

  const ciclo = useMemo(() => {
    const anio = hoy.getFullYear();
    return hoy.getMonth() >= 7 ? `${anio}–${anio + 1}` : `${anio - 1}–${anio}`;
  }, [hoy]);

  const proximos = useMemo(
    () => eventos
      .filter((e) => e.fecha >= claveHoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio || "").localeCompare(b.horaInicio || "")),
    [eventos, claveHoy]
  );

  // Rango elegido para los próximos eventos
  const [rangoProximos, setRangoProximos] = usePreferencia("inicio:rangoProximos", "semana");

  const proximosResumen = useMemo(() => {
    const limite = limiteRango(hoy, rangoProximos);
    return proximos.filter((e) => e.fecha <= limite);
  }, [proximos, hoy, rangoProximos]);

  const eventosHoy = useMemo(() => eventos.filter((e) => e.fecha === claveHoy), [eventos, claveHoy]);

  const finSemana = aClaveFecha(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 7));
  const estaSemana = proximos.filter((e) => e.fecha <= finSemana);

  const proximo = proximos[0];
  const cuentaProximo = proximo ? cuenta(diasRestantes(claveHoy, proximo.fecha)) : null;

  return (
    <section className={styles["pagina"]}>
      {/* Encabezado */}
      <header className={styles["encabezado"]}>
        <h2 className={styles["encabezado__saludo"]}>
          {saludo}{nombre ? `, ${nombre.split(" ")[0]}` : ""}
        </h2>
        <div className={styles["encabezado__sub"]}>
          <Calendar size={13} />
          <span>{fechaLarga}</span>
          <span>·</span>
          <span>Ciclo {ciclo}</span>
        </div>
      </header>

      {/* Indicadores */}
      <div className={styles["indicadores"]}>
        <article className={styles["indicador"]}>
          <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--azul"]}`}>
            <CalendarCheck size={20} />
          </span>
          <div>
            <div className={styles["indicador__valor"]}>{eventosHoy.length}</div>
            <div className={styles["indicador__etiqueta"]}>Eventos hoy</div>
          </div>
        </article>
        <article className={styles["indicador"]}>
          <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--morado"]}`}>
            <CalendarDays size={20} />
          </span>
          <div>
            <div className={styles["indicador__valor"]}>{estaSemana.length}</div>
            <div className={styles["indicador__etiqueta"]}>Eventos esta semana</div>
          </div>
        </article>
        <article className={styles["indicador"]}>
          <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--naranja"]}`}>
            <Hourglass size={20} />
          </span>
          <div>
            <div className={styles["indicador__valor"]}>
              {cuentaProximo ? cuentaProximo.texto : "—"}
            </div>
            <div className={styles["indicador__etiqueta"]}>
              {proximo ? `Próximo: ${proximo.titulo}` : "Sin eventos próximos"}
            </div>
          </div>
        </article>
      </div>

      {/* próximos eventos + mini calendario */}
      <div className={styles["rejilla"]}>
        <div className={styles["columna"]}>
          <TarjetaColapsable
            id="inicio-proximos"
            icono={Calendar}
            titulo="Próximos eventos"
            accion={
              <button type="button" className="tarjeta__enlace" onClick={() => navigate(rutaCalendario)}>
                Ver todos
                <ChevronRight size={14} />
              </button>
            }
          >
            <div className={styles["rango"]} role="group" aria-label="Rango de próximos eventos">
              {RANGOS_PROXIMOS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`${styles["rango__btn"]} ${rangoProximos === r.id ? styles["rango__btn--activo"] : ""}`}
                  onClick={() => setRangoProximos(r.id)}
                >
                  {r.etiqueta}
                </button>
              ))}
            </div>
            <div className={styles["eventos"]}>
              {proximosResumen.length === 0 ? (
                <p className={styles["eventos__vacio"]}>No hay eventos próximos en este rango.</p>
              ) : (
                proximosResumen.map((ev) => {
                  const fecha = desdeClaveFecha(ev.fecha);
                  const c = cuenta(diasRestantes(claveHoy, ev.fecha));
                  const etiq = etiquetaTipo(ev.tipo);
                  const tieneTituloReal = ev.titulo && ev.titulo !== etiq;
                  return (
                    <div key={ev.id} className={styles["evento"]}>
                      <div className={styles["evento__fecha"]}>
                        <strong>{fecha.getDate()}</strong>
                        <span>{ABREV_MES[fecha.getMonth()]}</span>
                      </div>
                      <div className={styles["evento__copia"]}>
                        <h3
                          className={styles["evento__titulo"]}
                          style={!tieneTituloReal ? { color: colorTipo(ev.tipo) } : undefined}
                        >
                          {tieneTituloReal ? ev.titulo : etiq}
                        </h3>
                        <div className={styles["evento__meta"]}>
                          {tieneTituloReal && (
                            <span className="etiqueta" style={{ backgroundColor: colorTipo(ev.tipo) + '20', color: colorTipo(ev.tipo) }}>
                              {etiq}
                            </span>
                          )}
                          {ev.horaInicio && (
                            <span className={styles["meta"]}>
                              <Clock size={11} />
                              {formatoHora(ev.horaInicio)}
                              {ev.horaFin && ` - ${formatoHora(ev.horaFin)}`}
                            </span>
                          )}
                          {ev.lugar && (
                            <span className={styles["meta"]}>
                              <MapPin size={11} />
                              {ev.lugar}
                            </span>
                          )}
                          {variosPlanteles && (
                            <span className={styles["meta"]}>
                              <Building2 size={11} />
                              {ev.plantel || "Todos los planteles"}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`etiqueta etiqueta--${c.color} ${styles["evento__cuenta"]}`}>
                        {c.texto}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </TarjetaColapsable>

          <TarjetaColapsable
            id="inicio-anuncios"
            icono={Megaphone}
            titulo="Anuncios"
            accion={
              rutaAnuncios && (
                <button type="button" className="tarjeta__enlace" onClick={() => navigate(rutaAnuncios)}>
                  Ver todos
                  <ChevronRight size={14} />
                </button>
              )
            }
          >
            <ListaAnuncios anuncios={anunciosResumen} soloTitulo />
          </TarjetaColapsable>
        </div>

        <aside className={styles["lateral"]}>
          <MiniCalendario
            eventos={eventos}
            tipos={tipos}
            calendarios={calendarios}
            calendarioActivo={calendarioActivo}
            mostrarPlantel={variosPlanteles}
            onCalendario={setCalendarioActivo}
          />
        </aside>
      </div>
    </section>
  );
}
