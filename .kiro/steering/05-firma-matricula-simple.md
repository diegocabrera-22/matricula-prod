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
- Setear/rotar `SIMPLE_API_TOKEN` (secret de la función); rotar anon/service_role expuestas.
- Frontend: mostrar el badge `estado_firma` en la grilla y el link/QR al trámite de SIMPLE.
