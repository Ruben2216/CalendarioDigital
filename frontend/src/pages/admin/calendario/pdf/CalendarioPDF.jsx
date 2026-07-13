import {
  Document, Page, View, Text, Image, StyleSheet, Font,
  Svg, Polygon, Line, Rect,
} from "@react-pdf/renderer";

Font.registerHyphenationCallback((palabra) => [palabra]);

const ICONO = `${import.meta.env.BASE_URL}icono.png`;

const DIAS_MINI = ["D", "L", "M", "M", "J", "V", "S"];
const DIAS_MES = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MAX_CARRILES = 5;
const ALTO_SEMANA = 85;

const NAVY = "#0a2060";      // azul
const NAVY_CAB = "#1e3a5f";  // encabezado de días (mensual)
const SEM_A = "#0a2060";     // encabezado de mes — semestre A (ago–ene)
const SEM_B = "#0a3a9e";     // encabezado de mes — semestre B (feb–jul)
const ACCENT = "#4a90e2";    // acento (año, líneas)
const TEXTO = "#1f2937";
const TENUE = "#6b7280";
const SUAVE = "#9ca3af";
const LINEA = "#e5e7eb";
const FINDE_BG = "#f7f9fc";
const MAX_ALTO_EVENTOS_PRIMERA = 330;
const MAX_ALTO_EVENTOS_CONTINUACION = 390;

function textoLegible(hex) {
  const c = (hex || "").replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 165 ? TEXTO : "#ffffff";
}

function textoSobreColores(colores) {
  const lums = colores.map((hex) => {
    const c = (hex || "").replace("#", "");
    if (c.length !== 6) return 0;
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  });
  const avg = lums.reduce((a, b) => a + b, 0) / lums.length;
  return avg > 165 ? TEXTO : "#ffffff";
}

function tinte(hex, a) {
  const c = (hex || "").replace("#", "");
  if (c.length !== 6) return `rgba(100,116,139,${a})`;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function oscurecer(hex, f = 0.6) {
  const c = (hex || "").replace("#", "");
  if (c.length !== 6) return TEXTO;
  const r = Math.round(parseInt(c.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(c.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(c.slice(4, 6), 16) * f);
  return `rgb(${r},${g},${b})`;
}

function aclarar(hex, t) {
  const c = (hex || "").replace("#", "");
  if (c.length !== 6) return hex;
  const m = (x) => Math.round(x + (255 - x) * t);
  return `rgb(${m(parseInt(c.slice(0, 2), 16))},${m(parseInt(c.slice(2, 4), 16))},${m(parseInt(c.slice(4, 6), 16))})`;
}

function contarLineasEstimadas(texto, charsPorLinea) {
  const lineas = String(texto || "").split("\n");
  return lineas.reduce((total, linea) => total + Math.max(1, Math.ceil(linea.length / charsPorLinea)), 0);
}

function estimarAlturaEvento(ev) {
  const titulo = `${ev.rango} · ${ev.titulo}`;
  const meta = `${ev.periodo ? `${ev.periodo} · ` : ""}${ev.hora}${ev.lugar ? ` · ${ev.lugar}` : ""}${ev.plantel ? ` · ${ev.plantel}` : ""}${ev.turno ? ` · ${ev.turno}` : ""}`;
  const lineasTitulo = contarLineasEstimadas(titulo, 42);
  const lineasMeta = contarLineasEstimadas(meta, 52);
  return 10 + (lineasTitulo * 7) + (lineasMeta * 5) + 2;
}

function partirEventosPorAltura(eventos) {
  const paginas = [];
  let restantes = [...eventos];
  let limite = MAX_ALTO_EVENTOS_PRIMERA;

  while (restantes.length > 0) {
    const bloque = [];
    let altura = 0;
    let indice = 0;

    for (; indice < restantes.length; indice += 1) {
      const ev = restantes[indice];
      const alto = estimarAlturaEvento(ev);
      if (bloque.length > 0 && altura + alto > limite) break;
      bloque.push(ev);
      altura += alto;
    }

    if (bloque.length === 0) {
      bloque.push(restantes[0]);
      indice = 1;
    }

    paginas.push(bloque);
    restantes = restantes.slice(indice);
    limite = MAX_ALTO_EVENTOS_CONTINUACION;
  }

  return paginas;
}

const s = StyleSheet.create({
  page: { paddingTop: 18, paddingBottom: 18, paddingHorizontal: 20, fontSize: 8, color: TEXTO },

  // Encabezado (anual / mensual)
  cab: { flexDirection: "row", alignItems: "center", borderBottomWidth: 2,
    borderBottomColor: NAVY, paddingBottom: 8, marginBottom: 5 },
  cabLogo: { width: 40, height: 40, marginRight: 12, objectFit: "contain" },
  cabTitulo: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.5 },
  cabSub: { fontSize: 10, color: TENUE, marginTop: 3 },

  cuerpo: { flexDirection: "row", flexGrow: 1, alignItems: "flex-start" },

  // ANUAL
  rejilla: { width: "76%", flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start" },
  ladoAnual: { width: "24%", paddingLeft: 14 },
  mes: { width: "25%", paddingHorizontal: 5, marginBottom: 9 },
  mesCard: { borderWidth: 0.5, borderColor: LINEA, borderRadius: 5, overflow: "hidden",
    backgroundColor: "#ffffff" },
  mesCab: { position: "relative", height: 24, justifyContent: "center", overflow: "hidden" },
  mesCabBg: { position: "absolute", top: 0, left: 0 },
  mesCabRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 9 },
  mesNombre: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  mesAnio: { fontSize: 8.5, color: "#dbe6fb", fontFamily: "Helvetica-Bold" },
  mesCuerpo: { paddingHorizontal: 5, paddingVertical: 4 },
  semanaCab: { flexDirection: "row", marginBottom: 2 },
  diaSemana: { width: `${100 / 7}%`, textAlign: "center", fontSize: 6.5, color: TENUE,
    fontFamily: "Helvetica-Bold" },
  semana: { flexDirection: "row" },
  celda: { width: `${100 / 7}%`, height: 18, alignItems: "center", justifyContent: "center" },
  diaNum: { fontSize: 7.5 },
  diaChip: { width: 14, height: 14, borderRadius: 3, alignItems: "center", justifyContent: "center" },
  diaChipTexto: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },

  // Simbología
  card: { borderWidth: 1, borderColor: LINEA, borderRadius: 8, paddingTop: 12, paddingBottom: 12, paddingHorizontal: 12, backgroundColor: "#ffffff" },
  cardTitulo: { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.5 },
  cardSub: { fontSize: 7.5, color: TENUE, marginTop: 1, marginBottom: 8 },
  simCardItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  simCardCuad: { width: 13, height: 13, borderRadius: 3, marginRight: 9, marginTop: 1 },
  simCardTxt: { fontSize: 7, fontFamily: "Helvetica-Bold", color: TEXTO, letterSpacing: 0.3,
    textTransform: "uppercase", lineHeight: 1.25, flex: 1 },
  cardVacio: { fontSize: 7.5, color: TENUE, fontStyle: "italic" },
  cardDivisor: { borderTopWidth: 0.5, borderTopColor: LINEA, marginTop: 7, marginBottom: 7 },
  cardSeccion: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 5,
    textTransform: "uppercase", letterSpacing: 0.4 },
  semFila: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  semCuadro: { width: 13, height: 13, borderRadius: 3, marginRight: 9 },
  semTexto: { fontSize: 8, color: TENUE },

  // Eventos del mes (dentro de la tarjeta — solo mensual)
  item: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 2,
    borderBottomWidth: 0.5, borderBottomColor: LINEA },
  itemPunto: { width: 6, height: 6, borderRadius: 3, marginRight: 5, marginTop: 2 },
  itemCuerpo: { flexGrow: 1, flexShrink: 1 },
  itemTitulo: { fontSize: 7, fontFamily: "Helvetica-Bold", color: TEXTO },
  itemDia: { color: TENUE, fontFamily: "Helvetica" },
  itemMeta: { fontSize: 6, color: TENUE, marginTop: -1 },

  // MENSUAL: título del mes 
  mesTitulo: { position: "absolute",right: 18, top: 14, alignItems: "flex-end", marginBottom: 8 },
  mtLinea: { flexDirection: "row", alignItems: "baseline" },
  mtNombre: { fontSize: 26, fontFamily: "Helvetica-Bold", color: NAVY },
  mtAnio: { fontSize: 26, fontFamily: "Helvetica-Bold", color: ACCENT, marginLeft: 7 },
  mtNota: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  mtNotaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT, marginRight: 5 },
  mtNotaTxt: { fontSize: 8.5, color: TENUE },
  eventosContinuacion: { width: "100%", marginTop: 44, alignSelf: "stretch" },
  eventosContinuacionTitulo: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.4 },
  eventosContinuacionSub: { fontSize: 8.5, color: TENUE, marginTop: 2, marginBottom: 10 },

  // MENSUAL: cuadros 
  ladoMes: { width: "27%", paddingLeft: 14 },
  rejillaMes: { width: "73%", borderWidth: 0.5, borderColor: LINEA, borderRadius: 8, overflow: "hidden" },
  semCabMes: { flexDirection: "row", backgroundColor: NAVY_CAB },
  diaSemMes: { width: `${100 / 7}%`, textAlign: "center", color: "#ffffff", fontSize: 7.5,
    fontFamily: "Helvetica-Bold", paddingVertical: 5, letterSpacing: 0.5 },
  semanaMes: { position: "relative" },
  semanaFondo: { flexDirection: "row", height: "100%" },
  celdaFondo: { width: `${100 / 7}%`, borderWidth: 0.5, borderColor: LINEA, padding: 4,
    alignItems: "flex-end" },
  celdaFueraBg: { backgroundColor: "#fafbfc" },
  celdaFindeBg: { backgroundColor: FINDE_BG },
  celdaNum: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  numChip: { minWidth: 17, height: 17, borderRadius: 8.5, paddingHorizontal: 3,
    alignItems: "center", justifyContent: "center" },
  numChipTxt: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  carriles: { position: "absolute", left: 3, right: 3, bottom: 4 },
  carril: { flexDirection: "row", marginTop: 1 },
  seg: { borderBottomWidth: 2, paddingHorizontal: 2, paddingBottom: 0, justifyContent: "flex-end" },
  segTexto: { fontSize: 5, fontFamily: "Helvetica-Bold", maxLines: 1, textOverflow: "ellipsis" },
  masEventos: { fontSize: 5.5, color: TENUE, marginTop: 2, marginLeft: 2 },
});

function ChipMulticolor({ colores, dia, size, fontSize, paddingTop }) {
  const W = size, H = size, R = size <= 14 ? 3 : 4;
  const n = Math.min(colores.length, 4);
  const txtColor = textoSobreColores(colores);
  return (
    <View style={{ width: W, height: H, borderRadius: R, overflow: "hidden", position: "relative" }}>
      <Svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
        {n === 1 && (
          <Rect x={0} y={0} width={W} height={H} fill={colores[0]} />
        )}
        {n === 2 && (
          <>
            <Polygon points={`0,0 ${W},0 0,${H}`} fill={colores[0]} />
            <Polygon points={`${W},0 ${W},${H} 0,${H}`} fill={colores[1]} />
          </>
        )}
        {n === 3 && (
          <>
            <Rect x={0} y={0} width={W / 2} height={H} fill={colores[0]} />
            <Rect x={W / 2} y={0} width={W / 2} height={H} fill={colores[1]} />
            <Rect x={0} y={H * 0.6} width={W} height={H * 0.4} fill={colores[2]} />
          </>
        )}
        {n >= 4 && (
          <>
            <Rect x={0}     y={0}     width={W / 2} height={H / 2} fill={colores[0]} />
            <Rect x={W / 2} y={0}     width={W / 2} height={H / 2} fill={colores[1]} />
            <Rect x={0}     y={H / 2} width={W / 2} height={H / 2} fill={colores[2]} />
            <Rect x={W / 2} y={H / 2} width={W / 2} height={H / 2} fill={colores[3]} />
          </>
        )}
      </Svg>
      <Text style={{
        position: "absolute", top: paddingTop, left: 0, width: W,
        textAlign: "center", fontSize, fontFamily: "Helvetica-Bold", color: txtColor,
      }}>{dia}</Text>
    </View>
  );
}

/* Compartido (anual, mensual) */

function Cabecera({ ciclo }) {
  return (
    <View style={s.cab}>
      <Image src={ICONO} style={s.cabLogo} />
      <View>
        <Text style={s.cabTitulo}>CALENDARIO ESCOLAR {ciclo}</Text>
        <Text style={s.cabSub}>Colegio de Bachilleres de Chiapas</Text>
      </View>
    </View>
  );
}

function PanelLateral({ simbologia, conSemestres = false, eventos = null, mostrarSimbologia = true, tituloEventos = "Eventos del mes" }) {
  return (
    <View style={s.card}>
      {mostrarSimbologia && (
        <>
          <Text style={s.cardTitulo}>SIMBOLOGÍA</Text>
          <Text style={s.cardSub}>Categorías de eventos</Text>
          {simbologia.length === 0 ? (
            <Text style={s.cardVacio}>Sin tipos de evento en este periodo.</Text>
          ) : (
            simbologia.map((t, i) => (
              <View key={i} style={s.simCardItem}>
                <View style={[s.simCardCuad, { backgroundColor: t.color }]} />
                <Text style={s.simCardTxt}>{t.nombre}</Text>
              </View>
            ))
          )}

          {conSemestres && (
            <>
              <View style={s.cardDivisor} />
              <View style={s.semFila}>
                <View style={[s.semCuadro, { backgroundColor: SEM_A }]} />
                <Text style={s.semTexto}>Semestre A (ago–ene)</Text>
              </View>
              <View style={s.semFila}>
                <View style={[s.semCuadro, { backgroundColor: SEM_B }]} />
                <Text style={s.semTexto}>Semestre B (feb–jul)</Text>
              </View>
            </>
          )}
        </>
      )}

      {eventos && (
        <>
          {mostrarSimbologia && <View style={s.cardDivisor} />}
          <Text style={s.cardSeccion}>{tituloEventos}</Text>
          {eventos.length === 0 ? (
            <Text style={s.cardVacio}>No hay eventos registrados en este mes.</Text>
          ) : (
            eventos.map((ev) => (
              <View key={ev.id} style={s.item} wrap={false}>
                <View style={[s.itemPunto, { backgroundColor: ev.color }]} />
                <View style={s.itemCuerpo}>
                  <Text style={s.itemTitulo}>
                    <Text style={s.itemDia}>{ev.rango} · </Text>
                    {ev.titulo}
                  </Text>
                  <Text style={s.itemMeta}>
                    {ev.periodo ? `${ev.periodo} · ` : ""}
                    {ev.hora}
                    {ev.lugar ? ` · ${ev.lugar}` : ""}
                    {` · ${ev.plantel}`}
                    {ev.turno ? ` · ${ev.turno}` : ""}
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}

// ANUAL

function MiniMes({ mes }) {
  const base = mes.semestreA ? SEM_A : SEM_B;
  const claro = aclarar(base, 0.34);
  const filo = aclarar(base, 0.6);
  return (
    <View style={s.mes} wrap={false}>
      <View style={s.mesCard}>
        <View style={s.mesCab}>
          <Svg style={s.mesCabBg} width={160} height={24}>
            <Polygon points="0,0 160,0 160,24 0,24" fill={claro} />
            <Polygon points="0,0 108,0 90,24 0,24" fill={base} />
            <Line x1="108" y1="0" x2="90" y2="24" stroke={filo} strokeWidth="1.2" />
          </Svg>
          <View style={s.mesCabRow}>
            <Text style={s.mesNombre}>{mes.nombre.toUpperCase()}</Text>
            <Text style={s.mesAnio}>{mes.anio}</Text>
          </View>
        </View>
        <View style={s.mesCuerpo}>
          <View style={s.semanaCab}>
            {DIAS_MINI.map((d, i) => (
              <Text key={i} style={s.diaSemana}>{d}</Text>
            ))}
          </View>
          {mes.semanas.map((semana, i) => (
            <View key={i} style={s.semana}>
              {semana.map((celda, j) => (
                <View key={j} style={s.celda}>
                  {!celda.enMes ? (
                    <Text style={[s.diaNum, { color: "#d1d5db" }]}>{celda.dia}</Text>
                  ) : celda.colores.length ? (
                    <ChipMulticolor
                      colores={celda.colores}
                      dia={celda.dia}
                      size={14}
                      fontSize={7.5}
                      paddingTop={3}
                    />
                  ) : (
                    <Text style={[s.diaNum, { color: celda.finde ? TENUE : TEXTO }]}>
                      {celda.dia}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function DocumentoAnual({ datos }) {
  return (
    <Document title={`Calendario ${datos.ciclo}`} author="Colegio de Bachilleres de Chiapas">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Cabecera ciclo={datos.ciclo} />
        <View style={s.cuerpo}>
          <View style={s.rejilla}>
            {datos.meses.map((m) => (
              <MiniMes key={`${m.anio}-${m.mes}`} mes={m} />
            ))}
          </View>
          <View style={s.ladoAnual}>
            <PanelLateral simbologia={datos.simbologia} conSemestres />
          </View>
        </View>
      </Page>
    </Document>
  );
}

// MENSUAL 

function CarrilFila({ carril }) {
  const orden = [...carril].sort((a, b) => a.startCol - b.startCol);
  const hijos = [];
  let cursor = 0;
  for (const seg of orden) {
    if (seg.startCol > cursor) {
      hijos.push(
        <View key={`g${cursor}`} style={{ width: `${((seg.startCol - cursor) / 7) * 100}%` }} />
      );
    }
    const span = seg.endCol - seg.startCol + 1;
    hijos.push(
      <View key={seg.id} style={[s.seg, { width: `${(span / 7) * 100}%`, borderBottomColor: seg.color }]}>
        <Text style={[s.segTexto, { color: oscurecer(seg.color) }]}>
          {seg.continuaIzq ? "" : seg.titulo}
        </Text>
      </View>
    );
    cursor = seg.endCol + 1;
  }
  return <View style={s.carril}>{hijos}</View>;
}

function SemanaMes({ semana, alto }) {
  const visibles = semana.carriles.slice(0, MAX_CARRILES);
  const sobra = semana.carriles.slice(MAX_CARRILES).reduce((n, l) => n + l.length, 0);
  return (
    <View style={[s.semanaMes, { height: alto }]}>
      <View style={s.semanaFondo}>
        {semana.dias.map((c, i) => {
          const fondo = !c.enMes
            ? s.celdaFueraBg
            : c.colores.length
              ? { backgroundColor: tinte(c.colores[0], 0.12) }
              : c.finde
                ? s.celdaFindeBg
                : null;
          return (
            <View key={i} style={[s.celdaFondo, fondo]}>
              {c.enMes && c.colores.length ? (
                <ChipMulticolor
                  colores={c.colores}
                  dia={c.dia}
                  size={17}
                  fontSize={8.5}
                  paddingTop={4}
                />
              ) : (
                <Text style={[s.celdaNum, { color: !c.enMes ? SUAVE : c.finde ? TENUE : TEXTO }]}>
                  {c.dia}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={s.carriles}>
        {visibles.map((carril, i) => (
          <CarrilFila key={i} carril={carril} />
        ))}
        {sobra > 0 && <Text style={s.masEventos}>+{sobra} más</Text>}
      </View>
    </View>
  );
}

function DocumentoMensual({ datos }) {
  const semLetra = datos.mes === 0 || datos.mes >= 7 ? "A" : "B";
  const altoSemana = ALTO_SEMANA;
  const paginasEventos = partirEventosPorAltura(datos.eventos);
  return (
    <Document
      title={`Calendario ${datos.nombreMes} ${datos.anio}`}
      author="Colegio de Bachilleres de Chiapas"
    >
      <Page size="A4" orientation="landscape" style={s.page}>
        <Cabecera ciclo={datos.ciclo} />

        <View style={s.mesTitulo}>
          <View style={s.mtLinea}>
            <Text style={s.mtNombre}>{datos.nombreMes.toUpperCase()}</Text>
            <Text style={s.mtAnio}>{datos.anio}</Text>
          </View>
          <View style={s.mtNota}>
            <View style={s.mtNotaDot} />
            <Text style={s.mtNotaTxt}>Semestre académico {semLetra} · Ciclo {datos.ciclo}</Text>
          </View>
        </View>

        <View style={s.cuerpo}>
          <View style={s.rejillaMes}>
            <View style={s.semCabMes}>
              {DIAS_MES.map((d, i) => (
                <Text key={i} style={s.diaSemMes}>{d}</Text>
              ))}
            </View>
            {datos.semanas.map((semana, i) => (
              <SemanaMes key={i} semana={semana} alto={altoSemana} />
            ))}
          </View>

          <View style={s.ladoMes}>
            <PanelLateral
              simbologia={datos.simbologia}
              eventos={paginasEventos[0] || []}
              tituloEventos="Eventos del mes"
            />
          </View>
        </View>
      </Page>

      {paginasEventos.slice(1).map((bloque, indice) => (
        <Page key={`eventos-${indice}`} size="A4" orientation="landscape" style={s.page}>
          <Cabecera ciclo={datos.ciclo} />

          <View style={s.mesTitulo}>
            <View style={s.mtLinea}>
              <Text style={s.mtNombre}>{datos.nombreMes.toUpperCase()}</Text>
              <Text style={s.mtAnio}>{datos.anio}</Text>
            </View>
            <View style={s.mtNota}>
              <View style={s.mtNotaDot} />
              <Text style={s.mtNotaTxt}>Semestre académico {semLetra} · Ciclo {datos.ciclo}</Text>
            </View>
          </View>

          <View style={s.eventosContinuacion}>
            <Text style={s.eventosContinuacionTitulo}>EVENTOS DEL MES</Text>
            <Text style={s.eventosContinuacionSub}>
              {datos.nombreMes.toUpperCase()} {datos.anio} · Continuación {indice + 1}
            </Text>
            <PanelLateral
              simbologia={datos.simbologia}
              eventos={bloque}
              mostrarSimbologia={false}
              tituloEventos="Eventos del mes"
            />
          </View>
        </Page>
      ))}
    </Document>
  );
}

export default function CalendarioPDF({ vista = "anual", datos }) {
  return vista === "mensual" ? (
    <DocumentoMensual datos={datos} />
  ) : (
    <DocumentoAnual datos={datos} />
  );
}
