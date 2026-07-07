import { useState, useEffect, useMemo } from 'react';
import './ModalConfiguracion.css';
import { obtenerPlanteles } from '../services/authService.js';

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
        const data = await obtenerPlanteles();
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
    const termino = busqueda.trim().toLowerCase();
    const numerico = /^\d+$/.test(termino);
    const numeroPlantel = (nombre) => (nombre.match(/\d+/) ?? [''])[0];
    const filtrados = plantelesDisponibles.filter(p =>
      numerico
        ? numeroPlantel(p.nombre).startsWith(termino)
        : p.nombre.toLowerCase().includes(termino)
    );
    
    // Mover seleccionados al principio
    return filtrados.sort((a, b) => {
      const selA = selecciones[a.id] ? 1 : 0;
      const selB = selecciones[b.id] ? 1 : 0;
      return selB - selA;
    });
  }, [plantelesDisponibles, busqueda, selecciones]);

  const LIMITE_PLANTELES = 2;

  const togglePlantel = (id) => {
    setSelecciones(prev => {
      const nuevas = { ...prev };
      if (nuevas[id]) {
        delete nuevas[id];
      } else {
        if (Object.keys(nuevas).length >= LIMITE_PLANTELES) return prev; // límite alcanzado
        nuevas[id] = { matutino: false, vespertino: false, mixto: false };
      }
      return nuevas;
    });
  };

  // Solo un turno activo por plantel: Matutino, Vespertino o Mixto (excluyentes)
  const seleccionarTurno = (plantelId, turno) => {
    setSelecciones(prev => ({
      ...prev,
      [plantelId]: {
        matutino:   turno === 'matutino',
        vespertino: turno === 'vespertino',
        mixto:      turno === 'mixto',
      },
    }));
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
  const limiteAlcanzado = totalSeleccionados >= LIMITE_PLANTELES;
  const esValido = totalSeleccionados > 0 && Object.values(selecciones).every(
    turnos => turnos.matutino || turnos.vespertino || turnos.mixto
  );

  if (!isOpen) return null;

  return (
    <div className="modal-config__overlay" id="modalConfiguracion">
      <div className="tarjeta-config modal-config__contenedor">
        <div className="tarjeta-config__cabecera">
          <h2 className="tarjeta-config__titulo">Configuración Inicial</h2>
          <span className={`etiqueta-config ${limiteAlcanzado ? 'etiqueta-config--naranja' : 'etiqueta-config--azul'}`} id="contadorSeleccion">
            {totalSeleccionados}/{LIMITE_PLANTELES} plantel{totalSeleccionados !== 1 ? 'es' : ''}
          </span>
        </div>
        
        <form id="formConfiguracion" className="modal-config__form" onSubmit={handleSubmit}>
          <div className="modal-config__cuerpo">
            <p className="formulario-config__etiqueta">Busca y selecciona tus planteles y turnos:</p>
            
            {limiteAlcanzado && (
              <p className="modal-config__aviso-limite">
                Límite de {LIMITE_PLANTELES} planteles alcanzado. Desmarca uno para poder elegir otro.
              </p>
            )}

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
                  const deshabilitado = !estaSeleccionado && limiteAlcanzado;

                  return (
                    <div key={plantel.id} className={`plantel-config__item ${estaSeleccionado ? 'plantel-config__item--seleccionado' : ''} ${deshabilitado ? 'plantel-config__item--deshabilitado' : ''}`}>
                      <label className="plantel-config__header checkbox-config__grupo">
                        <input
                          type="checkbox"
                          checked={estaSeleccionado}
                          disabled={deshabilitado}
                          onChange={() => togglePlantel(plantel.id)}
                        />
                        <span className="formulario-config__etiqueta">{plantel.nombre}</span>
                      </label>
                      
                      {estaSeleccionado && (
                        <div className="plantel-config__turnos">
                          {[
                            { valor: 'matutino',   etiqueta: 'Matutino' },
                            { valor: 'vespertino',  etiqueta: 'Vespertino' },
                            { valor: 'mixto',       etiqueta: 'Mixto (ambos)' },
                          ].map(({ valor, etiqueta }) => (
                            <label key={valor} className="checkbox-config__grupo">
                              <input
                                type="radio"
                                name={`turno-${plantel.id}`}
                                checked={selecciones[plantel.id][valor] || false}
                                onChange={() => seleccionarTurno(plantel.id, valor)}
                              />
                              <span className="formulario-config__etiqueta">{etiqueta}</span>
                            </label>
                          ))}
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
