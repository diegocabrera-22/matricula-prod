# Firma de matrícula vía SIMPLE (integración)

La firma de los documentos de matrícula (religión, acta de compromiso, autorización de
entrevistas, uso de imágenes) NO ocurre dentro de esta plataforma: ocurre en **SIMPLE**
(`tramites.slepvalparaiso.gob.cl`), que autentica al apoderado con **Clave Única** y le
envía la copia por correo. Nuestro sistema solo **recibe el resultado** y lo persiste.

Mismo patrón que ya existe en OIRS/SIAC (acción `rest` de SIMPLE → Edge Function de Supabase).

## Componentes
- **Edge Function**: `sync-matricula` (id `9b73b56b-...`, `verify_jwt=true`).
  - URL: `https://gyhihuovussdauehmeuk.supabase.co/functions/v1/sync-matricula`
  - Código versionado en `supabase/functions/sync-matricula/index.ts`.
  - Escribe en el schema `matriculas` con la `service_role`.
- **Tablas** (schema `matriculas`, migración en `backend/apply_firma_migration.py`):
  - `firma_matricula`: 1 fila por matrícula (solicitud + resultado). Campos: `id_matricula`
    (FK), `simple_tramite_id` (único), `rut_alumno`, `rut_apoderado`, `rut_firmante`,
    `anio_escolar`, `estado` (pendiente|firmado), `metodo`, `respuestas` JSONB,
    `correo_apoderado`, `url_pdf_firmado`, `fecha_envio`, `fecha_firma`.
  - `matricula.estado_firma`: `sin_firma` | `pendiente` | `firmada` (badge en la grilla).

## Cómo ubica la matrícula (SIN token, por ahora)
La Edge Function ubica la matrícula por **RUT del alumno normalizado** (quita puntos/guión)
+ `anio_escolar` opcional; si no viene el año, toma la matrícula más reciente del alumno.
> Limitación conocida: sin token, la seguridad recae en el `x-simple-token` y en validar
> que el RUT firmante (Clave Única) coincida con el `rut_apoderado` registrado. Si más
> adelante se quiere trazar el trámite exacto, agregar un `token_tramite` opaco por matrícula.

## Eventos que envía SIMPLE (acciones `rest`)
Header en ambas (igual que OIRS, pero con token propio de matrícula):
`{"Content-Type":"application/json","apikey":"<anon>","Authorization":"Bearer <anon>","x-simple-token":"<SIMPLE_TOKEN>"}`

**Evento `ingreso`** (al abrir el trámite):
```json
{"evento":"ingreso","simple_tramite_id":"@!tramite_id","rut_alumno":"@@rut_alumno","anio_escolar":"@@anio_escolar"}
```

**Evento `firma`** (al firmar con Clave Única):
```json
{"evento":"firma","simple_tramite_id":"@!tramite_id","rut_alumno":"@@rut_alumno",
 "anio_escolar":"@@anio_escolar","rut_firmante":"@@rut_clave_unica",
 "religion":"@@opcion_religion","acepta_acta":"@@acepta_acta",
 "autoriza_entrevista":"@@autoriza_entrevista","autoriza_imagenes":"@@autoriza_imagenes",
 "correo_apoderado":"@@correo_apoderado","url_pdf_firmado":"@@url_pdf"}
```
La función responde `{"ok":true,"estado":"firmada","id_matricula":N}` o un error con status
(401 token inválido, 404 alumno/matrícula no encontrada, 409 RUT firmante ≠ apoderado).

## Seguridad
- **Secreto `SIMPLE_TOKEN`**: se valida en cada request. Debe setearse como *secret* de la
  Edge Function en Supabase (Dashboard → Edge Functions → sync-matricula → Secrets, o
  `supabase secrets set SIMPLE_TOKEN=...`). NO usar el `educ++2026` corto de OIRS; usar un
  valor largo aleatorio (se generó uno con `secrets.token_urlsafe`). NO commitear el valor.
- La función valida que `rut_firmante` (Clave Única) == `rut_apoderado` de la matrícula.
- Higiene pendiente: rotar la `service_role`/anon key y el `x-simple-token` de OIRS que se
  expusieron durante la configuración.

## Pendiente (no hecho aún)
- Setear el secret `SIMPLE_TOKEN` en Supabase (no hay tool MCP; es manual).
- Crear las 2 acciones `rest` en el proceso de SIMPLE apuntando a la función.
- Frontend: mostrar el badge `estado_firma` en la grilla y el link/QR al trámite de SIMPLE.
- Generación de PDF firmado / correo: hoy lo hace SIMPLE; si se quiere copia propia, usar
  `pdf_service.py` + `email_service.py`.
