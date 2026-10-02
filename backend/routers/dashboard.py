# routers/dashboard.py
from fastapi import APIRouter, Depends
from typing import Optional
from security import obtener_usuario_actual, validar_acceso_colegio

# Importamos la capa de servicio
from services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard y Reportes"])

@router.get("/estadisticas")
def obtener_estadisticas_dashboard(
    establecimiento_id: Optional[int] = None, 
    anio: Optional[int] = None, 
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    establecimiento_id = validar_acceso_colegio(establecimiento_id, usuario_actual)

    return dashboard_service.obtener_estadisticas_dashboard_db(establecimiento_id, anio)