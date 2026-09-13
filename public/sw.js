/** Service worker mínimo para Web Push en /seguimiento/:token (mejora 89) — no cachea nada, solo recibe pushes. */
self.addEventListener('push', (event) => {
  let data = { title: 'Cadetería', body: 'Tu pedido cambió de estado.' };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // si no vino como JSON, se usa el mensaje por defecto
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/logo.jpg',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((clientList) => {
    if (clientList.length > 0) return clientList[0].focus();
    return self.clients.openWindow('/');
  }));
});
