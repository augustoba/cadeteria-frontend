/**
 * Formatos de los datos que carga la gente (2026-09-26). Son los MISMOS que valida el backend
 * (`common/Validaciones.java`): el front avisa antes de enviar, el backend es el que manda. Si
 * cambia uno, cambiar el otro.
 */

/** Nombre o apellido de una persona: solo letras (con tilde/ñ), espacios, apóstrofo, guion o punto. */
export const NOMBRE_PERSONA = /^\s*\p{L}+(?:[ '.-]+\p{L}+)*\.?\s*$/u;
/** Nombre de un cliente: puede ser un comercio, así que acepta números, pero tiene que tener letras. */
export const NOMBRE_CLIENTE = /^(?=.*\p{L})[\p{L}0-9 .,'&()/º°#-]{2,100}$/u;
/** DNI: 7 u 8 números, con o sin puntos/espacios (30.111.222). */
export const DNI = /^\s*\d{1,2}[.\s]?\d{3}[.\s]?\d{3}\s*$/;
/** Teléfono: de 7 a 15 dígitos; se aceptan +, espacios, guiones y paréntesis. */
export const TELEFONO = /^(?=(?:\D*\d){7,15}\D*$)\s*\+?[0-9 ()-]+\s*$/;
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Patente de moto: vieja 123ABC o nueva A123BCD, con o sin espacios/guiones. */
export const PATENTE_MOTO = /^\s*(?:\d{3}[\s-]?[A-Za-z]{3}|[A-Za-z][\s-]?\d{3}[\s-]?[A-Za-z]{3})\s*$/;
export const MARCA_MODELO = /^[\p{L}0-9 .-]{1,40}$/u;
export const COLOR = /^[\p{L} ]{1,30}$/u;
export const CBU = /^\d{22}$/;
export const ALIAS_CBU = /^[A-Za-z0-9.-]{6,20}$/;
export const USUARIO_ADMIN = /^[A-Za-z0-9._-]{3,30}$/;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;

export const MSJ = {
  nombre: 'El nombre solo puede tener letras y espacios (sin números ni símbolos).',
  apellido: 'El apellido solo puede tener letras y espacios (sin números ni símbolos).',
  receptor: 'El nombre de quien recibe solo puede tener letras y espacios.',
  nombreCliente: 'El nombre del cliente tiene que tener letras (2 a 100 caracteres, sin símbolos raros).',
  dni: 'El DNI tiene que tener solo números, 7 u 8 dígitos (ej: 30111222).',
  telefono: 'El teléfono solo puede tener números (7 a 15 dígitos; se aceptan +, espacios y guiones).',
  email: 'El email no es válido (ej: nombre@gmail.com).',
  patente: 'La patente tiene que ser del formato viejo (123ABC) o del nuevo (A123BCD).',
  marca: 'La marca solo puede tener letras, números y espacios (hasta 40).',
  modelo: 'El modelo solo puede tener letras, números y espacios (hasta 40).',
  color: 'El color solo puede tener letras (hasta 30).',
  cbu: 'El CBU/CVU tiene que tener exactamente 22 números.',
  alias: 'El alias tiene que tener de 6 a 20 caracteres: letras, números, punto o guion.',
  usuarioAdmin: 'El usuario tiene que tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.',
  usuarioDni: 'El usuario debe ser el DNI: solo números, sin puntos ni letras, 7 u 8 dígitos.',
  password: 'La contraseña tiene que tener entre 6 y 72 caracteres.',
};

/** "30.111.222" → "30111222". */
export function soloDigitos(s: string): string {
  return (s ?? '').replace(/\D/g, '');
}

/** "a 123 bcd" → "A123BCD". */
export function normalizarPatente(s: string): string {
  return (s ?? '').replace(/[\s-]/g, '').toUpperCase();
}

/** Campo opcional: vacío vale; si tiene algo, tiene que cumplir el formato. */
export function vacioO(re: RegExp, valor: string | null | undefined): boolean {
  return !valor || !valor.trim() || re.test(valor);
}

/**
 * Junta los problemas de un formulario: cada entrada es [condición de error, mensaje]. Devuelve
 * el texto para mostrar (todos juntos) o null si está todo bien.
 */
export function problemas(chequeos: [boolean, string][]): string | null {
  const msjs = chequeos.filter(([mal]) => mal).map(([, m]) => m);
  return msjs.length ? msjs.join(' · ') : null;
}
