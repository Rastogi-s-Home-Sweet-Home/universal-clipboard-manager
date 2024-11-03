import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';

function InstallPWA() {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Debug PWA support
    console.log('PWA Debug:', {
      isHttps: window.location.protocol === 'https:',
      hasServiceWorker: 'serviceWorker' in navigator,
      hasManifest: !!document.querySelector('link[rel="manifest"]'),
      displayMode: window.matchMedia('(display-mode: standalone)').matches
    });

    const checkInstalled = async () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('App is already installed (standalone mode)');
        setIsInstalled(true);
        return;
      }

      // For Chrome & Edge
      if (window.navigator.standalone === true) {
        console.log('App is already installed (navigator.standalone)');
        setIsInstalled(true);
        return;
      }
    };

    checkInstalled();

    const handler = (e) => {
      console.log('beforeinstallprompt fired!', e);
      e.preventDefault();
      setPromptInstall(e);
      setSupportsPWA(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    
    // Debug when app becomes installed
    window.addEventListener('appinstalled', (event) => {
      console.log('App was installed!', event);
      setIsInstalled(true);
      setSupportsPWA(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async (e) => {
    e.preventDefault();
    if (!promptInstall) {
      console.log('No install prompt available');
      return;
    }
    
    console.log('Showing install prompt');
    promptInstall.prompt();
    
    const { outcome } = await promptInstall.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setSupportsPWA(false);
    }
    
    setPromptInstall(null);
  };

  // Debug render
  console.log('InstallPWA render state:', { supportsPWA, isInstalled });

  if (!supportsPWA || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 p-4 bg-white rounded-lg shadow-lg z-50">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Install Universal Clipboard for easier access!</p>
        <Button 
          onClick={handleInstallClick}
          className="bg-primary hover:bg-primary-dark text-white"
        >
          Install App
        </Button>
      </div>
    </div>
  );
}

export default InstallPWA; 