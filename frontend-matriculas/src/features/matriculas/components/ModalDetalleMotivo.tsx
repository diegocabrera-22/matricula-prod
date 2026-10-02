import React from 'react';
import { 
  X, 
  FileText, 
  UserMinus, 
  ArrowRightLeft, 
  Calendar, 
  School, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquareQuote,
  ExternalLink 
} from 'lucide-react';
import type { Matricula } from '../hooks/useMatriculas';
import { API_BASE_URL } from '../../../config/api';

interface ModalDetalleMotivoProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: 'retiro' | 'cambio_curso';
  matricula: Matricula | null;
  onEmitirRetiro?: (idMatricula: number) => void;
}

interface MotivoParsed {
  motivos: string[];
  detallesAdicionales: string;
  textoCrudo: string;
}

export function parsearMotivoTexto(rawText: string | null | undefined): MotivoParsed {
  if (!rawText || !rawText.trim()) {
    return { motivos: [], detallesAdicionales: '', textoCrudo: '' };
  }

  const texto = rawText.trim();
  const motivos: string[] = [];
  let detallesAdicionales = '';

  const regexMotivos = /\[Motivos[^\]]*\]:\s*([\s\S]*?)(?=\n\s*\[Detalles Adicionales\]:|$)/i;
  const regexDetalles = /\[Detalles Adicionales\]:\s*([\s\S]*)$/i;

  const matchMotivos = texto.match(regexMotivos);
  const matchDetalles = texto.match(regexDetalles);

  if (matchMotivos && matchMotivos[1]) {
    const lineas = matchMotivos[1].split('\n');
    for (const linea of lineas) {
      const limpia = linea.replace(/^[\s•\-\*]+/, '').trim();
      if (limpia) {
        motivos.push(limpia);
      }
    }
  }

  if (matchDetalles && matchDetalles[1]) {
    detallesAdicionales = matchDetalles[1].trim();
  }

  if (motivos.length === 0 && !detallesAdicionales) {
    return {
      motivos: [],
      detallesAdicionales: '',
      textoCrudo: texto,
    };
  }

  return {
    motivos,
    detallesAdicionales,
    textoCrudo: texto,
  };
}

export const ModalDetalleMotivo: React.FC<ModalDetalleMotivoProps> = ({
  isOpen,
  onClose,
  tipo,
  matricula,
  onEmitirRetiro,
}) => {
  if (!isOpen || !matricula) return null;

  const esRetiro = tipo === 'retiro';

  // Parse according to type
  const parsedRetiro = esRetiro 
    ? parsearMotivoTexto(matricula.detalle_retiro_encuesta || matricula.motivo_retiro)
    : { motivos: [], detallesAdicionales: '', textoCrudo: '' };

  const parsedCambio = !esRetiro 
    ? parsearMotivoTexto(matricula.motivo_cambio_curso)
    : { motivos: [], detallesAdicionales: '', textoCrudo: '' };

  const token = localStorage.getItem('token');

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO */}
        <div className={`p-5 border-b flex items-start justify-between ${
          esRetiro 
            ? 'bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border-rose-200' 
            : 'bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 border-blue-200'
        }`}>
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl shadow-sm ${
              esRetiro ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'
            }`}>
              {esRetiro ? <UserMinus size={22} /> : <ArrowRightLeft size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                  esRetiro 
                    ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                }`}>
                  {esRetiro ? 'Retiro Escolar' : 'Cambio de Curso'}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Año Escolar {matricula.anio_escolar}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                {esRetiro ? 'Motivo y Razones del Retiro' : 'Justificación de Traslado / Cambio de Curso'}
              </h3>
              <p className="text-xs text-slate-600">
                {esRetiro 
                  ? 'Consulta de la justificación formal y respuestas del apoderado registradas en el sistema.' 
                  : 'Detalle de los motivos informados por el apoderado para el movimiento entre cursos.'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-lg transition-colors"
            title="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* TARJETA RESUMEN DEL ESTUDIANTE */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-slate-500 flex items-center gap-1 font-medium">
                <User size={13} className="text-slate-400" /> Estudiante:
              </span>
              <p className="font-bold text-slate-900 text-sm">{matricula.estudiante_nombre}</p>
              <p className="text-slate-600 font-mono">RUN / IPE: {matricula.estudiante_rut}</p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 flex items-center gap-1 font-medium">
                <School size={13} className="text-slate-400" /> Curso y Folio:
              </span>
              <p className="font-bold text-blue-900 text-sm">
                {matricula.curso} <span className="text-slate-500 font-normal text-xs">(Folio #{matricula.numero_correlativo})</span>
              </p>
              <p className="text-slate-600">RBD: {matricula.rbd}</p>
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-200/60">
              <span className="text-slate-500 flex items-center gap-1 font-medium">
                <Calendar size={13} className="text-slate-400" /> 
                {esRetiro ? 'Fecha Oficial de Retiro:' : 'Fecha Matrícula:'}
              </span>
              <p className="font-bold text-slate-800">
                {esRetiro 
                  ? (matricula.fecha_retiro || 'No informada') 
                  : (matricula.fecha_matricula || 'No informada')}
              </p>
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-200/60">
              <span className="text-slate-500 font-medium">Estado de la Matrícula:</span>
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${
                  esRetiro
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {matricula.estado}
                </span>
              </div>
            </div>
          </div>

          {/* CASO A: RETIRO ESCOLAR */}
          {esRetiro && (
            <div className="space-y-4">
              {/* CAUSA OFICIAL */}
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block">
                  Causa Oficial Registrada
                </span>
                <p className="text-sm font-bold text-rose-950">
                  {matricula.motivo_retiro || 'Retiro Administrativo'}
                </p>
              </div>

              {/* MOTIVOS DE LA ENCUESTA */}
              {parsedRetiro.motivos.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <CheckCircle2 size={15} className="text-amber-600" />
                    <span>Razones informadas por el Apoderado:</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {parsedRetiro.motivos.map((motivo, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-amber-950 text-xs font-semibold leading-relaxed shadow-xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                        <span>{motivo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DETALLES O COMENTARIOS ADICIONALES DEL APODERADO */}
              {parsedRetiro.detallesAdicionales && parsedRetiro.detallesAdicionales !== 'Sin comentarios adicionales.' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <MessageSquareQuote size={15} className="text-slate-500" />
                    <span>Comentarios adicionales del apoderado:</span>
                  </div>
                  <p className="text-xs text-slate-800 italic bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    "{parsedRetiro.detallesAdicionales}"
                  </p>
                </div>
              )}

              {/* SI NO HUBO MOTIVOS ESTRUCTURADOS PERO SÍ TEXTO CRUDO */}
              {parsedRetiro.motivos.length === 0 && !parsedRetiro.detallesAdicionales && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <AlertCircle size={15} className="text-slate-500" />
                    <span>Detalles del Retiro:</span>
                  </div>
                  <p className="text-xs text-slate-800 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap">
                    {parsedRetiro.textoCrudo || 'El retiro se registró directamente sin cuestionario en línea o proviene de la carga masiva SIGE.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CASO B: CAMBIO DE CURSO */}
          {!esRetiro && (
            <div className="space-y-4">
              {/* MOTIVOS DE TRASLADO */}
              {parsedCambio.motivos.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <CheckCircle2 size={15} className="text-indigo-600" />
                    <span>Razones informadas para el cambio de curso:</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {parsedCambio.motivos.map((motivo, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80 text-indigo-950 text-xs font-semibold leading-relaxed shadow-xs"
                      >
                        <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1 shrink-0" />
                        <span>{motivo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DETALLES O COMENTARIOS ADICIONALES */}
              {parsedCambio.detallesAdicionales && parsedCambio.detallesAdicionales !== 'Sin comentarios adicionales.' && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <MessageSquareQuote size={15} className="text-slate-500" />
                    <span>Comentarios adicionales del apoderado:</span>
                  </div>
                  <p className="text-xs text-slate-800 italic bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    "{parsedCambio.detallesAdicionales}"
                  </p>
                </div>
              )}

              {/* SI NO HUBO MOTIVOS ESTRUCTURADOS PERO SÍ TEXTO CRUDO */}
              {parsedCambio.motivos.length === 0 && !parsedCambio.detallesAdicionales && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <FileText size={15} className="text-slate-500" />
                    <span>Justificación registrada:</span>
                  </div>
                  <p className="text-xs text-slate-800 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap">
                    {parsedCambio.textoCrudo || 'Sin justificación escrita registrada.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* OBSERVACIONES Y TRAZABILIDAD DEL SISTEMA */}
          {matricula.observaciones && (
            <div className="pt-2 border-t border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Trazabilidad / Observaciones del Sistema:
              </span>
              <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-xl text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                {matricula.observaciones}
              </div>
            </div>
          )}
        </div>

        {/* PIE DEL MODAL CON ACCIONES */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div>
            {esRetiro && onEmitirRetiro && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEmitirRetiro(matricula.id_matricula);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Emitir Comprobante Oficial de Retiro"
              >
                <FileText size={14} />
                Emitir Cert. Retiro
              </button>
            )}

            {!esRetiro && matricula.ruta_documento_traslado && (
              <button
                type="button"
                onClick={() => {
                  window.open(`${API_BASE_URL}/documentos/adjunto?tipo=traslado&id=${matricula.id_matricula}&token=${token}`, '_blank');
                }}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                title="Ver Certificado de Traslado Adjunto"
              >
                <ExternalLink size={14} />
                Ver Cert. Traslado PDF
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalDetalleMotivo;
