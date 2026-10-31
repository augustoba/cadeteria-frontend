import { Cadete } from '../../core/models/cadete.model';
import { buscarCadetes, pasaFiltros, tieneUbicacion } from './filtro-cadetes';

function cadete(apellido: string, nombre: string, estado: string, vehiculo: string, activo = true): Cadete {
  return {
    apellido,
    nombre,
    activo,
    lat: -26.8,
    lng: -65.2,
    estado: { id: estado },
    tipoVehiculo: { id: vehiculo },
  } as unknown as Cadete;
}

describe('filtro de cadetes del mapa', () => {
  const motoLibre = cadete('Pérez', 'Juan', 'LIBRE', 'MOTO');
  const biciOcupada = cadete('Gómez', 'Ana', 'OCUPADO', 'BICI');
  const autoDesconectado = cadete('Álvarez', 'Luis', 'DESCONECTADO', 'AUTO');

  it('combina estado y vehículo', () => {
    expect(pasaFiltros(motoLibre, 'LIBRE', 'MOTO')).toBeTrue();
    expect(pasaFiltros(motoLibre, 'LIBRE', 'BICI')).toBeFalse();
    expect(pasaFiltros(biciOcupada, 'LIBRE', 'BICI')).toBeFalse();
  });

  it('desconectados y otros vehículos solo se ven en Todos', () => {
    expect(pasaFiltros(autoDesconectado, 'TODOS', 'TODOS')).toBeTrue();
    expect(pasaFiltros(autoDesconectado, 'LIBRE', 'TODOS')).toBeFalse();
    expect(pasaFiltros(autoDesconectado, 'OCUPADO', 'TODOS')).toBeFalse();
    expect(pasaFiltros(autoDesconectado, 'TODOS', 'MOTO')).toBeFalse();
  });

  it('busca por apellido o nombre sin mayúsculas ni tildes', () => {
    const todos = [motoLibre, biciOcupada, autoDesconectado];
    expect(buscarCadetes(todos, 'perez')).toEqual([motoLibre]);
    expect(buscarCadetes(todos, 'ALVAREZ')).toEqual([autoDesconectado]);
    expect(buscarCadetes(todos, 'ana gomez')).toEqual([biciOcupada]);
  });

  it('sin texto lista a todos por apellido y deja afuera a los dados de baja', () => {
    const baja = cadete('Bazán', 'Rosa', 'LIBRE', 'MOTO', false);
    expect(buscarCadetes([motoLibre, baja, biciOcupada, autoDesconectado], '')).toEqual([
      autoDesconectado,
      biciOcupada,
      motoLibre,
    ]);
  });

  it('reconoce al cadete que nunca mandó su ubicación', () => {
    expect(tieneUbicacion(motoLibre)).toBeTrue();
    expect(tieneUbicacion({ ...motoLibre, lat: null, lng: null } as unknown as Cadete)).toBeFalse();
  });
});
