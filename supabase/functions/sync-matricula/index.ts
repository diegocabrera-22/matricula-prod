// Edge Function: sync-matricula
// Recibe callbacks de SIMPLE (tramites.slepvalparaiso.gob.cl) para el flujo de
// firma de matrícula. Maneja dos eventos:
//   - "ingreso": el apoderado abrió el trámite de firma (registra la solicitud).
//   - "firma":   el apoderado firmó con Clave Única (marca la matrícula firmada).
//
// Sin token: la matrícula se ubica por RUT del alumno + año escolar.
// Seguridad: valida el header x-simple-token contra el secreto SIMPLE_TOKEN.
//
// Escribe en el schema "matriculas" con la service_role (RLS bypass).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIMPLE_TOKEN = Deno.env.get("SIMPLE_TOKEN") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  db: { schema: "matriculas" },
  auth: { persistSession: false },
});

// Normaliza un RUT: quita puntos, guión y espacios, y lo pone en mayúscula.
// Así "12.345.678-9", "123456789" y "12345678-9" comparan igual.
function normalizarRut(rut: unknown): string {
  if (!rut) return "";
  return String(rut).replace(/[.\-\s]/g, "").toUpperCase();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Método no permitido" }, 405);
  }

  // 1. Validar secreto compartido con SIMPLE
  const token = req.headers.get("x-simple-token") ?? "";
  if (!SIMPLE_TOKEN || token !== SIMPLE_TOKEN) {
    return json({ ok: false, error: "No autorizado" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "JSON inválido" }, 400);
  }

  const evento = String(payload["evento"] ?? "");
  const rutAlumno = normalizarRut(payload["rut_alumno"]);
  const anio = payload["anio_escolar"] ? Number(payload["anio_escolar"]) : null;

  if (!rutAlumno) {
    return json({ ok: false, error: "Falta rut_alumno" }, 400);
  }

  // 2. Ubicar la matrícula por RUT del alumno (+ año si viene).
  //    Se busca el estudiante por run_ipe normalizado y su matrícula más reciente.
  const { data: estudiantes, error: errEst } = await supabase
    .from("estudiante")
    .select("id_estudiante, run_ipe, id_apoderado_principal")
    .limit(200);

  if (errEst) {
    return json({ ok: false, error: "Error consultando estudiante: " + errEst.message }, 500);
  }

  const estudiante = (estudiantes ?? []).find(
    (e) => normalizarRut(e.run_ipe) === rutAlumno,
  );
  if (!estudiante) {
    return json({ ok: false, error: "Estudiante no encontrado", rut_alumno: rutAlumno }, 404);
  }

  // Matrícula del estudiante (por año si viene, si no la más reciente)
  let matQuery = supabase
    .from("matricula")
    .select("id_matricula, anio_escolar, id_establecimiento, estado")
    .eq("id_estudiante", estudiante.id_estudiante)
    .order("anio_escolar", { ascending: false })
    .limit(1);

  if (anio) matQuery = matQuery.eq("anio_escolar", anio);

  const { data: matriculas, error: errMat } = await matQuery;
  if (errMat) {
    return json({ ok: false, error: "Error consultando matrícula: " + errMat.message }, 500);
  }
  const matricula = (matriculas ?? [])[0];
  if (!matricula) {
    return json({ ok: false, error: "Matrícula no encontrada para el alumno/año" }, 404);
  }

  // RUT del apoderado principal (para validar identidad del firmante)
  let rutApoderado = "";
  let correoApoderado = "";
  if (estudiante.id_apoderado_principal) {
    const { data: apo } = await supabase
      .from("apoderado")
      .select("rut_pasaporte, correo_electronico")
      .eq("id_apoderado", estudiante.id_apoderado_principal)
      .limit(1)
      .single();
    if (apo) {
      rutApoderado = normalizarRut(apo.rut_pasaporte);
      correoApoderado = apo.correo_electronico ?? "";
    }
  }

  const tramiteId = payload["simple_tramite_id"] ? String(payload["simple_tramite_id"]) : null;

  // ---- EVENTO: ingreso ----
  if (evento === "ingreso") {
    // Registrar solicitud pendiente (evita duplicar por simple_tramite_id).
    const fila = {
      id_matricula: matricula.id_matricula,
      simple_tramite_id: tramiteId,
      rut_alumno: rutAlumno,
      rut_apoderado: rutApoderado,
      anio_escolar: matricula.anio_escolar,
      estado: "pendiente",
      correo_apoderado: correoApoderado,
    };
    const { error } = await supabase
      .from("firma_matricula")
      .upsert(fila, { onConflict: "simple_tramite_id", ignoreDuplicates: true });
    if (error) {
      return json({ ok: false, error: "Error registrando ingreso: " + error.message }, 500);
    }
    await supabase
      .from("matricula")
      .update({ estado_firma: "pendiente" })
      .eq("id_matricula", matricula.id_matricula);

    return json({ ok: true, evento, id_matricula: matricula.id_matricula, estado: "pendiente" });
  }

  // ---- EVENTO: firma ----
  if (evento === "firma") {
    const rutFirmante = normalizarRut(payload["rut_firmante"]);

    // Validar identidad: quien firmó por Clave Única debe ser el apoderado registrado.
    if (rutApoderado && rutFirmante && rutFirmante !== rutApoderado) {
      // Registramos el intento como rechazado, sin marcar firmada.
      return json(
        {
          ok: false,
          error: "El RUT del firmante no coincide con el apoderado registrado.",
          rut_firmante: rutFirmante,
        },
        409,
      );
    }

    // Empaquetar las respuestas del formulario (religión, autorizaciones, etc.)
    const respuestas = {
      religion: payload["religion"] ?? null,
      acepta_acta: payload["acepta_acta"] ?? null,
      autoriza_entrevista: payload["autoriza_entrevista"] ?? null,
      autoriza_imagenes: payload["autoriza_imagenes"] ?? null,
    };

    const filaFirma = {
      id_matricula: matricula.id_matricula,
      simple_tramite_id: tramiteId,
      rut_alumno: rutAlumno,
      rut_apoderado: rutApoderado,
      rut_firmante: rutFirmante,
      anio_escolar: matricula.anio_escolar,
      estado: "firmado",
      metodo: "clave_unica_simple",
      respuestas,
      correo_apoderado: correoApoderado,
      url_pdf_firmado: payload["url_pdf_firmado"] ? String(payload["url_pdf_firmado"]) : null,
      fecha_firma: new Date().toISOString(),
    };

    // Idempotente por simple_tramite_id: si SIMPLE reintenta, actualiza la misma fila.
    const { error } = await supabase
      .from("firma_matricula")
      .upsert(filaFirma, { onConflict: "simple_tramite_id" });
    if (error) {
      return json({ ok: false, error: "Error registrando firma: " + error.message }, 500);
    }

    await supabase
      .from("matricula")
      .update({ estado_firma: "firmada" })
      .eq("id_matricula", matricula.id_matricula);

    return json({ ok: true, evento, id_matricula: matricula.id_matricula, estado: "firmada" });
  }

  return json({ ok: false, error: "Evento no reconocido: " + evento }, 400);
});
