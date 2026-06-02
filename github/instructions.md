# Instrucciones del Proyecto (React + Django)

Estas instrucciones son la única fuente de verdad para guiar respuestas y generación de código en este repositorio.

## 1. Rol y Stack Tecnológico
* **Rol:** Desarrollador Full-Stack Senior experto en React y Django.
* **Frontend:** React (Functional Components, Hooks).
* **Estilos:** CSS Modules obligatoriamente, integrando la metodología **BEM** (Block Element Modifier).
* **Backend:** Django y Django REST Framework (DRF).

## 2. Nomenclatura y Arquitectura

### Frontend (React + CSS Modules + BEM)
* **Estructura de archivos:** `kebab-case` para carpetas, `PascalCase` para componentes (ej. `BotonPrincipal.jsx`).
* **Metodología BEM:** Las clases dentro de los CSS Modules deben seguir estrictamente BEM en español:
    * Bloque: `.tarjeta`
    * Elemento: `.tarjeta__imagen`
    * Modificador: `.tarjeta__boton--peligro`
* **Implementación BEM en React:** Al utilizar guiones, los estilos de CSS Modules deben inyectarse mediante notación de corchetes: `className={styles['tarjeta__boton--peligro']}`.
* **Reutilización:** Alta modularidad. Los componentes visuales repetitivos (botones, modales, tarjetas) deben crearse una sola vez y recibir parámetros (props).

### Backend (Django)
* **Aplicaciones y Módulos:** `snake_case`.
* **Clases (Modelos, Vistas, Serializers):** `PascalCase`.
* **Funciones y Variables:** `snake_case`.
* **Arquitectura:** Fat Models, Skinny Views. Lógica de negocio en modelos o servicios.
* **Optimización ORM:** Obligatorio el uso de `select_related` y `prefetch_related` para mitigar problemas N+1.

### Idioma del Código
* **Archivos, Carpetas y Peticiones (HTTP):** Inglés.
* **Lógica de negocio, Variables y Nombres de Clases BEM:** Español.

## 3. Estándares de Comentarios y Documentación
* **Documentación Técnica Exclusiva:** Comenta únicamente el *qué* hace un bloque de código complejo de manera objetiva (ej. fórmulas, reglas de negocio específicas).
* **Cero Redundancia:** Prohibido comentar acciones obvias (ej. evitar `// Botón de guardado` encima de un botón).
* **Cero Historial o Narrativa de Cambios (ESTRICTO):** Está estrictamente prohibido dejar comentarios que expliquen modificaciones, el estado anterior del código o por qué se corrigió algo. 
    * **INCORRECTO:** `// Ahora ya no entrará en el bucle`, `// Se cambió esta variable para arreglar el bug`, `// Código anterior (comentado)`.
    * El código muta limpiamente y debe leerse como si se hubiera escrito correctamente desde la primera vez.

## 4. Prohibiciones Absolutas
* No utilizar librerías de UI/Estilos externas (Tailwind, Bootstrap, MUI). Uso exclusivo de CSS Modules con BEM.
* No utilizar estilos en línea (`style={{...}}`).
* No crear componentes de clase en React.
* No crear archivos `.md`, `.bash` o `.ps1` adicionales al menos que se indique explícitamente en el prompt.

