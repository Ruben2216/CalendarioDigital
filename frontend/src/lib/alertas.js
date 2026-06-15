import Swal from "sweetalert2";

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true,
});

export const avisoExito = (titulo) => Toast.fire({ icon: "success", title: titulo });

export const confirmarEliminacion = (nombre) =>
  Swal.fire({
    icon: "warning",
    title: "Eliminar evento",
    html: `¿Seguro que deseas eliminar <b>${nombre}</b>? Esta acción no se puede deshacer.`,
    showCancelButton: true,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
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
  Swal.fire({
    icon: icono,
    title: titulo,
    html,
    showCancelButton: true,
    confirmButtonText: confirmar,
    cancelButtonText: cancelar,
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    customClass: {
      confirmButton: `boton ${peligro ? "boton--peligro" : "boton--primario"}`,
      cancelButton: "boton boton--fantasma",
      actions: "swal-acciones",
    },
  });
