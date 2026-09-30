import React, { useState } from 'react';
import { CheckCircle, Mail, Download, ArrowRight, Copy, Check, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// URL del trámite de firma en SIMPLE (login con Clave Única -> inicia el trámite 27).
const URL_FIRMA_SIMPLE =
  'https://tramites.slepvalparaiso.gob.cl/login/claveunica?redirect=https://tramites.slepvalparaiso.gob.cl/tramites/iniciar/27';

interface ModalExitoProps {
  isOpen: boolean;
  metodoFirma: string;
  generarComprobantePDF: () => void;
  onVolver: () => void;
  // Datos para el envío digital a SIMPLE (opcionales)
  rutAlumno?: string;
  anioEscolar?: string | number;
}

export const ModalExito: React.FC<ModalExitoProps> = ({
  isOpen,
  metodoFirma,
  generarComprobantePDF,
  onVolver,
  rutAlumno,
  anioEscolar,
}) => {
  const [copiado, setCopiado] = useState(false);

  if (!isOpen) return null;

  const esDigital = metodoFirma === 'Digital';

  const copiarLink = () => {
    navigator.clipboard.writeText(URL_FIRMA_SIMPLE).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }).catch(() => { /* clipboard no disponible */ });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 my-8">
        <div className="bg-[#25306B] p-6 text-center">
          <CheckCircle className="mx-auto text-emerald-400 mb-3" size={48} />
          <h3 className="text-xl font-bold text-white">
            {esDigital ? '¡Matrícula registrada! Falta la firma' : '¡Matrícula Registrada!'}
          </h3>
          <p className="text-blue-200 text-sm mt-1">
            {esDigital
              ? 'El estudiante fue ingresado y queda a la espera de la firma del apoderado.'
              : 'El estudiante ha sido ingresado exitosamente.'}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {esDigital ? (
            <>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
                <QrCode className="mx-auto text-blue-600 mb-2" size={24} />
                <p className="text-sm font-bold text-blue-900">El apoderado debe firmar con su Clave Única</p>
                <p className="text-xs text-blue-700 mt-1">
                  Pídale que escanee este código QR con su celular, o compártale el enlace.
                  Firma con su propia Clave Única (acto personal).
                </p>
              </div>

              {/* Código QR de la URL de SIMPLE */}
              <div className="flex justify-center">
                <div className="p-3 bg-white border-2 border-gray-200 rounded-xl">
                  <QRCodeSVG value={URL_FIRMA_SIMPLE} size={180} level="M" includeMargin={false} />
                </div>
              </div>

              {/* Datos que el apoderado deberá ingresar en SIMPLE (no se precargan) */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900">
                <p className="font-bold mb-1">En el formulario de SIMPLE deberá ingresar:</p>
                <p>RUT del alumno: <span className="font-mono font-bold">{rutAlumno || '—'}</span></p>
                <p>Año escolar: <span className="font-mono font-bold">{anioEscolar || '—'}</span></p>
              </div>

              {/* Enlace copiable */}
              <button
                type="button"
                onClick={copiarLink}
                className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg text-xs font-bold transition-colors"
              >
                {copiado ? (<><Check size={16} className="text-emerald-600" /> Enlace copiado</>) : (<><Copy size={16} /> Copiar enlace de firma</>)}
              </button>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-2">
                <Mail className="text-blue-600 mt-0.5 shrink-0" size={16} />
                <p className="text-xs text-blue-700">
                  La matrícula queda en estado <span className="font-bold">Pendiente de Firma</span> hasta que el
                  apoderado firme en SIMPLE. Al firmar, el estado se actualizará automáticamente.
                </p>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={generarComprobantePDF}
              className="w-full flex flex-col items-center justify-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 py-4 rounded-lg font-bold transition-colors"
            >
              <span className="flex items-center gap-2">
                <Download size={20} /> Descargar Set de Documentos (PDF)
              </span>
              <span className="text-[10px] font-normal text-orange-600">
                Imprima este archivo para la firma presencial del apoderado.
              </span>
            </button>
          )}

          <div className="border-t border-gray-100 pt-4 mt-2">
            <button
              type="button"
              onClick={onVolver}
              className="w-full flex items-center justify-center gap-2 bg-[#006BB9] hover:bg-[#25306B] text-white py-3 rounded-lg font-bold transition-colors shadow-md"
            >
              Volver al inicio <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
