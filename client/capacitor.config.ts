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
      backgroundColor: '#2d0055', // REPLACE this with your exact purple hex color
    },
    NavigationBar: {
      backgroundColor: '#2d0055', // REPLACE this with your exact purple hex color
      style: 'Dark'
    }
  }
};

export default config;