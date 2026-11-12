/**
 * Estilos de .input, .btn y .btn-mini (los mismos que el dashboard): en el panel cada pantalla los
 * define en su propio `styles`. Lo usan los componentes compartidos de pedidos (2026-11-11), que se
 * muestran dentro de distintas pantallas y no heredan esos estilos.
 */
export const ESTILOS_BOTONES = `
  .input {
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }
  .input:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-brand-400);
  }
  .btn {
    color: white;
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
  }
  .btn-mini {
    color: white;
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.4rem 0.75rem;
    border-radius: 0.3rem;
    display: inline-block;
  }
  .btn:disabled,
  .btn-mini:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
