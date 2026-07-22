import { useCallback, useEffect, useMemo, useState } from "react";
import { Megaphone, Calendar, Bell, UserCog, MessageSquare, ClipboardCheck } from "lucide-react";
import { listarNotificaciones, marcarNotificacionLeida } from "../services/notificacionesService.js";
import { tiempoRelativo } from "../lib/fechas.js";
import {
    EVENTO_NOTIF, idsLeidas, idsOcultas,
    marcarTodasLeidas as persistirLeidas, limpiarTodas as persistirOcultas,
    marcarUnaLeida as persistirUnaLeida,
} from "../lib/notificacionesLeidas.js";

// Apariencia de la campana según la categoría anuncio/evento/cuenta/mensaje/solicitud (individuales / masivas)
const ESTILO_CATEGORIA = {
    anuncio: { icono: Megaphone, color: "azul" },
    evento: { icono: Calendar, color: "verde" },
    cuenta: { icono: UserCog, color: "morado" },
    mensaje: { icono: MessageSquare, color: "cian" },
    solicitud: { icono: ClipboardCheck, color: "ambar" },
};

function mapear(lista) {
    const leidas = idsLeidas();
    const ocultas = idsOcultas();
    const vistos = new Set();
    return lista
        .filter((n) => {
            if (ocultas.has(n.id) || vistos.has(n.id)) return false;
            vistos.add(n.id);
            return true;
        })
        .map((n) => {
            const estilo = ESTILO_CATEGORIA[n.categoria] ?? { icono: Bell, color: "gris" };
            const lugar = n.personal ? "Personal" : (n.plantel || "General");
            const leida = leidas.has(n.id) || n.leido === true;
            return {
                id: n.id,
                categoria: n.categoria,
                personal: n.personal === true,
                icono: estilo.icono,
                color: estilo.color,
                titulo: n.titulo,
                mensaje: n.mensaje || "",
                lugar,
                tiempo: tiempoRelativo(n.fecha),
                referenciaId: n.referencia_id ?? null,
                subtitulo: `${tiempoRelativo(n.fecha)} · ${lugar}`,
                sinLeer: !leida,
            };
        });
}

export function useNotificaciones() {
    const [crudas, setCrudas] = useState([]);
    const [version, setVersion] = useState(0);

    const refrescar = useCallback(() => {
        listarNotificaciones()
            .then((lista) => setCrudas(Array.isArray(lista) ? lista : []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        refrescar();

        const recomputar = () => setVersion((v) => v + 1);
        const alVolver = () => { if (!document.hidden) refrescar(); };

        window.addEventListener(EVENTO_NOTIF, recomputar);
        window.addEventListener("focus", refrescar);
        document.addEventListener("visibilitychange", alVolver);
        const intervalo = setInterval(refrescar, 60000);

        return () => {
            window.removeEventListener(EVENTO_NOTIF, recomputar);
            window.removeEventListener("focus", refrescar);
            document.removeEventListener("visibilitychange", alVolver);
            clearInterval(intervalo);
        };
    }, [refrescar]);

    const notificaciones = useMemo(() => mapear(crudas), [crudas, version]);
    const notifSinLeer = useMemo(() => notificaciones.filter((n) => n.sinLeer).length, [notificaciones]);
    const marcarTodasLeidas = useCallback(() => {
        persistirLeidas(crudas);
        if (crudas.some((n) => n.personal)) marcarNotificacionLeida();
    }, [crudas]);
    const marcarLeida = useCallback((id) => {
        persistirUnaLeida(id);
        const n = crudas.find((x) => x.id === id);
        if (n?.personal) marcarNotificacionLeida(id);
    }, [crudas]);
    const limpiarNotificaciones = useCallback(() => persistirOcultas(crudas), [crudas]);

    return { notificaciones, notifSinLeer, marcarTodasLeidas, marcarLeida, limpiarNotificaciones, refrescar };
}
