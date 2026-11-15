import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.echecs.maitre',
  appName: 'Maître des Échecs',
  webDir: 'dist',
  backgroundColor: '#0f1115',
  ios: { contentInset: 'never', scheme: 'Maitre Echecs', backgroundColor: '#0f1115', limitsNavigationsToAppBoundDomains: false },
  plugins: {
    SplashScreen: { launchShowDuration: 800, launchAutoHide: true, backgroundColor: '#0f1115', showSpinner: false },
    LocalNotifications: { iconColor: '#7c5cff' },
  },
};
export default config;
