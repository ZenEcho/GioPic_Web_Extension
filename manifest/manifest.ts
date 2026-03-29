import fs from 'fs-extra'
import type PkgType from '../package.json'
import type { Manifest } from 'webextension-polyfill'
import { isDev, isFirefox, port, r } from '../manifest/utils'

export async function getManifest() {
    const pkg = await fs.readJson(r('package.json')) as typeof PkgType

    const manifest: Manifest.WebExtensionManifest = {
        manifest_version: 3,
        name: pkg.displayName || pkg.name,
        version: pkg.version,
        description: pkg.description,
        homepage_url: 'https://fileup.dev/',
        background: isFirefox ? {
            scripts: [
                'background.js',
            ],
            type: 'module',
        } : {
            service_worker: 'background.js',
            type: 'module',
        },
        content_scripts: [
            {
                matches: [
                    '<all_urls>',
                ],
                js: [
                    'content/content.js',
                ],
                run_at: 'document_end',
                all_frames: true,
            },
        ],
        web_accessible_resources: [
            {
                resources: [
                    '*.html',
                    '/src/sandbox/*.html',
                    '/src/sandbox/*.js',
                    '/assets/icons/*.png',
                    '*.css',
                    '*.js',
                    '/content/*.js',
                    '/content/*.css',
                ],
                matches: [
                    '<all_urls>',
                ],
            },
        ],
        action: {
            default_popup: '',
            default_icon: 'assets/icons/logo64.png',
        },
        icons: {
            '16': 'assets/icons/logo16.png',
            '32': 'assets/icons/logo32.png',
            '64': 'assets/icons/logo64.png',
            '128': 'assets/icons/logo128.png',
        },
        permissions: [
            'storage',
            'tabs',
            'contextMenus',
            'notifications',
            'cookies',
            'webRequest',
            ...(isFirefox ? [] : ['offscreen', 'declarativeNetRequest', 'sidePanel']),
        ],
        // @ts-ignore
        ...(isFirefox ? {} : {
            sandbox: {
                pages: ['src/sandbox/index.html', 'src/sandbox/site-detector.html'],
            },
        }),
        host_permissions: [
            '*://*/*',
        ],
        content_security_policy: {
            extension_pages: isDev
                ? `script-src 'self' http://localhost:${port}; object-src 'self'`
                : "script-src 'self'; object-src 'self'",
        },
    }

    if (isFirefox) {
        manifest.sidebar_action = {
            default_panel: 'index.html',
            default_icon: 'assets/icons/logo64.png',
            default_title: 'GioPic',
        }
        manifest.browser_specific_settings = {
            gecko: {
                id: 'giopic@fileup.dev',
                strict_min_version: '109.0',
            },
        }
    } else {
        // @ts-ignore
        manifest.side_panel = {
            default_path: 'index.html',
        }
    }

    return manifest
}
