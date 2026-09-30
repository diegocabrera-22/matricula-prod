# Firma de matrícula vía SIMPLE (integración)

La firma de los documentos de matrícula (religión, acta de compromiso, autorización de
entrevistas, uso de imágenes) NO ocurre dentro de esta plataforma: ocurre en **SIMPLE**
(`tramites.slepvalparaiso.gob.cl`), que autentica al apoderado con **Clave Única** y le
envía copia por correo. Nuestro sistema solo **recibe el resultado** y lo persiste.

Hermano del flujo OIRS/SIAC (mismo patrón SIMPLE ↔ Edge Function), pero en el schema
`matriculas`. **Probado end-to-end con éxito** (apoderado real firmó con Clave Única).

## Componentes
- **Edge Function**: `sync-matricula` (`ACTIVE`, **`verify_jwt = FALSE`**).
  - URL: `https://gyhihuovussdauehmeuk.supabase.co/functions/v1/sync-matricula`
  - Código versionado en `supabase/functions/sync-matricula/index.ts`.
  - Escribe en el schema `matriculas` con la `service_role`.
  - `verify_jwt=false` es obligatorio: SIMPLE no manda JWT de usuario; si se pone true, la
    plataforma rechaza con 401 antes de ejecutar. La seguridad es el `x-simple-token`.
  - Responde preflight `OPTIONS` (204) y refleja `access-control-request-headers` (SIMPLE
    inyecta `x-csrf-token` en el AJAX; sin esto da error CORS).
  - Limpia el sufijo `&_token=<csrf>` que SIMPLE pega al final del body antes de parsear.
  - Ubica la matrícula con la función SQL `matriculas.buscar_matricula_por_rut(p_rut, p_anio)`.
- **Tablas y función** (schema `matriculas`, migración en `backend/apply_firma_migration.py`):
  - `firma_matricula`: 1 fila por firma. Incluye `nombre_firmante`, `nombres_firmante`,
    `apellidos_firmante`, `email_firmante` (de Clave Única), `respuestas` JSONB, etc.
    `simple_tramite_id` es UNIQUE (upsert `onConflict`).
  - `matricula` (columnas materializadas de firma): `estado_firma` (`sin_firma`|`Pendiente`|
    `Firmada`), `metodo_firma`, `opcion_religion`, `acepta_compromiso`,
    `autoriza_entrevista`, `autoriza_imagen`.
  - Función `buscar_matricula_por_rut(text, integer)` `SECURITY DEFINER`: normaliza el RUT,
    filtra en la base y devuelve la matrícula (del año exacto si se pasa, o la más reciente).

## Seguridad — token
- Secreto **`SIMPLE_API_TOKEN`** (nombre de la env var que lee la función). Hoy su valor es
  `educ++2026` (el mismo de OIRS). Setearlo como *secret* de la Edge Function en Supabase
  (Dashboard → Edge Functions → sync-matricula → Secrets). NO commitear el valor.
  > Higiene: para firma legal conviene un token largo/aleatorio propio y rotar el de OIRS.
- La función valida que `rut_firmante` (Clave Única) coincida con el apoderado **principal
  o suplente** del alumno (409 si no coincide; 422 si el alumno no tiene apoderado cargado).

## Eventos y body
Header en las llamadas (igual que OIRS):
`{"Content-Type":"application/json","apikey":"<anon>","Authorization":"Bearer <anon>","x-simple-token":"<SIMPLE_API_TOKEN>"}`

**`firma`** (el usado hoy):
```json
{"evento":"firma","simple_tramite_id":"@!tramite_id","rut_alumno":"@@rut_alumno",
 "anio_escolar":"@@anio_escolar","rut_firmante":"@!rut","nombres":"@!nombres",
 "apellidos":"@!apellidos","email":"@!email","religion":"@@opcion_religion",
 "acepta_acta":"@@acepta_acta","autoriza_entrevista":"@@autoriza_entrevista",
 "autoriza_imagenes":"@@autoriza_imagenes","url_pdf_firmado":"@@url_pdf"}
```
- `religion`: `catolica|evangelica|otra|no_opta`. Los SI/NO: `SI|NO`.
- `nombres/apellidos/email/rut_firmante` vienen de Clave Única (`@!...`).

**`ingreso`** (soportado, no cableado aún): `{"evento":"ingreso","simple_tramite_id":"@!tramite_id","rut_alumno":"@@rut_alumno","anio_escolar":"@@anio_escolar"}`.

**Respuestas:** 200 `{ok:true,estado:"Firmada",id_matricula,...}`; 400 (falta rut_alumno/JSON);
401 (token); 404 (sin matrícula ese alumno/año — año estricto); 409 (firmante ≠ apoderado);
422 (alumno sin apoderado); 500 (BD).

## Flujo objetivo (recomendación del dueño)
Primero el **funcionario** deja la matrícula OK (fila en `matricula` con `id_estudiante` e
`id_apoderado_principal` correctos, `estado_firma='pendiente'`); después el **apoderado**
solo firma en SIMPLE. Prerrequisito para no dar 404/409: alumno con matrícula del año y su
apoderado principal (con `rut_pasaporte`) cargado.

## Frontend — cómo se envía a firma (implementado)
En `NuevaMatricula.tsx` (paso 3), método **Digital**:
- El botón "Registrar y Enviar a Firma" ejecuta `handleSubmit` → guarda la matrícula con
  `estado 'Pendiente Firma'` y `metodo_firma='Digital'` (NO abre ya el prototipo).
- Tras guardar, `ModalExito` (en modo Digital) muestra:
  - **Código QR** de la URL de SIMPLE (dependencia `qrcode.react`) para escanear con el celular.
  - Enlace copiable y el **RUT del alumno + año** (SIMPLE no los pre-carga: el apoderado
    los escribe a mano; debe saber el RUT del pupilo).
- **URL de firma en SIMPLE** (constante `URL_FIRMA_SIMPLE` en `ModalExito.tsx`):
  `https://tramites.slepvalparaiso.gob.cl/login/claveunica?redirect=https://tramites.slepvalparaiso.gob.cl/tramites/iniciar/27`
  Si cambia el número de trámite (27), actualizar esa constante.
- La firma es acto personal del apoderado (su celular / su Clave Única). El PC del
  funcionario NO debe usarse para firmar por él; para quien no tiene celular está el método
  **Manual (Papel)**.
- El prototipo `/firma-prueba` (`PortalFirmaApoderado`) se mantiene solo para demos; ya no
  es parte del flujo real. Quedó código muerto `abrirPortalPrueba` en `NuevaMatricula.tsx`
  (no rompe; `noUnusedLocals=false`), pendiente de limpiar.

## Prototipos versionados
- `.kiro/prototipos/matricula_post_js.js`: el JS que se pega en SIMPLE (reemplazar ANON y token).
- `.kiro/prototipos/sync-matricula-index.ts`: copia de referencia de la Edge Function.
- Campos del formulario SIMPLE (names que lee el JS): `rut_alumno`, `anio_escolar`,
  `rut_firmante_cu` (@!rut), `nombres_firmante` (@!nombres), `apellidos_firmante` (@!apellidos),
  `email_firmante` (@!email), `opcion_religion`, `acepta_acta`, `autoriza_entrevista`,
  `autoriza_imagenes`, `url_pdf`.

## Pendientes / decisiones abiertas
- `url_pdf_firmado` llega vacío: falta definir en SIMPLE cómo exponer la URL del PDF firmado.
- Año estricto vs flexible: hoy exige año con matrícula (404 si no). Decisión pendiente.
- Evento `ingreso`: soportado pero no cableado en el formulario.
- El token real ya está seteado en Supabase y el flujo fue probado end-to-end OK. Higiene:
  evaluar token propio de matrícula (hoy comparte `SIMPLE_API_TOKEN` con OIRS) y rotar
  anon/service_role expuestas durante la configuración.
- **Frontend: mostrar el badge `estado_firma` en la grilla de matrículas** (aún NO hecho;
  el envío a firma con QR/link SÍ está hecho, ver sección Frontend).
- Robustez futura: como SIMPLE no pre-carga datos, el riesgo es un typo del RUT del alumno.
  La mejora sería un `token_tramite` opaco por matrícula, pero requiere que SIMPLE acepte
  parámetros por URL (hoy no). Limpiar el código muerto `abrirPortalPrueba`.
