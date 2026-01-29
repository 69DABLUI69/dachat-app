import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dachat.app',
  appName: 'DaChat',
  webDir: 'out', 
  server: {
    url: 'https://dachat-app.vercel.app', 
    cleartext: true
  },
  plugins: {
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#000000', 
    },
    NavigationBar: {
      backgroundColor: '#000000',
      style: 'Dark'
    }
  }
};

export default config;