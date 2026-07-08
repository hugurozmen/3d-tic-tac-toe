import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isThreeVendor = (moduleId: string) => {
  const id = moduleId.replace(/\\/g, '/');

  return [
    '/node_modules/@dimforge/',
    '/node_modules/@react-three/',
    '/node_modules/@tweenjs/',
    '/node_modules/@use-gesture/',
    '/node_modules/camera-controls/',
    '/node_modules/detect-gpu/',
    '/node_modules/hls.js/',
    '/node_modules/its-fine/',
    '/node_modules/maath/',
    '/node_modules/meshline/',
    '/node_modules/stats-gl/',
    '/node_modules/suspend-react/',
    '/node_modules/three/',
    '/node_modules/three-stdlib/',
    '/node_modules/troika-',
  ].some((needle) => id.includes(needle));
};

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              maxSize: 420 * 1024,
              name: 'three-vendor',
              priority: 2,
              test: isThreeVendor,
            },
          ],
        },
      },
    },
  },
  plugins: [react()],
});
