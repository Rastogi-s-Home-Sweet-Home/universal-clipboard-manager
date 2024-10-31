export async function registerServiceWorker(showToast) {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      updateViaCache: 'none'
    });
    console.log('Service worker registered:', registration);

    await registration.update();

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('New service worker installing:', newWorker);

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showToast({
            title: "Update Available",
            description: "A new version is available. Click Update to reload.",
            action: (
              <button
                onClick={() => {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }}
                className="bg-primary text-white px-4 py-2 rounded"
              >
                Update
              </button>
            ),
            duration: null
          });
        }
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

  } catch (error) {
    console.error('Service worker registration failed:', error);
  }
} 