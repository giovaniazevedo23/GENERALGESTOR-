// GENERAL PWA Controller — Instalação Mobile & Monitor de Conectividade
const PWAController = {
  deferredPrompt: null,
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
  isStandalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,

  init() {
    this.registerServiceWorker();
    this.setupInstallListeners();
    this.setupNetworkListeners();
    this.updateUIState();
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((registration) => {
            console.log('🛡️ ServiceWorker GENERAL registrado com sucesso:', registration.scope);
          })
          .catch((err) => {
            console.warn('⚠️ Falha ao registrar ServiceWorker:', err);
          });
      });
    }
  },

  setupInstallListeners() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButtons();
    });

    window.addEventListener('appinstalled', () => {
      console.log('✅ GENERAL PWA instalado com sucesso!');
      this.deferredPrompt = null;
      this.hideInstallButtons();
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('🎉 GENERAL instalado com sucesso no seu celular!');
      }
    });

    // Se for iOS Safari e não estiver em standalone, mostrar botão de ajuda no iOS
    if (this.isIOS && !this.isStandalone) {
      this.showInstallButtons();
    }
  },

  showInstallButtons() {
    const installBtns = document.querySelectorAll('.install-app-btn, #install-app-btn');
    installBtns.forEach(btn => {
      btn.classList.remove('hidden');
      btn.classList.add('flex');
    });
  },

  hideInstallButtons() {
    const installBtns = document.querySelectorAll('.install-app-btn, #install-app-btn');
    installBtns.forEach(btn => {
      btn.classList.add('hidden');
      btn.classList.remove('flex');
    });
  },

  async triggerInstall() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log(`PWA Prompt resultado: ${outcome}`);
      if (outcome === 'accepted') {
        this.deferredPrompt = null;
        this.hideInstallButtons();
      }
    } else if (this.isIOS) {
      this.openIOSInstallModal();
    } else if (this.isStandalone) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('ℹ️ O GENERAL já está rodando como Aplicativo Nativo!');
      }
    } else {
      alert('Para instalar o GENERAL no seu dispositivo:\n\n• No Android/Chrome: Toque no menu (3 pontos) > "Instalar aplicativo" ou "Adicionar à Tela Inicial".\n• No iPhone/Safari: Toque em Compartilhar (ícone com seta para cima) > "Adicionar à Tela de Início".');
    }
  },

  openIOSInstallModal() {
    const modal = document.getElementById('ios-install-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  closeIOSInstallModal() {
    const modal = document.getElementById('ios-install-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  setupNetworkListeners() {
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
    // Checagem inicial
    this.handleNetworkChange(navigator.onLine);
  },

  handleNetworkChange(isOnline) {
    const badge = document.getElementById('network-status-badge');
    const textEl = document.getElementById('network-status-text');
    const dotEl = document.getElementById('network-status-dot');

    if (badge && textEl && dotEl) {
      if (isOnline) {
        badge.className = 'flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold';
        dotEl.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
        textEl.textContent = 'ONLINE';
      } else {
        badge.className = 'flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-full text-[10px] font-bold';
        dotEl.className = 'w-2 h-2 rounded-full bg-amber-400';
        textEl.textContent = 'MODO OFFLINE (PWA)';
        
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast('⚡ Conexão offline detectada. O GENERAL continua operando com dados locais!');
        }
      }
    }
  },

  updateUIState() {
    if (this.isStandalone) {
      console.log('📱 GENERAL em execução no Modo Standalone (App Nativo).');
      const badge = document.getElementById('pwa-mode-badge');
      if (badge) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
      }
    }
  }
};

// Inicialização automática
document.addEventListener('DOMContentLoaded', () => PWAController.init());

