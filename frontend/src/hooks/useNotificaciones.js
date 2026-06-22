import { useCallback, useEffect, useState } from "react";
import { Megaphone, Calendar, Bell } from "lucide-react";
import { listarNotificaciones } from "../services/notificacionesService.js";
import {
    EVENTO_NOTIF, idsLeidas, idsOcultas,
    marcarTodasLeidas as persistirLeidas, limpiarTodas as persistirOcultas,
} from "../lib/notificacionesLeidas.js";

// Apariencia de la campana según la categoría (clasificación anuncio/evento).
const ESTILO_CATEGORIA = {
    anuncio: { icono: Megaphone, color: "azul" },
    evento: { icono: Calendar, color: "verde" },
};

function tiempoRelativo(iso) {
    const fecha = new Date(iso);
    const seg = Math.floor((Date.now() - fecha.getTime()) / 1000);
    if (seg < 60) return "Hace un momento";
    const min = Math.floor(seg / 60);
    if (min < 60) return `Hace ${min} min`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `Hace ${hrs} h`;
    const dias = Math.floor(hrs / 24);
    if (dias === 1) return "Ayer";
    if (dias < 7) return `Hace ${dias} días`;
    return fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function mapear(lista) {
    const leidas = idsLeidas();
    const ocultas = idsOcultas();
    return lista
        .filter((n) => !ocultas.has(n.id))
        .map((n) => {
            const estilo = ESTILO_CATEGORIA[n.categoria] ?? { icono: Bell, color: "gris" };
            const lugar = n.plantel || "General";
            return {
                id: n.id,
                categoria: n.categoria,
                icono: estilo.icono,
                color: estilo.color,
                titulo: n.titulo,
                subtitulo: `${tiempoRelativo(n.fecha)} · ${lugar}`,
                sinLeer: !leidas.has(n.id),
            };
        });
}

export function useNotificaciones() {
    const [crudas, setCrudas] = useState([]);
    const [notificaciones, setNotificaciones] = useState([]);

    useEffect(() => {
        let vigente = true;
        let cache = [];
        const recomputar = () => { if (vigente) setNotificaciones(mapear(cache)); };
        listarNotificaciones()
            .then((lista) => { if (!vigente) return; cache = lista; setCrudas(lista); recomputar(); })
            .catch(() => {});
        window.addEventListener(EVENTO_NOTIF, recomputar);
        return () => { vigente = false; window.removeEventListener(EVENTO_NOTIF, recomputar); };
    }, []);

    const notifSinLeer = notificaciones.filter((n) => n.sinLeer).length;
    const marcarTodasLeidas = useCallback(() => persistirLeidas(crudas), [crudas]);
    const limpiarNotificaciones = useCallback(() => persistirOcultas(crudas), [crudas]);

    return { notificaciones, notifSinLeer, marcarTodasLeidas, limpiarNotificaciones };
}
