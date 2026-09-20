import { optimizarImagen } from './imagen.util';

describe('optimizarImagen', () => {
  const CON_VERSION = 'https://res.cloudinary.com/demo/image/upload/v1234567/foto.jpg';

  it('inserta la transformación antes de la versión', () => {
    expect(optimizarImagen(CON_VERSION, 120)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_120/v1234567/foto.jpg',
    );
  });

  it('no duplica si la URL ya trae una transformación', () => {
    const ya = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1234567/foto.jpg';
    expect(optimizarImagen(ya, 120)).toBe(ya);
  });

  it('deja igual una URL que no es de Cloudinary', () => {
    const otra = 'https://ejemplo.com/foto.jpg';
    expect(optimizarImagen(otra, 120)).toBe(otra);
  });

  it('deja igual una URL de Cloudinary sin versión ni transformación', () => {
    // Sin un segmento reconocible después de /upload/, insertar sería adivinar.
    const rara = 'https://res.cloudinary.com/demo/image/upload/foto.jpg';
    expect(optimizarImagen(rara, 120)).toBe(rara);
  });

  it('devuelve null, undefined y vacío tal cual', () => {
    expect(optimizarImagen(null, 120)).toBeNull();
    expect(optimizarImagen(undefined, 120)).toBeUndefined();
    expect(optimizarImagen('', 120)).toBe('');
  });

  it('respeta el ancho que se le pasa', () => {
    expect(optimizarImagen(CON_VERSION, 1600)).toContain('w_1600');
    expect(optimizarImagen(CON_VERSION, 240)).toContain('w_240');
  });
});
