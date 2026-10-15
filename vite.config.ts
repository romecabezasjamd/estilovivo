import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const geminiKey = env.GEMINI_API_KEY || '';
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
          }
        }
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon-192.png', 'icon-512.png', 'estilo-vivo-logo-full.png', 'estilo-vivo-logo-icon.png'],
          workbox: {
            globIgnores: ['**/ort-wasm-simd-threaded.jsep-*.wasm', '**/human-*', '**/tf-*', '**/tensorflow-*', '**/mediapipe-*', '**/pose-detection-*'],
            // Páginas que sirve el servidor (no la web): el service worker no debe sustituirlas por index.html
            navigateFallbackDenylist: [/^\/api\//, /^\/moderacion\//, /^\/privacidad/, /^\/privacy-policy/, /^\/eliminar-cuenta/, /^\/delete-account/, /^\/\.well-known\//],
            runtimeCaching: [
              {
                urlPattern: /\/api\/auth\//,
                handler: 'NetworkOnly',
              },
              {
                urlPattern: /\/api\//,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'api-cache',
                  networkTimeoutSeconds: 5,
                  expiration: { maxEntries: 50, maxAgeSeconds: 300 },
                },
              },
              {
                urlPattern: /^https:\/\/cdn\.jsdelivr\.net\//,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'cdn-cache',
                  expiration: { maxEntries: 100, maxAgeSeconds: 604800 },
                },
              },
            ],
          },
          manifest: {
            name: 'Estilo Vivo',
            short_name: 'EstiloVivo',
            description: 'Tu armario inteligente y probador virtual',
            theme_color: '#0F172A',
            background_color: '#0F172A',
            display: 'standalone',
            icons: [
              {
                src: 'icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'icon-512.png',
                sizes: '512x512',
                type: 'image/png'
              },
              {
                src: 'icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiKey || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey || ''),
      },
      optimizeDeps: {
        // pose-detection importa backends opcionales no instalados (@mediapipe/pose, webgpu)
        // que tumbaban el dev server; en build ya se marcan como external.
        exclude: ['@tensorflow-models/pose-detection'],
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        chunkSizeWarningLimit: 1300,
        rollupOptions: {
          external: (id) => {
            const installedMediapipe = ['@mediapipe/selfie_segmentation'];
            const installedTfjs = ['@tensorflow/tfjs-backend-cpu', '@tensorflow/tfjs-backend-webgl', '@tensorflow/tfjs-converter', '@tensorflow/tfjs-core'];
            if (id.startsWith('@mediapipe/') && !installedMediapipe.some(p => id === p || id.startsWith(p + '/'))) return true;
            if (id.startsWith('@tensorflow/') && !installedTfjs.some(p => id === p || id.startsWith(p + '/'))) return true;
            if (id.startsWith('firebase/')) return true;
            return false;
          },
          output: {
            manualChunks: {
              'human': ['@vladmandic/human'],
              'mediapipe': ['@mediapipe/selfie_segmentation'],
              'framer-motion': ['framer-motion'],
              'tensorflow': ['@tensorflow/tfjs-core', '@tensorflow/tfjs-converter', '@tensorflow/tfjs-backend-cpu', '@tensorflow/tfjs-backend-webgl'],
            },
          },
        },
      }
    };
});
