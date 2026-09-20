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
  // URL firmada: el primer segmento es la firma (s--XXXXXXXX--), no la versión. Insertar
  // delante de la firma la invalida y Cloudinary rechaza la URL — se devuelve tal cual.
  if (primero.startsWith('s--')) return url;

  // "v1234567" es la versión del asset. La regla de abajo es una heurística, no una
  // garantía: cualquier otro segmento con "_" o "," se toma como una transformación puesta
  // por otro lado. Tiene un falso negativo conocido — un public_id con carpeta y sin versión
  // (p. ej. /image/upload/mi_carpeta/foto.jpg) se saltea porque "mi_carpeta" lleva "_".
  // Se deja así a propósito, y el port a Kotlin hace lo mismo.
  const esVersion = /^v\d+$/.test(primero);
  if (!esVersion && /[_,]/.test(primero)) return url;

  const transformacion = `f_auto,q_auto,c_limit,w_${ancho}`;
  return `${url.slice(0, i + MARCA.length)}${transformacion}/${resto}`;
}
