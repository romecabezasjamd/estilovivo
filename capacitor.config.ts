import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.estilovivo.app',
  appName: 'EstiloVivo',
  webDir: 'dist',
  server: {
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#F8F9FA',
  },
  plugins: {
    Camera: {
      permissions: true,
    },
  },
};

export default config;
