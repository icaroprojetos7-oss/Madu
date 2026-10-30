import { useEffect, useRef, useState } from 'react';
import { Download, Home, Package, ShoppingBag, WifiOff, X } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string };

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

function isInstallPromptEvent(event: Event): event is InstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function' && 'userChoice' in event;
}

function isAppInstalled() {
  const standalone = typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches;
  const appleStandalone = 'standalone' in navigator && navigator['standalone'] === true;
  return standalone || appleStandalone;
}

function getInstallInstructions() {
  const userAgent = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return {
      title: 'Adicione à Tela de Início',
      steps: 'No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.',
    };
  }
  if (/Android/i.test(userAgent)) {
    return {
      title: 'Instale pelo Chrome',
      steps: 'No Chrome, abra o menu ⋮ e toque em “Instalar app” ou “Adicionar à tela inicial”.',
    };
  }
  return {
    title: 'Instale a MADU',
    steps: 'No Chrome ou Edge, abra o menu do navegador e escolha “Instalar Madu Acessórios”.',
  };
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isAppInstalled);
  const [dismissed, setDismissed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPrompting, setIsPrompting] = useState(false);
  const isPromptingRef = useRef(false);
  const instructions = getInstallInstructions();

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      if (!isInstallPromptEvent(event)) return;
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowInstructions(false);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function handleInstall() {
    setErrorMessage('');
    if (!installPrompt) {
      setShowInstructions(true);
      return;
    }
    if (isPromptingRef.current) return;

    isPromptingRef.current = true;
    setIsPrompting(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') setInstalled(true);
      else setDismissed(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível iniciar a instalação.');
      setShowInstructions(true);
    } finally {
      isPromptingRef.current = false;
      setIsPrompting(false);
    }
  }

  if (installed || dismissed) return null;

  return (
    <>
      <button
        type="button"
        disabled={isPrompting}
        aria-busy={isPrompting}
        onClick={() => void handleInstall()}
        aria-label="Instalar aplicativo MADU"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#efd7e7] bg-white px-3 text-xs font-medium text-[#8B5E7C] transition active:scale-95 sm:gap-2 sm:px-4 sm:text-sm"
      >
        <Download size={17} aria-hidden="true" />
        <span className="hidden min-[360px]:inline">Instalar</span>
      </button>
      {showInstructions && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[#2d1d25]/45 p-3 sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowInstructions(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setShowInstructions(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            className="max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto rounded-[1.75rem] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-soft sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="pwa-install-title" className="text-lg font-semibold text-[#2d1d25]">
                  {instructions.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#5d4454]">{instructions.steps}</p>
              </div>
              <button
                type="button"
                autoFocus
                aria-label="Fechar instruções"
                onClick={() => setShowInstructions(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[#f8e9ef] text-[#76506a]"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 text-xs text-[#76506a]">
              A opção pode variar conforme o navegador. Se não estiver disponível, atualize a página e tente novamente.
            </p>
            {errorMessage && <p role="alert" className="mt-3 text-sm text-rose-800">{errorMessage}</p>}
          </section>
        </div>
      )}
    </>
  );
}

export function StoreBottomNavigation() {
  const location = useLocation();

  if (location.pathname.startsWith('/admin')) return null;

  const links = [
    { to: '/', label: 'Início', icon: Home, exact: true },
    { to: '/produtos', label: 'Produtos', icon: Package, exact: false },
    { to: '/carrinho', label: 'Carrinho', icon: ShoppingBag, exact: false },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#f1dfe9] bg-[#fffafc]/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(45,29,37,0.06)] backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {links.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex min-h-11 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-[11px] transition active:scale-95 ${
                isActive || (to === '/produtos' && location.pathname.startsWith('/produto/'))
                  ? 'font-semibold text-[#8B5E7C]'
                  : 'text-[#76506a]'
              }`
            }
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function OfflineNotice() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-[60] flex items-center justify-center gap-2 bg-[#5d4454] px-4 py-2 text-center text-xs font-medium text-white shadow-sm"
    >
      <WifiOff size={15} aria-hidden="true" />
      Sem conexão. Dados e ações que dependem do servidor estão indisponíveis.
    </div>
  );
}

export function VersionUpdateNotice() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let hasPreviousController = Boolean(navigator.serviceWorker.controller);
    const handleControllerChange = () => {
      if (hasPreviousController) setUpdateAvailable(true);
      hasPreviousController = true;
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl bg-[#5d4454] px-4 py-3 text-sm text-white shadow-lg md:bottom-4"
    >
      <span>Uma nova versão da MADU está pronta.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white px-4 font-medium text-[#5d4454]"
      >
        Atualizar
      </button>
    </div>
  );
}
