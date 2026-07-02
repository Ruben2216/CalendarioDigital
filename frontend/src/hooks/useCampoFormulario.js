import { useCallback } from "react";

export function useCampoFormulario(setForm) {
  return useCallback(
    (campo) => (e) => setForm((prev) => ({ ...prev, [campo]: e.target.value })),
    [setForm]
  );
}
