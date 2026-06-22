/* global firebase, importScripts, clients */
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD2WdeY2QhsgHEvNiM79n-_yXqGd7RFhGw",
  authDomain: "calendariodigital-cobach-798bd.firebaseapp.com",
  projectId: "calendariodigital-cobach-798bd",
  storageBucket: "calendariodigital-cobach-798bd.firebasestorage.app",
  messagingSenderId: "983342998954",
  appId: "1:983342998954:web:0a1de260790e4aa66cf7d3"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Mensaje recibido en segundo plano: ', payload);
  const datos = payload.data || {};
  const notificationTitle = datos.title || 'Notificación';
  const notificationOptions = {
    body: datos.body || '',
    icon: '/icono.png',
    data: { url: datos.url || '/' }
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Al tocar la notificación: enfoca la app si ya está abierta, o la abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        if ('focus' in ventana) {
          if ('navigate' in ventana && destino !== '/') ventana.navigate(destino);
          return ventana.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(destino);
    })
  );
});