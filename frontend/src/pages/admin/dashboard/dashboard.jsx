import { useEffect, useMemo, useState } from "react";
import { useSesion } from '../../../hooks/useSesion.js';
import { useNavigate } from "react-router-dom";
import {
  Calendar, CalendarDays, Clock, Users, ChevronLeft, ChevronRight, ChevronDown, MapPin,
  Megaphone, TrendingUp, Tag,
} from "lucide-react";
import {
  ZONA, NOMBRES_MES, ABREV_MES, ahoraMexico, aClaveFecha, desdeClaveFecha,
  formatoHora, formatoFechaLarga,
} from "../../../lib/fechas.js";
import ListaAnuncios from "../../../components/anuncios/ListaAnuncios.jsx";
import TarjetaColapsable from "../../../components/tarjeta-colapsable/TarjetaColapsable.jsx";
import { useCalendarioEventos } from "../../../hooks/useCalendarioEventos.js";
import { listarAnuncios } from "../../../services/anunciosService.js";
import { obtenerEstadisticasDashboard } from "../../../services/estadisticasService.js";
import { usePreferencia } from "../../../hooks/usePreferencia.js";
import styles from "./dashboard.module.css";

const DIAS_MINI = ["D", "L", "M", "M", "J", "V", "S"];

function saludoPorHora(hora) {
  if (hora < 12) return { texto: "Buenos días" };
  if (hora < 19) return { texto: "Buenas tardes" };
  return { texto: "Buenas noches" };
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

export default function Dashboard() {
  const navigate = useNavigate();
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

  const [estadisticas, setEstadisticas] = useState(null);
  useEffect(() => {
    let vigente = true;
    obtenerEstadisticasDashboard()
      .then((datos) => { if (vigente) setEstadisticas(datos); })
      .catch(() => { if (vigente) setEstadisticas(null); });
    return () => { vigente = false; };
  }, []);
  const [mesVisible, setMesVisible] = useState(
    () => new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  );
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  const [simbologiaAbierta, setSimbologiaAbierta] = usePreferencia("dash:simbologia", false);

  const { nombre } = useSesion();
  const saludo = saludoPorHora(hoy.getHours());

  const fechaLarga = useMemo(() => {
    const texto = new Intl.DateTimeFormat("es-MX", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ZONA,
    }).format(hoy);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }, [hoy]);

  const ciclo = useMemo(() => {
    const anio = hoy.getFullYear();
    return hoy.getMonth() >= 7 ? `${anio}–${anio + 1}` : `${anio - 1}–${anio}`;
  }, [hoy]);

  const eventosPorFecha = useMemo(() => {
    const mapa = new Map();
    for (const evento of eventos) {
      const inicio = desdeClaveFecha(evento.fecha);
      const fin = evento.fechaFin ? desdeClaveFecha(evento.fechaFin) : inicio;
      const cursor = new Date(inicio);
      while (cursor <= fin) {
        const clave = aClaveFecha(cursor);
        if (!mapa.has(clave)) mapa.set(clave, []);
        mapa.get(clave).push(evento);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return mapa;
  }, [eventos]);

  const eventosDelDia = fechaSeleccionada
    ? eventosPorFecha.get(fechaSeleccionada) || []
    : [];

  const manejarClickDia = (celda) => {
    // Toggle: si se vuelve a tocar el día ya seleccionado, se limpia.
    if (celda.clave === fechaSeleccionada) {
      setFechaSeleccionada(null);
      return;
    }
    setFechaSeleccionada(celda.clave);
    if (!celda.delMes) {
      const fecha = desdeClaveFecha(celda.clave);
      setMesVisible(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
    }
  };

  const proximosEventos = useMemo(() => {
    return eventos
      .filter((evento) => evento.fecha >= claveHoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [eventos, claveHoy]);

  const { eventosMes, eventosSemana } = useMemo(() => {
    const prefijoMes = claveHoy.slice(0, 7); // "YYYY-MM"
    const finSemana = aClaveFecha(
      new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 7)
    );
    return {
      eventosMes: eventos.filter((e) => e.fecha.startsWith(prefijoMes)).length,
      eventosSemana: eventos.filter((e) => e.fecha >= claveHoy && e.fecha <= finSemana).length,
    };
  }, [eventos, claveHoy, hoy]);

  const celdasCalendario = useMemo(() => {
    const anio = mesVisible.getFullYear();
    const mes = mesVisible.getMonth();
    const primerDiaSemana = new Date(anio, mes, 1).getDay();
    const inicio = new Date(anio, mes, 1 - primerDiaSemana);

    return Array.from({ length: 42 }, (_, i) => {
      const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const clave = aClaveFecha(fecha);
      const eventosDia = eventosPorFecha.get(clave) || [];
      return {
        clave,
        dia: fecha.getDate(),
        delMes: fecha.getMonth() === mes,
        esHoy: clave === claveHoy,
        color: eventosDia.length ? colorTipo(eventosDia[0].tipo) : null,
      };
    });
  }, [mesVisible, eventosPorFecha, claveHoy]);

  const irMes = (delta) =>
    setMesVisible((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const irHoy = () => setMesVisible(new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  return (
    <section className={styles["rejilla"]}>
      <section className={styles["encabezado"]}>
        <div>
          <h2 className={styles["encabezado__saludo"]}>{saludo.texto}{nombre ? `, ${nombre.split(' ')[0]}` : ''}</h2>
          <div className={styles["encabezado__subtitulo"]}>
            <Calendar size={13} />
            <span>{fechaLarga}</span>
            <span>·</span>
            <span>Ciclo {ciclo}</span>
          </div>
        </div>
      </section>

      <div className={styles["columna"]}>
        <section className={styles["indicadores"]}>
          <article className={styles["indicador"]}>
            <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--naranja"]}`}>
              <Users size={21} />
            </span>
            <div>
              <div className={styles["indicador__valor"]}>
                {estadisticas ? estadisticas.usuarios_activos : "—"}
              </div>
              <div className={styles["indicador__etiqueta"]}>
                {estadisticas?.ambito === "plantel" ? "Usuarios de mi plantel" : "Usuarios activos"}
              </div>
              {estadisticas?.activos_semana > 0 && (
                <div className={`${styles["indicador__nota"]} ${styles["indicador__nota--positiva"]}`}>
                  <TrendingUp size={12} />
                  {estadisticas.activos_semana} activos esta semana
                </div>
              )}
            </div>
          </article>

          <article className={styles["indicador"]}>
            <span className={`${styles["indicador__icono"]} ${styles["indicador__icono--morado"]}`}>
              <CalendarDays size={21} />
            </span>
            <div>
              <div className={styles["indicador__valor"]}>{eventosMes}</div>
              <div className={styles["indicador__etiqueta"]}>Eventos este mes</div>
              {eventosSemana > 0 && (
                <div className={`${styles["indicador__nota"]} ${styles["indicador__nota--positiva"]}`}>
                  <TrendingUp size={12} />
                  {eventosSemana} esta semana
                </div>
              )}
            </div>
          </article>
        </section>

        <TarjetaColapsable
          id="dash-proximos"
          icono={Calendar}
          titulo="Próximos eventos"
          accion={
            <button type="button" className="tarjeta__enlace" onClick={() => navigate("/calendario")}>
              Ver todos
              <ChevronRight size={14} />
            </button>
          }
        >
          <div className={styles["eventos"]}>
            {proximosEventos.length === 0 ? (
              <p className={styles["eventos__vacio"]}>No hay eventos próximos.</p>
            ) : (
              proximosEventos.map((evento) => {
                const fecha = desdeClaveFecha(evento.fecha);
                const c = cuenta(diasRestantes(claveHoy, evento.fecha));
                const etiq = etiquetaTipo(evento.tipo);
                const tieneTituloReal = evento.titulo && evento.titulo !== etiq;
                return (
                  <div key={evento.id} className={styles["evento"]}>
                    <div className={styles["evento__fecha"]}>
                      <strong>{fecha.getDate()}</strong>
                      <span>{ABREV_MES[fecha.getMonth()]}</span>
                    </div>
                    <div className={styles["evento__copia"]}>
                      <h3
                        className={styles["evento__titulo"]}
                        style={!tieneTituloReal ? { color: colorTipo(evento.tipo) } : undefined}
                      >
                        {tieneTituloReal ? evento.titulo : etiq}
                      </h3>
                      <div className={styles["evento__meta"]}>
                        {tieneTituloReal && (
                          <span className="etiqueta" style={{ backgroundColor: colorTipo(evento.tipo) + '20', color: colorTipo(evento.tipo) }}>
                            {etiq}
                          </span>
                        )}
                        {evento.horaInicio && (
                          <span className={styles["meta"]}>
                            <Clock size={11} />
                            {formatoHora(evento.horaInicio)}
                            {evento.horaFin && ` - ${formatoHora(evento.horaFin)}`}
                          </span>
                        )}
                        {evento.lugar && (
                          <span className={styles["meta"]}>
                            <MapPin size={11} />
                            {evento.lugar}
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
          id="dash-anuncios"
          icono={Megaphone}
          titulo="Anuncios"
          accion={
            <button type="button" className="tarjeta__enlace" onClick={() => navigate("/anuncios")}>
              Ver todos
              <ChevronRight size={14} />
            </button>
          }
        >
          <ListaAnuncios anuncios={anuncios} mostrarAudiencia />
        </TarjetaColapsable>
      </div>

      <aside className={styles["lateral-derecho"]}>
        <article className={`tarjeta ${styles["calendario"]}`}>
          <div className={styles["calendario__cabecera"]}>
            {calendarios.length > 0 ? (
              <select
                className={styles["calendario__selector"]}
                value={calendarioActivo ?? ""}
                onChange={(e) => setCalendarioActivo(Number(e.target.value))}
                aria-label="Seleccionar calendario"
              >
                {calendarios.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} · {c.ciclo}</option>
                ))}
              </select>
            ) : (
              <div className="tarjeta__titulo">
                <Calendar size={16} />
                Calendario
              </div>
            )}
            <div className={styles["calendario__controles"]}>
              <button type="button" className={styles["calendario__nav"]} onClick={() => irMes(-1)} aria-label="Mes anterior">
                <ChevronLeft size={14} />
              </button>
              <button type="button" className={styles["calendario__hoy"]} onClick={irHoy}>
                Hoy
              </button>
              <button type="button" className={styles["calendario__nav"]} onClick={() => irMes(1)} aria-label="Mes siguiente">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className={styles["calendario__cuerpo"]}>
            <h3 className={styles["calendario__mes"]}>
              {NOMBRES_MES[mesVisible.getMonth()]} {mesVisible.getFullYear()}
            </h3>

            <div className={styles["calendario__rejilla"]}>
              {DIAS_MINI.map((dia, i) => (
                <span key={i} className={styles["calendario__dia-semana"]}>
                  {dia}
                </span>
              ))}

              {celdasCalendario.map((celda) => (
                <button
                  type="button"
                  key={celda.clave}
                  onClick={() => manejarClickDia(celda)}
                  aria-pressed={fechaSeleccionada === celda.clave}
                  style={celda.color ? { "--punto-color": celda.color } : undefined}
                  className={`${styles["dia"]} ${
                    celda.delMes ? "" : styles["dia--apagado"]
                  } ${celda.esHoy ? styles["dia--hoy"] : ""} ${
                    fechaSeleccionada === celda.clave ? styles["dia--seleccionado"] : ""
                  }`}
                >
                  {celda.dia}
                </button>
              ))}
            </div>
          </div>

          {fechaSeleccionada && (
            <div className={styles["dia-eventos"]}>
              <div className={styles["dia-eventos__cabecera"]}>
                <span className={styles["dia-eventos__titulo"]}>
                  {formatoFechaLarga(fechaSeleccionada)}
                </span>
              </div>

              {eventosDelDia.length === 0 ? (
                <p className={styles["dia-eventos__vacio"]}>No hay eventos para este día.</p>
              ) : (
                <ul className={styles["dia-eventos__lista"]}>
                  {eventosDelDia.map((evento) => (
                    <li key={evento.id} className={styles["dia-eventos__item"]}>
                      <div className={styles["dia-eventos__copia"]}>
                        <p className={styles["dia-eventos__nombre"]}>{evento.titulo}</p>
                        <div className={styles["dia-eventos__meta"]}>
                          {etiquetaTipo(evento.tipo) !== evento.titulo && (
                            <span className="etiqueta" style={{ backgroundColor: colorTipo(evento.tipo) + '20', color: colorTipo(evento.tipo) }}>
                              {etiquetaTipo(evento.tipo)}
                            </span>
                          )}
                          {evento.horaInicio && (
                            <span className={styles["meta"]}>
                              <Clock size={11} />
                              {formatoHora(evento.horaInicio)}
                              {evento.horaFin && ` - ${formatoHora(evento.horaFin)}`}
                            </span>
                          )}
                          {evento.lugar && (
                            <span className={styles["meta"]}>
                              <MapPin size={11} />
                              {evento.lugar}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className={styles["simbologia"]}>
            <button
              type="button"
              className={styles["simbologia__toggle"]}
              onClick={() => setSimbologiaAbierta((v) => !v)}
              aria-expanded={simbologiaAbierta}
            >
              <span className={styles["simbologia__titulo"]}>
                <Tag size={14} />
                Simbología
              </span>
              <ChevronDown
                size={15}
                className={`${styles["simbologia__chevron"]} ${simbologiaAbierta ? styles["simbologia__chevron--abierto"] : ""}`}
              />
            </button>
            {simbologiaAbierta && (
              <ul className={styles["simbologia__lista"]}>
                {tipos.map((t) => (
                  <li key={t.id} className={styles["simbologia__item"]}>
                    <span className={styles["simbologia__punto"]} style={{ backgroundColor: t.color }} />
                    {t.etiqueta}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </aside>
    </section>
  );
}