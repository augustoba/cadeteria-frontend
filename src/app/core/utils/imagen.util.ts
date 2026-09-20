/**
 * Inserta una transformación de Cloudinary en una URL para no servir el original.
 *
 * El problema que resuelve: las fotos se suben desde el celular y se guardan/sirven
 * crudas. Una miniatura de 56 px estaba bajando una foto de 2-5 MB — el navegador tira
 * el 99,9% de esos bytes al renderizar.
 *
 * Cloudinary transforma POR URL, así que esto arregla también las fotos YA subidas: no
 * hay migración, no se re-sube nada.
 *
 * Si la URL no es de Cloudinary, o ya trae una transformación, se devuelve tal cual —
 * romper una URL que hoy funciona sería peor que el problema que esto arregla.
 */
const MARCA = '/image/upload/';

export function optimizarImagen(url: string | null | undefined, ancho: number): string | null | undefined {
  if (!url || !url.includes('res.cloudinary.com')) return url;

  const i = url.indexOf(MARCA);
  if (i === -1) return url;

  const resto = url.slice(i + MARCA.length);
  const barra = resto.indexOf('/');
  if (barra === -1) return url;

  const primero = resto.slice(0, barra);
  // "v1234567" es la versión del asset. Cualquier otro segmento con "_" o "," ya es una
  // transformación puesta por otro lado.
  const esVersion = /^v\d+$/.test(primero);
  if (!esVersion && /[_,]/.test(primero)) return url;

  const transformacion = `f_auto,q_auto,c_limit,w_${ancho}`;
  return `${url.slice(0, i + MARCA.length)}${transformacion}/${resto}`;
}
