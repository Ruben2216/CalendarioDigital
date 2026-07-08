# 2. Diseño de Base de Datos

El sistema persiste su información en *20 tablas* de una base de datos **Microsoft
SQL Server**. Este bloque documenta el modelo Entidad-Relación y el diccionario de
datos de cada tabla.

## 2.1 Consideraciones generales

- *Nombres de tabla.* Cada modelo declara explícitamente su nombre de tabla física
  (atributo db_table en la clase Meta), que coincide con el nombre del modelo
  (Rol, Plantel, Usuario, etc.).
- *Llaves primarias.* Por convención del equipo, toda tabla declara su PK como
  id_<tabla> en singular (id_usuario, id_rol, id_conversacion, …). Las dos
  únicas excepciones son GoogleOauthCredential y EventoGoogleSync, que usan la
  columna id generada implícitamente por Django.
- *Llaves foráneas.* En la base de datos, cada FK se materializa como una columna
  <campo>_id (por ejemplo, el campo rol del modelo Usuario es la columna
  rol_id). El tipo de la columna FK es el mismo que el de la PK referenciada.
- *Plantel usa UUID.* La PK de Plantel es de tipo uniqueidentifier (UUID). Por
  lo tanto, *toda FK que apunta a Plantel también es uniqueidentifier*, no
  entera.

### Mapeo de tipos (Django → SQL Server)

| Campo en Django | Tipo en SQL Server |
|---|---|
| BigAutoField | bigint (IDENTITY) |
| IntegerField / AutoField | int |
| UniqueIdentifierField | uniqueidentifier |
| CharField(n) | nvarchar(n) |
| EmailField | nvarchar(254) |
| TextField | nvarchar(max) |
| BooleanField | bit |
| DateField | date |
| TimeField | time |
| DateTimeField | datetime2 |
| JSONField | nvarchar(max) |
| ForeignKey | (mismo tipo que la PK referenciada) |

### Leyenda de las tablas del diccionario

| Columna | Significado |
|---|---|
| *PK* | La columna es llave primaria. |
| *FK* | La columna es llave foránea. |
| *Oblig.* | La columna es obligatoria (NOT NULL). |
| *Null* | La columna acepta valores nulos. |
| *Autoinc.* | La columna es autoincremental (IDENTITY). |

> Un ✔️ indica que la propiedad aplica; una celda vacía indica que no.

---

## 2.2 Modelo Entidad-Relación

Las tablas se agrupan en cinco subsistemas lógicos:

1. *Catálogos base* — Rol, Plantel, Turno, Semestre, Letra, Grupo.
2. *Identidad y accesos* — Usuario, UsuarioPlantel, GoogleOauthCredential,
   DispositivoFCM.
3. *Calendario y eventos* — Calendario, TipoEvento, Evento, EventoGoogleSync.
4. *Comunicación* — Anuncio, Conversacion, Mensaje, LecturaMensaje.
5. *Notificaciones y solicitudes* — Notificacion, SolicitudAdmin.

mermaid
erDiagram
    Rol {
        bigint id_rol PK
        nvarchar nombre_rol
    }
    Plantel {
        uniqueidentifier id_plantel PK
        nvarchar clave
        nvarchar nombre
    }
    Turno {
        bigint id_turno PK
        nvarchar nombre_turno
    }
    Semestre {
        int id_semestre PK
    }
    Letra {
        char id_letra PK
    }
    Grupo {
        bigint id_grupo PK
        int semestre_id FK
        char letra_id FK
    }
    Usuario {
        bigint id_usuario PK
        bigint rol_id FK
        nvarchar correo
    }
    UsuarioPlantel {
        bigint id_usuario_plantel PK
        bigint usuario_id FK
        uniqueidentifier plantel_id FK
        bigint turno_id FK
    }
    GoogleOauthCredential {
        bigint id PK
        bigint usuario_id FK
        int semestre_id FK
        bigint grupo_id FK
    }
    DispositivoFCM {
        bigint id_dispositivo PK
        bigint usuario_id FK
        nvarchar token_fcm
    }
    Calendario {
        bigint id_calendario PK
        nvarchar nombre
        nvarchar clave
    }
    TipoEvento {
        bigint id_tipo_evento PK
        nvarchar nombre
        uniqueidentifier plantel_id FK
    }
    Evento {
        bigint id_evento PK
        bigint calendario_id FK
        bigint tipo_evento_id FK
        uniqueidentifier plantel_id FK
        bigint turno_id FK
        int semestre_id FK
        bigint grupo_id FK
        bigint creado_por_id FK
        nvarchar titulo
    }
    EventoGoogleSync {
        bigint id PK
        bigint evento_id FK
        bigint usuario_id FK
    }
    Anuncio {
        bigint id_anuncio PK
        uniqueidentifier plantel_id FK
        bigint turno_id FK
        bigint creado_por_id FK
        nvarchar titulo
    }
    Conversacion {
        bigint id_conversacion PK
        bigint participante_a_id FK
        bigint participante_b_id FK
        uniqueidentifier plantel_id FK
    }
    Mensaje {
        bigint id_mensaje PK
        bigint conversacion_id FK
        bigint remitente_id FK
    }
    LecturaMensaje {
        bigint id_lectura_mensaje PK
        bigint conversacion_id FK
        bigint usuario_id FK
        bigint ultimo_leido_id FK
    }
    Notificacion {
        bigint id_notificacion PK
        uniqueidentifier plantel_id FK
        bigint turno_id FK
        bigint anuncio_id FK
        bigint evento_id FK
    }
    SolicitudAdmin {
        bigint id_solicitud_admin PK
        bigint usuario_id FK
        uniqueidentifier plantel_id FK
        bigint turno_id FK
        bigint resuelta_por_id FK
    }

    Rol ||--o{ Usuario : rol
    Semestre ||--o{ Grupo : semestre
    Letra ||--o{ Grupo : letra
    Usuario ||--o| GoogleOauthCredential : usuario
    Semestre ||--o{ GoogleOauthCredential : semestre
    Grupo ||--o{ GoogleOauthCredential : grupo
    Usuario ||--o{ UsuarioPlantel : usuario
    Plantel ||--o{ UsuarioPlantel : plantel
    Turno ||--o{ UsuarioPlantel : turno
    Usuario ||--o{ DispositivoFCM : usuario
    Calendario ||--o{ Evento : calendario
    TipoEvento ||--o{ Evento : tipo_evento
    Plantel ||--o{ TipoEvento : plantel
    Plantel ||--o{ Evento : plantel
    Turno ||--o{ Evento : turno
    Semestre ||--o{ Evento : semestre
    Grupo ||--o{ Evento : grupo
    Usuario ||--o{ Evento : creado_por
    Evento ||--o{ EventoGoogleSync : evento
    Usuario ||--o{ EventoGoogleSync : usuario
    Plantel ||--o{ Anuncio : plantel
    Turno ||--o{ Anuncio : turno
    Usuario ||--o{ Anuncio : creado_por
    Usuario ||--o{ Conversacion : participante_a
    Usuario ||--o{ Conversacion : participante_b
    Plantel ||--o{ Conversacion : plantel
    Conversacion ||--o{ Mensaje : conversacion
    Usuario ||--o{ Mensaje : remitente
    Conversacion ||--o{ LecturaMensaje : conversacion
    Usuario ||--o{ LecturaMensaje : usuario
    Mensaje ||--o| LecturaMensaje : ultimo_leido
    Plantel ||--o{ Notificacion : plantel
    Turno ||--o{ Notificacion : turno
    Anuncio ||--o{ Notificacion : anuncio
    Evento ||--o{ Notificacion : evento
    Usuario ||--o{ SolicitudAdmin : usuario
    Usuario ||--o{ SolicitudAdmin : resuelta_por
    Plantel ||--o{ SolicitudAdmin : plantel
    Turno ||--o{ SolicitudAdmin : turno


> El diagrama muestra, por legibilidad, la PK y las FK de cada tabla. El detalle
> completo de columnas está en el diccionario de datos (sección 2.3).

---

## 2.3 Diccionario de Datos

### Subsistema 1 — Catálogos base

#### Tabla Rol

Catálogo de roles del sistema (superusuario, colaborador, admin, docente,
alumno).

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_rol | bigint | — | ✔️ | | ✔️ | | ✔️ |
| nombre_rol | nvarchar | 50 | | | ✔️ | | |

- nombre_rol es *único*.

#### Tabla Plantel

Catálogo de planteles de COBACH.

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_plantel | uniqueidentifier | — | ✔️ | | ✔️ | | |
| clave | nvarchar | 10 | | | ✔️ | | |
| nombre | nvarchar | 250 | | | ✔️ | | |

- id_plantel se genera como *UUID* (uuid4); *no es autoincremental*.
- clave es *única*.

#### Tabla Turno

Catálogo de turnos (Matutino, Vespertino, Mixto).

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_turno | bigint | — | ✔️ | | ✔️ | | ✔️ |
| nombre_turno | nvarchar | 30 | | | ✔️ | | |

- nombre_turno es *único*.

#### Tabla Semestre

Catálogo de semestres (1 a 6).

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_semestre | int | — | ✔️ | | ✔️ | | |

- La PK es un entero *asignado manualmente* (no autoincremental).

#### Tabla Letra

Catálogo de letras de grupo (A, B, C, …).

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_letra | char | 1 | ✔️ | | ✔️ | | |

#### Tabla Grupo

Combinación de semestre y letra que identifica a un grupo escolar.

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_grupo | bigint | — | ✔️ | | ✔️ | | ✔️ |
| semestre_id | int | — | | ✔️ | ✔️ | | |
| letra_id | char | 1 | | ✔️ | ✔️ | | |

- Restricción de unicidad: *(semestre_id, letra_id)*.
- Ambas FK con ON DELETE CASCADE.

---

### Subsistema 2 — Identidad y accesos

#### Tabla Usuario

Cuenta de una persona en el sistema. La adscripción a planteles/turnos se modela en
UsuarioPlantel (no directamente aquí).

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_usuario | bigint | — | ✔️ | | ✔️ | | ✔️ |
| rol_id | bigint | — | | ✔️ | ✔️ | | |
| correo | nvarchar | 100 | | | ✔️ | | |
| nombre | nvarchar | 150 | | | | ✔️ | |
| google_id | nvarchar | 255 | | | | ✔️ | |
| matricula | nvarchar | 20 | | | | ✔️ | |
| password_mock | nvarchar | 128 | | | | ✔️ | |
| id_api | nvarchar | 100 | | | | ✔️ | |
| activo | bit | — | | | ✔️ | | |
| ultima_sesion | datetime2 | — | | | | ✔️ | |

- Son *únicos*: correo, google_id, matricula.
- rol_id con ON DELETE PROTECT (no se puede borrar un rol con usuarios).
- activo tiene valor por defecto 1 (verdadero).
- id_api guarda el identificador del usuario en la API institucional (los alumnos se
  identifican por este valor).
- password_mock guarda un hash PBKDF2 (formato de Django), nunca la contraseña en texto
  plano. Solo se usa para cuentas locales sin credencial institucional; en el resto de
  usuarios permanece NULL. Se asigna con `manage.py set_password_mock <correo>`.

#### Tabla UsuarioPlantel

Relación N:M entre Usuario y Plantel, cualificada por Turno. Un usuario puede
tener varias adscripciones (plantel + turno).

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_usuario_plantel | bigint | — | ✔️ | | ✔️ | | ✔️ |
| usuario_id | bigint | — | | ✔️ | ✔️ | | |
| plantel_id | uniqueidentifier | — | | ✔️ | ✔️ | | |
| turno_id | bigint | — | | ✔️ | ✔️ | | |

- Restricción de unicidad: *(usuario_id, plantel_id, turno_id)*.
- Las tres FK con ON DELETE CASCADE.

#### Tabla GoogleOauthCredential

Credenciales OAuth de Google de un usuario (para la sincronización con Google
Calendar). Relación *uno a uno* con Usuario.

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id | bigint | — | ✔️ | | ✔️ | | ✔️ |
| usuario_id | bigint | — | | ✔️ | ✔️ | | |
| email_google | nvarchar | 254 | | | | ✔️ | |
| access_token | nvarchar(max) | máx | | | ✔️ | | |
| refresh_token | nvarchar(max) | máx | | | | ✔️ | |
| scopes | nvarchar(max) | máx | | | ✔️ | | |
| expiry | datetime2 | — | | | ✔️ | | |
| semestre_id | int | — | | ✔️ | | ✔️ | |
| grupo_id | bigint | — | | ✔️ | | ✔️ | |

- usuario_id es *único* (relación 1:1) con ON DELETE CASCADE.
- semestre_id y grupo_id con ON DELETE SET NULL.

#### Tabla DispositivoFCM

Dispositivo/navegador registrado para recibir notificaciones push. Puede no tener
usuario asociado (dispositivo anónimo suscrito por temas).

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_dispositivo | bigint | — | ✔️ | | ✔️ | | ✔️ |
| usuario_id | bigint | — | | ✔️ | | ✔️ | |
| token_fcm | nvarchar | 255 | | | ✔️ | | |
| temas | nvarchar(max) | máx | | | ✔️ | | |
| activo | bit | — | | | ✔️ | | |
| fecha_registro | datetime2 | — | | | ✔️ | | |
| fecha_actualizacion | datetime2 | — | | | ✔️ | | |

- token_fcm es *único*.
- temas es un arreglo JSON (lista de temas suscritos); por defecto [].
- usuario_id con ON DELETE CASCADE.
- fecha_registro se asigna al crear; fecha_actualizacion se actualiza en cada
  guardado.

---

### Subsistema 3 — Calendario y eventos

#### Tabla Calendario

Calendario escolar (por ejemplo, escolarizado o SEA). Agrupa eventos.

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_calendario | bigint | — | ✔️ | | ✔️ | | ✔️ |
| nombre | nvarchar | 120 | | | ✔️ | | |
| clave | nvarchar | 30 | | | ✔️ | | |
| ciclo | nvarchar | 20 | | | ✔️ | | |
| es_publico | bit | — | | | ✔️ | | |
| activo | bit | — | | | ✔️ | | |
| orden | int | — | | | ✔️ | | |

- clave es *única*.
- es_publico y activo por defecto 1; orden por defecto 0.

#### Tabla TipoEvento

Tipo/categoría de evento con su color (simbología del calendario). Puede ser global
(plantel_id nulo) o específico de un plantel.

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_tipo_evento | bigint | — | ✔️ | | ✔️ | | ✔️ |
| nombre | nvarchar | 120 | | | ✔️ | | |
| color_hex | nvarchar | 7 | | | ✔️ | | |
| plantel_id | uniqueidentifier | — | | ✔️ | | ✔️ | |

- color_hex por defecto #64748B.
- plantel_id con ON DELETE CASCADE.

#### Tabla Evento

Evento del calendario. Los campos plantel, turno, semestre y grupo en nulo
amplían la visibilidad (nulo = "para todos").

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_evento | bigint | — | ✔️ | | ✔️ | | ✔️ |
| calendario_id | bigint | — | | ✔️ | ✔️ | | |
| tipo_evento_id | bigint | — | | ✔️ | ✔️ | | |
| titulo | nvarchar | 200 | | | ✔️ | | |
| area | nvarchar | 80 | | | ✔️ | | |
| fecha_inicio | date | — | | | ✔️ | | |
| fecha_fin | date | — | | | | ✔️ | |
| hora_inicio | time | — | | | | ✔️ | |
| hora_fin | time | — | | | | ✔️ | |
| lugar | nvarchar | 150 | | | ✔️ | | |
| plantel_id | uniqueidentifier | — | | ✔️ | | ✔️ | |
| turno_id | bigint | — | | ✔️ | | ✔️ | |
| semestre_id | int | — | | ✔️ | | ✔️ | |
| grupo_id | bigint | — | | ✔️ | | ✔️ | |
| creado_por_id | bigint | — | | ✔️ | | ✔️ | |
| publico | bit | — | | | | ✔️ | |
| fecha_creacion | datetime2 | — | | | ✔️ | | |

- calendario_id con ON DELETE CASCADE; tipo_evento_id con ON DELETE PROTECT.
- plantel_id y turno_id con ON DELETE CASCADE; semestre_id, grupo_id y
  creado_por_id con ON DELETE SET NULL.
- area y lugar son NOT NULL con valor por defecto cadena vacía.
- publico es un bit *anulable* (por defecto nulo).
- fecha_creacion se asigna automáticamente al crear.

#### Tabla EventoGoogleSync

Mapea cada evento con cada usuario que lo tiene sincronizado en su Google Calendar.

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id | bigint | — | ✔️ | | ✔️ | | ✔️ |
| evento_id | bigint | — | | ✔️ | ✔️ | | |
| usuario_id | bigint | — | | ✔️ | ✔️ | | |
| google_event_id | nvarchar | 255 | | | ✔️ | | |

- Restricción de unicidad: *(evento_id, usuario_id)*.
- Ambas FK con ON DELETE CASCADE.

---

### Subsistema 4 — Comunicación

#### Tabla Anuncio

Anuncio dirigido a una audiencia, opcionalmente acotado a un plantel y/o turno.

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_anuncio | bigint | — | ✔️ | | ✔️ | | ✔️ |
| titulo | nvarchar | 200 | | | ✔️ | | |
| descripcion | nvarchar(max) | máx | | | ✔️ | | |
| color | nvarchar | 20 | | | ✔️ | | |
| audiencia | nvarchar | 20 | | | ✔️ | | |
| plantel_id | uniqueidentifier | — | | ✔️ | | ✔️ | |
| turno_id | bigint | — | | ✔️ | | ✔️ | |
| creado_por_id | bigint | — | | ✔️ | | ✔️ | |
| fecha_creacion | datetime2 | — | | | ✔️ | | |

- audiencia admite: todos, colaborador, admin, docente, alumno (por
  defecto todos). color por defecto azul.
- plantel_id y turno_id con ON DELETE CASCADE; creado_por_id con
  ON DELETE SET NULL.

#### Tabla Conversacion

Conversación privada entre dos usuarios dentro de un plantel.

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_conversacion | bigint | — | ✔️ | | ✔️ | | ✔️ |
| participante_a_id | bigint | — | | ✔️ | ✔️ | | |
| participante_b_id | bigint | — | | ✔️ | ✔️ | | |
| plantel_id | uniqueidentifier | — | | ✔️ | ✔️ | | |
| fecha_creacion | datetime2 | — | | | ✔️ | | |
| activa | bit | — | | | ✔️ | | |

- Restricción de unicidad: *(participante_a_id, participante_b_id)*.
- Restricción CHECK chk_conversacion_orden_participantes:
  participante_a_id < participante_b_id (normaliza el par para evitar duplicados
  invertidos).
- Las tres FK con ON DELETE CASCADE. activa por defecto 1.

#### Tabla Mensaje

Mensaje *cifrado* dentro de una conversación. El contenido nunca se guarda en claro.

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_mensaje | bigint | — | ✔️ | | ✔️ | | ✔️ |
| conversacion_id | bigint | — | | ✔️ | ✔️ | | |
| remitente_id | bigint | — | | ✔️ | ✔️ | | |
| contenido_cifrado | nvarchar(max) | máx | | | ✔️ | | |
| iv | nvarchar | 24 | | | ✔️ | | |
| metadatos_cifrados | nvarchar(max) | máx | | | | ✔️ | |
| iv_metadatos | nvarchar | 24 | | | | ✔️ | |
| fecha_envio | datetime2 | — | | | ✔️ | | |
| eliminado | bit | — | | | ✔️ | | |

- contenido_cifrado/iv y metadatos_cifrados/iv_metadatos guardan el texto y sus
  metadatos cifrados junto con su vector de inicialización.
- Ambas FK con ON DELETE CASCADE. eliminado por defecto 0.

#### Tabla LecturaMensaje

Marca del último mensaje leído por un usuario en una conversación (para el conteo de no
leídos).

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_lectura_mensaje | bigint | — | ✔️ | | ✔️ | | ✔️ |
| conversacion_id | bigint | — | | ✔️ | ✔️ | | |
| usuario_id | bigint | — | | ✔️ | ✔️ | | |
| ultimo_leido_id | bigint | — | | ✔️ | | ✔️ | |

- Restricción de unicidad: *(conversacion_id, usuario_id)*.
- conversacion_id y usuario_id con ON DELETE CASCADE; ultimo_leido_id
  (referencia a Mensaje) con ON DELETE SET NULL.

---

### Subsistema 5 — Notificaciones y solicitudes

#### Tabla Notificacion

Registro del centro de notificaciones (la campana). Es una "instantánea": guarda el
título y mensaje y referencia opcionalmente al anuncio o evento que la originó.

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_notificacion | bigint | — | ✔️ | | ✔️ | | ✔️ |
| categoria | nvarchar | 20 | | | ✔️ | | |
| titulo | nvarchar | 200 | | | ✔️ | | |
| mensaje | nvarchar(max) | máx | | | ✔️ | | |
| audiencia | nvarchar | 20 | | | ✔️ | | |
| plantel_id | uniqueidentifier | — | | ✔️ | | ✔️ | |
| turno_id | bigint | — | | ✔️ | | ✔️ | |
| anuncio_id | bigint | — | | ✔️ | | ✔️ | |
| evento_id | bigint | — | | ✔️ | | ✔️ | |
| fecha_creacion | datetime2 | — | | | ✔️ | | |

- categoria admite: anuncio, evento (por defecto anuncio). audiencia por
  defecto todos; mensaje por defecto cadena vacía.
- plantel_id y turno_id con ON DELETE CASCADE; anuncio_id y evento_id con
  ON DELETE SET NULL (la notificación sobrevive aunque se borre su origen).

#### Tabla SolicitudAdmin

Solicitud de un usuario que debe resolver un superusuario/administrador. Según su
tipo: elevación a administrador, visualización de un plantel adicional, o cambio de
turno.

| Atributo | Tipo | Tamaño | PK | FK | Oblig. | Null | Autoinc. |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| id_solicitud_admin | bigint | — | ✔️ | | ✔️ | | ✔️ |
| tipo | nvarchar | 20 | | | ✔️ | | |
| usuario_id | bigint | — | | ✔️ | ✔️ | | |
| plantel_id | uniqueidentifier | — | | ✔️ | | ✔️ | |
| turno_id | bigint | — | | ✔️ | | ✔️ | |
| motivo | nvarchar(max) | máx | | | ✔️ | | |
| estado | nvarchar | 20 | | | ✔️ | | |
| fecha_solicitud | datetime2 | — | | | ✔️ | | |
| resuelta_por_id | bigint | — | | ✔️ | | ✔️ | |
| fecha_resolucion | datetime2 | — | | | | ✔️ | |

- tipo admite: admin, visualizacion, turno (por defecto admin).
- estado admite: pendiente, aceptada, rechazada, revocada (por defecto
  pendiente).
- usuario_id con ON DELETE CASCADE; plantel_id, turno_id y resuelta_por_id
  con ON DELETE SET NULL.
- motivo es NOT NULL con valor por defecto cadena vacía.
- Regla de negocio asociada: un usuario está limitado a *2 planteles* para las
  solicitudes de visualización (constante LIMITE_PLANTELES).