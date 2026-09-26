import { DNI, NOMBRE_PERSONA, PATENTE_MOTO, TELEFONO, normalizarPatente, problemas } from './validaciones';

describe('validaciones (mismas reglas que el backend)', () => {
  it('nombre: solo letras', () => {
    for (const ok of ['Juan', 'María José', "O'Connor", 'Jean-Pierre']) expect(NOMBRE_PERSONA.test(ok)).withContext(ok).toBeTrue();
    for (const mal of ['Juan2', '123', 'J@n', '']) expect(NOMBRE_PERSONA.test(mal)).withContext(mal).toBeFalse();
  });

  it('DNI: 7 u 8 números', () => {
    for (const ok of ['30111222', '1234567', '30.111.222']) expect(DNI.test(ok)).withContext(ok).toBeTrue();
    for (const mal of ['301112', '301112223', '30a11222']) expect(DNI.test(mal)).withContext(mal).toBeFalse();
  });

  it('patente de moto: 123ABC o A123BCD', () => {
    for (const ok of ['123ABC', 'a123bcd', 'A 123 BCD']) expect(PATENTE_MOTO.test(ok)).withContext(ok).toBeTrue();
    for (const mal of ['ABC123', 'AB123CD', '12ABC']) expect(PATENTE_MOTO.test(mal)).withContext(mal).toBeFalse();
    expect(normalizarPatente(' a 123-bcd ')).toBe('A123BCD');
  });

  it('teléfono: 7 a 15 dígitos', () => {
    expect(TELEFONO.test('+54 9 381 555-1234')).toBeTrue();
    expect(TELEFONO.test('381abc1234')).toBeFalse();
  });

  it('problemas junta los mensajes', () => {
    expect(problemas([[false, 'a'], [true, 'b'], [true, 'c']])).toBe('b · c');
    expect(problemas([[false, 'a']])).toBeNull();
  });
});
