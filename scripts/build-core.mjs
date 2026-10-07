// Собирает core/ (TypeScript) в один файл electron/core.js для главного процесса.
import { build } from 'esbuild';

await build({
    entryPoints: ['core/index.ts'],
    outfile: 'electron/core.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap: 'inline',
    // Нативные и Electron-модули не упаковываем
    external: ['electron', 'keytar'],
    // ESM-бандл с CommonJS-зависимостями (qrcode, tough-cookie) нуждается в require
    banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
    logLevel: 'info',
});
