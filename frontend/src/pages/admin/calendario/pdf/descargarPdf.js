import { pdf } from "@react-pdf/renderer";

/* Genera el documento como blob y dispara la descarga en el navegador. */
export async function descargarPdf(documento, nombreArchivo) {
  const blob = await pdf(documento).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
