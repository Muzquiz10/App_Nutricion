self.addEventListener("push", (event) => {
  const fallback = {
    title: "Nuevo mensaje",
    body: "Tienes un nuevo mensaje en B-aura Connect.",
    url: "/",
  };
  const payload = event.data ? event.data.json() : fallback;

  event.waitUntil(
    self.registration.showNotification(payload.title || fallback.title, {
      body: payload.body || fallback.body,
      icon: "/B-Aura_Connect_icono.svg",
      badge: "/B-Aura_Connect_icono.svg",
      data: {
        url: payload.url || fallback.url,
      },
      tag: "baura-connect-chat-message",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }

        return clients.openWindow(targetUrl);
      }),
  );
});
