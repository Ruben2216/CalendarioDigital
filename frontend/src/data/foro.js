export const CONVERSACIONES_MOCK = [
  {
    id: 'conv-1',
    destinatario: 'Administración Plantel 01',
    iniciales: 'AD',
    colorAvatar: 'azul',
    sinLeer: 2,
    mensajes: [
      {
        id: 'm1', tipo: 'enviado', hora: '10:14 a.m.',
        texto: 'Buen día, solicito el audiovisual para el próximo miércoles 17 de junio...',
        solicitud: {
          titulo: 'Solicitud de espacio',
          icono: 'calendario',
          campos: [
            { clave: 'Fecha', valor: 'Miércoles 17 jun 2026' },
            { clave: 'Horario', valor: '10:00 – 12:00 hrs' },
            { clave: 'Grupo', valor: '3-A Matutino' },
            { clave: 'Recurso', valor: 'Audiovisual + Cañón' },
          ],
        },
      },
      {
        id: 'm2', tipo: 'recibido', hora: '10:32 a.m.',
        texto: 'Buenos días, Rubén. Revisamos la disponibilidad del audiovisual para esa fecha. El horario 10:00–12:00 está libre. Su solicitud ha sido aprobada y el evento ya aparece registrado en el calendario institucional.',
        solicitud: {
          titulo: 'Solicitud aprobada',
          icono: 'check',
          campos: [
            { clave: 'Estado', valor: 'Aprobada' },
            { clave: 'Registrado en', valor: 'Calendario institucional' },
          ],
        },
      },
    ],
  },
  {
    id: 'conv-2',
    destinatario: 'Subdirección Académica',
    iniciales: 'SD',
    colorAvatar: 'verde',
    sinLeer: 0,
    mensajes: [
      { id: 'm3', tipo: 'recibido', hora: 'Ayer', texto: 'Recibido, revisaremos el horario propuesto.' },
    ],
  },
];
