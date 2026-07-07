import Swal from "sweetalert2";

const Modal = Swal.mixin({
  buttonsStyling: false,
  heightAuto: false,
  scrollbarPadding: false,
  customClass: {
    confirmButton: "boton boton--primario",
    cancelButton: "boton boton--fantasma",
    actions: "swal-acciones",
  },
});

// Éxito / info
export const avisoExito = (titulo, texto) =>
  Modal.fire({
    icon: "success",
    title: titulo,
    text: texto,
    timer: 1700,
    timerProgressBar: true,
    showConfirmButton: false,
  });

// Avisos de acción
const COLOR_ACCION = { verde: "#2e9d41", azul: "#0a3a9e", rojo: "#e5484d" };

const avisoAccion = (titulo, acento) =>
  Modal.fire({
    icon: "success",
    iconColor: COLOR_ACCION[acento],
    title: titulo,
    timer: 1700,
    timerProgressBar: true,
    showConfirmButton: false,
  });

export const avisoCreado = (titulo) => avisoAccion(titulo, "verde");
export const avisoEditado = (titulo) => avisoAccion(titulo, "azul");
export const avisoEliminado = (titulo) => avisoAccion(titulo, "rojo");

export const avisoCerrandoSesion = () =>
  Modal.fire({
    title: "Cerrando sesión",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Modal.showLoading();
    },
  });

export const avisoInfo = (titulo, texto) =>
  Modal.fire({
    icon: "info",
    title: titulo,
    text: texto,
    timer: 2200,
    timerProgressBar: true,
    showConfirmButton: false,
  });

export const avisoError = (titulo, texto) =>
  Modal.fire({
    icon: "error",
    title: titulo,
    text: texto,
    confirmButtonText: "Entendido",
  });

export const confirmarEliminacion = (nombre) =>
  Modal.fire({
    icon: "warning",
    title: "Eliminar evento",
    html: `¿Seguro que deseas eliminar <b>${nombre}</b>? Esta acción no se puede deshacer.`,
    showCancelButton: true,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    focusCancel: true,
    customClass: {
      confirmButton: "boton boton--peligro",
      cancelButton: "boton boton--fantasma",
      actions: "swal-acciones",
    },
  });

export const confirmarAccion = ({
  titulo,
  html,
  icono = "warning",
  confirmar = "Aceptar",
  cancelar = "Cancelar",
  peligro = false,
}) =>
  Modal.fire({
    icon: icono,
    title: titulo,
    html,
    showCancelButton: true,
    confirmButtonText: confirmar,
    cancelButtonText: cancelar,
    reverseButtons: true,
    focusCancel: true,
    customClass: {
      confirmButton: `boton ${peligro ? "boton--peligro" : "boton--primario"}`,
      cancelButton: "boton boton--fantasma",
      actions: "swal-acciones",
    },
  });
