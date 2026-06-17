import { useState, useEffect, useMemo } from 'react';
import './ModalConfiguracion.css';

// Componente para manejar la selección múltiple de planteles y turnos
export default function ModalConfiguracion({ isOpen, onClose, onSave }) {
  const [plantelesDisponibles, setPlantelesDisponibles] = useState([]);
  const [selecciones, setSelecciones] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPlanteles = async () => {
      try {
        const base = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
        const res = await fetch(`${base}/api/planteles/`, {
          headers: { 'Accept': 'application/json', 'ngrok-skip-browser-warning': '1' },
        });
        if (!res.ok) throw new Error('Error al cargar planteles');
        const data = await res.json();
        setPlantelesDisponibles(data.map(p => ({ id: String(p.id), nombre: p.nombre })));
      } catch (error) {
        console.error("Error cargando planteles", error);
      } finally {
        setCargando(false);
      }
    };

    fetchPlanteles();
  }, [isOpen]);

  const plantelesFiltrados = useMemo(() => {
    const termino = busqueda.toLowerCase();
    const filtrados = plantelesDisponibles.filter(p => 
      p.nombre.toLowerCase().includes(termino) || p.id.includes(termino)
    );
    
    // Mover seleccionados al principio
    return filtrados.sort((a, b) => {
      const selA = selecciones[a.id] ? 1 : 0;
      const selB = selecciones[b.id] ? 1 : 0;
      return selB - selA;
    });
  }, [plantelesDisponibles, busqueda, selecciones]);

  const togglePlantel = (id) => {
    setSelecciones(prev => {
      const nuevas = { ...prev };
      if (nuevas[id]) {
        delete nuevas[id];
      } else {
        nuevas[id] = { matutino: false, vespertino: false, mixto: false };
      }
      return nuevas;
    });
  };

  const toggleTurno = (plantelId, turno) => {
    setSelecciones(prev => {
      const nuevas = { ...prev };
      if (nuevas[plantelId]) {
        nuevas[plantelId] = {
          ...nuevas[plantelId],
          [turno]: !nuevas[plantelId][turno]
        };
      }
      return nuevas;
    });
  };

  const limpiar = () => {
    setSelecciones({});
    setBusqueda('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSave) {
      onSave(selecciones);
    }
  };

  const totalSeleccionados = Object.keys(selecciones).length;
  // Es válido si hay selección y cada selección tiene al menos un turno
  const esValido = totalSeleccionados > 0 && Object.values(selecciones).every(
    turnos => turnos.matutino || turnos.vespertino || turnos.mixto
  );

  if (!isOpen) return null;

  return (
    <div className="modal-config__overlay" id="modalConfiguracion">
      <div className="tarjeta-config modal-config__contenedor">
        <div className="tarjeta-config__cabecera">
          <h2 className="tarjeta-config__titulo">Configuración Inicial</h2>
          <span className="etiqueta-config etiqueta-config--azul" id="contadorSeleccion">
            {totalSeleccionados} seleccionado{totalSeleccionados !== 1 ? 's' : ''}
          </span>
        </div>
        
        <form id="formConfiguracion" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-config__cuerpo">
            <p className="formulario-config__etiqueta">Busca y selecciona tus planteles y turnos:</p>
            
            <div className="formulario-config__campo">
              <input 
                type="text" 
                id="buscadorPlanteles" 
                placeholder="Buscar por número o nombre (ej. 33, Terán)..." 
                autoComplete="off"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>

            <div className="lista-config__planteles" id="listaPlanteles">
              {cargando ? (
                <div className="sin-resultados-config">Cargando planteles...</div>
              ) : plantelesFiltrados.length === 0 ? (
                <div className="sin-resultados-config">No se encontraron planteles</div>
              ) : (
                plantelesFiltrados.map(plantel => {
                  const estaSeleccionado = !!selecciones[plantel.id];
                  
                  return (
                    <div key={plantel.id} className={`plantel-config__item ${estaSeleccionado ? 'plantel-config__item--seleccionado' : ''}`}>
                      <label className="plantel-config__header checkbox-config__grupo">
                        <input 
                          type="checkbox" 
                          checked={estaSeleccionado}
                          onChange={() => togglePlantel(plantel.id)} 
                        />
                        <span className="formulario-config__etiqueta">{plantel.nombre}</span>
                      </label>
                      
                      {estaSeleccionado && (
                        <div className="plantel-config__turnos">
                          <label className="checkbox-config__grupo">
                            <input 
                              type="checkbox" 
                              checked={selecciones[plantel.id].matutino || false}
                              onChange={() => toggleTurno(plantel.id, 'matutino')} 
                            />
                            <span className="formulario-config__etiqueta">Matutino</span>
                          </label>
                          <label className="checkbox-config__grupo">
                            <input 
                              type="checkbox" 
                              checked={selecciones[plantel.id].vespertino || false}
                              onChange={() => toggleTurno(plantel.id, 'vespertino')} 
                            />
                            <span className="formulario-config__etiqueta">Vespertino</span>
                          </label>
                          <label className="checkbox-config__grupo">
                            <input 
                              type="checkbox" 
                              checked={selecciones[plantel.id].mixto || false}
                              onChange={() => toggleTurno(plantel.id, 'mixto')} 
                            />
                            <span className="formulario-config__etiqueta">Mixto</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="modal-config__footer">
            <button type="button" className="boton-config boton-config--fantasma" id="btnLimpiar" onClick={limpiar}>
              Limpiar
            </button>
            <button type="submit" className="boton-config boton-config--primario" id="btnGuardar" disabled={!esValido}>
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
