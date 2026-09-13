export interface ChatMensaje {
  id: string;
  autor: 'ADMIN' | 'CADETE';
  texto: string | null;
  /** Nota de voz grabada desde la app — alternativa a texto, no ambos vacíos. */
  audioUrl: string | null;
  /** Foto adjunta (mejora 88) — igual que audioUrl, ya subida a Cloudinary antes de llegar acá. */
  imagenUrl: string | null;
  enviadoEn: string;
  leido: boolean;
}
