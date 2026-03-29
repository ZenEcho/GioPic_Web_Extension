import type {
  DetectorActionFieldSchema,
  PluginMeta,
  SiteDetectorMatchRule,
  SiteDetectorPlugin,
  SiteDetectorPresentation,
} from '@/types'
import { BUILTIN_EDITOR_ADAPTER_PLUGINS } from '@/content/page/EditorInjector/pluginRuntime'

export const BUNDLED_PLUGIN_MIGRATION_KEY = 'giopic-bundled-plugins-v3'

type BundledSiteDetectorDefinition = Omit<SiteDetectorPlugin, 'detector'> & {
  targetDriveType: string
  match?: SiteDetectorMatchRule
  presentation?: SiteDetectorPresentation
  priority?: number
  actionForm?: DetectorActionFieldSchema[]
  detectScript: string
  extractScript: string
}

// Keep the commented bundled detector examples compatible with the current detector.* runtime shape.
function defineBundledSiteDetector(plugin: BundledSiteDetectorDefinition): SiteDetectorPlugin {
  const {
    targetDriveType,
    match,
    presentation,
    priority,
    actionForm,
    detectScript,
    extractScript,
    ...base
  } = plugin

  return {
    ...base,
    kind: 'site-detector',
    detector: {
      targetDriveType,
      match,
      presentation,
      priority,
      actionForm,
      detectScript,
      extractScript,
    },
  }
}

export const BUNDLED_PLUGINS: PluginMeta[] = [
  ...BUILTIN_EDITOR_ADAPTER_PLUGINS,
    defineBundledSiteDetector({
      id: 'builtin.site-detector.lsky',
      kind: 'site-detector',
      name: 'Lsky Site Detector',
      version: '1.0.0',
      author: 'GioPic',
      description: 'Detects Lsky token pages and creates GioPic configs without shipping new extension code.',
      icon: 'i-ph-cloud-arrow-up-duotone',
      priority: 120,
      targetDriveType: 'lsky',
      match: {
        pathnameEquals: ['/user/tokens'],
      },
      presentation: {
        title: '发现 Lsky 图床配置页',
        description: '支持 Lsky v1 / v2。优先尝试直接读取 Token，失败时会回退到受控授权获取。',
        actionText: '一键添加到 GioPic',
        ignoreText: '本站不再提示',
        successText: 'Lsky 配置已添加到 GioPic',
        failureText: 'Lsky 配置提取失败，请先在当前页面完成创建 Token 操作后重试。',
      },
      detectScript: String.raw`return async function(ctx) {
    if (ctx.page.pathname !== '/user/tokens') {
      return { matched: false };
    }

    await ctx.waitForSelector('#token-create, #lskyv2_giopic, .n-card__content .n-button__content', 2200);

    if (await ctx.exists('#token-create')) {
      return { matched: true, score: 40, data: { version: 'v1' } };
    }

    const buttonText = ((await ctx.text('.n-card__content .n-button__content')) || '').trim();
    const hasThemeMarker = await ctx.exists('#lskyv2_giopic');
    if (buttonText === '创建令牌' || hasThemeMarker) {
      return { matched: true, score: 50, data: { version: 'v2' } };
    }

    return { matched: false };
  }`,
      extractScript: String.raw`return async function(ctx, form, state) {
    const version = state && state.version === 'v2' ? 'v2' : 'v1';
    const directTokenNode = await ctx.query('#token-create-success p:nth-child(2)');
    const directToken = (directTokenNode && (directTokenNode.textContent || directTokenNode.value || '')) || '';
    if (directToken.trim()) {
      return {
        config: {
          apiUrl: ctx.page.origin,
          token: directToken.trim(),
          version: version,
          permission: '0'
        }
      };
    }

    const authResponse = await ctx.sendMessage('GET_AUTH_STATE');
    const auth = authResponse && authResponse.data ? authResponse.data : authResponse;
    const xsrfToken = auth && auth.XSRF_TOKEN ? auth.XSRF_TOKEN : '';
    const authorization = auth && auth.Authorization ? auth.Authorization : '';

    if (!xsrfToken && !authorization) {
      throw new Error('未获取到授权信息，请在当前页面先执行一次创建 Token 操作后重试。');
    }

    const endpoint = version === 'v2' ? '/api/v2/user/tokens' : '/user/tokens';
    const payload = version === 'v2'
      ? {
          name: 'GioPic',
          abilities: [
            'upload:write',
            'basic',
            'user:profile:read',
            'user:token:read',
            'user:capacity:read',
            'user:group:read',
            'user:album:read'
          ]
        }
      : {
          name: 'GioPic',
          abilities: [
            'user:profile',
            'image:tokens',
            'image:upload',
            'image:list',
            'image:delete',
            'album:list',
            'album:delete',
            'strategy:list'
          ]
        };

    const headers = {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken;
    }
    if (authorization) {
      headers.Authorization = authorization;
    }

    const response = await ctx.fetchJson(ctx.page.origin + endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(payload)
    });

    const createdToken = response && response.data && response.data.token ? response.data.token : '';
    if (!createdToken) {
      throw new Error((response && (response.message || response.msg)) || '创建 Token 失败');
    }

    return {
      config: {
        apiUrl: ctx.page.origin,
        token: String(createdToken),
        version: version,
        permission: '0'
      }
    };
  }`,
    }),
    defineBundledSiteDetector({
      id: 'builtin.site-detector.lsky-open',
      kind: 'site-detector',
      name: 'Lsky Open Site Detector',
      version: '1.0.0',
      author: 'GioPic',
      description: 'Detects Lsky Open dashboards and logs in through a generic detector action form.',
      icon: 'i-ph-sign-in-duotone',
      priority: 100,
      targetDriveType: 'lsky',
      match: {
        pathnameEquals: ['/dashboard'],
      },
      presentation: {
        title: '发现 Lsky Open 管理台',
        description: '填写当前站点的管理员邮箱和密码后，即可由 detector 插件自动换取上传 Token。',
        actionText: '登录并添加到 GioPic',
        ignoreText: '本站不再提示',
        successText: 'Lsky Open 配置已添加到 GioPic',
        failureText: 'Lsky Open 配置提取失败，请检查邮箱、密码或站点接口是否可用。',
      },
      actionForm: [
        {
          name: 'email',
          label: '邮箱',
          type: 'text',
          required: true,
          placeholder: 'admin@example.com',
        },
        {
          name: 'password',
          label: '密码',
          type: 'password',
          required: true,
        },
      ],
      detectScript: String.raw`return async function(ctx) {
    if (ctx.page.pathname !== '/dashboard') {
      return { matched: false };
    }

    if (!(await ctx.exists('#capacity-progress'))) {
      return { matched: false };
    }

    const bodyText = (await ctx.text('body')) || '';
    if (bodyText.includes('仪表盘') && bodyText.includes('上传图片') && bodyText.includes('画廊') && bodyText.includes('接口')) {
      return { matched: true, score: 35 };
    }

    return { matched: false };
  }`,
      extractScript: String.raw`return async function(ctx, form) {
    const email = String((form && form.email) || '').trim();
    const password = String((form && form.password) || '').trim();
    if (!email || !password) {
      throw new Error('请输入邮箱和密码');
    }

    const payload = new FormData();
    payload.append('email', email);
    payload.append('password', password);

    const response = await ctx.fetchJson(ctx.page.origin + '/api/v1/tokens', {
      method: 'POST',
      headers: {
        Accept: 'application/json'
      },
      body: payload
    });

    const token = response && response.data && response.data.token ? response.data.token : '';
    if (!token) {
      throw new Error((response && (response.message || response.msg)) || '登录失败');
    }

    return {
      config: {
        apiUrl: ctx.page.origin,
        token: String(token),
        version: 'v1',
        permission: '0'
      }
    };
  }`,
    }),
    defineBundledSiteDetector({
      id: 'builtin.site-detector.easyimages',
      kind: 'site-detector',
      name: 'EasyImages Site Detector',
      version: '1.0.0',
      author: 'GioPic',
      description: 'Detects EasyImages admin pages and generates a temporary upload token automatically.',
      icon: 'i-ph-images-square-duotone',
      priority: 90,
      targetDriveType: 'easyimages',
      match: {
        pathnameEquals: ['/admin/admin.inc.php'],
      },
      presentation: {
        title: '发现 EasyImages 后台',
        description: '点击后一键生成上传 Token，并把当前站点保存为 GioPic 的 EasyImages 配置。',
        actionText: '生成 Token 并添加',
        ignoreText: '本站不再提示',
        successText: 'EasyImages 配置已添加到 GioPic',
        failureText: 'EasyImages Token 生成失败，请确认当前账号拥有后台管理权限。',
      },
      detectScript: String.raw`return async function(ctx) {
    if (ctx.page.pathname !== '/admin/admin.inc.php') {
      return { matched: false };
    }

    console.log('[easyimages] evaluating', ctx.page.url);

    const title = (await ctx.text('title')) || '';
    const author = await ctx.attr('meta[name="author"]', 'content');
    const hasEasyImagesLink = await ctx.exists('a[href="https://png.cm/"]');
    const hasGithubLink = await ctx.exists('a[href="https://github.com/icret/EasyImages2.0"]');
    const hasGrid = await ctx.exists('#myDataGrid');
    const loginHint = (await ctx.text('.navbar-nav.navbar-right')) || (await ctx.text('body')) || '';
    const looksLikeEasyImages = title.includes('EasyImage') || String(author || '').includes('EasyImage2.0') || (hasEasyImagesLink && hasGithubLink);

    if (!looksLikeEasyImages) {
      return { matched: false };
    }

    if (hasGrid) {
      return { matched: true, score: 30, data: { loggedIn: true } };
    }

    if (loginHint.includes('请使用管理员账户登录') || loginHint.includes('登录')) {
      return {
        matched: true,
        score: 10,
        data: { loggedIn: false },
        presentation: {
          description: '当前页面已识别为 EasyImages 后台，但还没有管理员登录态。请先登录后台，再点击一键添加。',
          failureText: '当前页面还没有管理员登录态，请先登录 EasyImages 后台。'
        }
      };
    }

    return { matched: true, score: 12, data: { loggedIn: false } };
  }`,
      extractScript: String.raw`return async function(ctx, form, state) {
    if (state && state.loggedIn === false) {
      throw new Error('当前页面还没有管理员登录态，请先登录 EasyImages 后台。');
    }

    const token = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID().replace(/-/g, '')
      : (Date.now().toString(36) + Math.random().toString(36).slice(2));

    const payload = new URLSearchParams();
    payload.append('add_token', token);
    payload.append('add_token_expired', '1314');
    payload.append('add_token_id', Date.now().toString());

    const response = await ctx.fetch(ctx.page.url, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: payload
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    return {
      config: {
        apiUrl: ctx.page.origin,
        token: token
      }
    };
  }`,
    }),
    defineBundledSiteDetector({
      id: 'builtin.site-detector.chevereto',
      kind: 'site-detector',
      name: 'Chevereto Site Detector',
      version: '1.0.0',
      author: 'GioPic',
      description: 'Detects Chevereto admin pages and reads the generated API key from a controlled DOM snapshot.',
      icon: 'i-ph-key-duotone',
      priority: 80,
      targetDriveType: 'chevereto',
      presentation: {
        title: '发现 Chevereto 图床',
        description: '如果当前页面已经展示 API v1 key，点击后会直接保存为 GioPic 的 Chevereto 配置。',
        actionText: '读取 Key 并添加',
        ignoreText: '本站不再提示',
        successText: 'Chevereto 配置已添加到 GioPic',
        failureText: '未在当前页面读取到 API key，请先在后台生成或重新生成 API key。',
      },
      detectScript: String.raw`return async function(ctx) {
    if (await ctx.exists('meta[name="generator"][content^="Chevereto"]')) {
      return { matched: true, score: 20 };
    }

    return { matched: false };
  }`,
      extractScript: String.raw`return async function(ctx) {
    const input = await ctx.query('#api_v1_key');
    const apiKey = input && (input.value || (input.attributes && input.attributes.value) || '');
    if (!apiKey) {
      throw new Error('未读取到 API key');
    }

    return {
      config: {
        apiUrl: ctx.page.origin,
        token: apiKey,
        expiration: 'NONE',
        nsfw: '0'
      }
    };
  }`,
    }),
    defineBundledSiteDetector({
      id: 'builtin.site-detector.16best',
      kind: 'site-detector',
      name: '16best Site Detector',
      version: '1.0.0',
      author: 'GioPic',
      description: 'Detects 16best and builds a custom uploader config from the site local token store.',
      icon: 'i-ph-hard-drives-duotone',
      priority: 70,
      targetDriveType: 'custom',
      match: {
        domains: ['111666.best'],
      },
      presentation: {
        title: '发现 16best 图床',
        description: '点击后会读取当前站点本地存储中的 16best Token，并自动生成 GioPic 自定义图床配置。',
        actionText: '读取 Token 并添加',
        ignoreText: '本站不再提示',
        successText: '16best 配置已添加到 GioPic',
        failureText: '未读取到 16best Token，请先在当前站点完成登录。',
      },
      detectScript: String.raw`return async function(ctx) {
    if (ctx.page.hostname !== '111666.best') {
      return { matched: false };
    }

    return { matched: true, score: 18 };
  }`,
      extractScript: String.raw`return async function(ctx) {
    const records = await ctx.readExternalStore('image-hosting', 'config');
    const tokenItem = Array.isArray(records)
      ? records.find(item => item && item.key === 'token')
      : null;
    const token = tokenItem && tokenItem.value ? String(tokenItem.value).trim() : '';

    if (!token) {
      throw new Error('未读取到 16best Token，请先在当前站点完成登录。');
    }

    return {
      config: {
        apiUrl: 'https://i.111666.best/image',
        method: 'POST',
        uploadFormat: 'formData',
        fileParamName: 'image',
        headers: JSON.stringify({ 'Auth-Token': token }),
        responseUrlPath: 'src',
        urlPrefix: 'https://i.111666.best'
      }
    };
  }`,
    }),
    defineBundledSiteDetector({
      id: 'builtin.site-detector.cloudflare-imgbed',
      kind: 'site-detector',
      name: 'CloudFlare ImgBed Site Detector',
      version: '1.0.0',
      author: 'GioPic',
      description: 'Detects the CloudFlare-ImgBed open source project and creates a matching custom uploader config.',
      icon: 'i-ph-cloud-sun-duotone',
      priority: 55,
      targetDriveType: 'custom',
      presentation: {
        title: '发现 CloudFlare ImgBed',
        description: '点击后会为当前站点生成 CloudFlare-ImgBed 兼容的 GioPic 自定义图床配置。',
        actionText: '添加自定义配置',
        ignoreText: '本站不再提示',
        successText: 'CloudFlare ImgBed 配置已添加到 GioPic',
        failureText: 'CloudFlare ImgBed 配置生成失败。',
      },
      detectScript: String.raw`return async function(ctx) {
    const target = 'https://github.com/MarSeventh/CloudFlare-ImgBed';
    const matched = await ctx.exists('.header h1 .main-title[href="' + target + '"]');
    if (!matched) {
      return { matched: false };
    }

    return { matched: true, score: 16 };
  }`,
      extractScript: String.raw`return async function(ctx) {
    return {
      config: {
        apiUrl: ctx.page.origin + '/upload',
        method: 'POST',
        uploadFormat: 'formData',
        fileParamName: 'file',
        responseUrlPath: '[0].src',
        urlPrefix: ctx.page.origin
      }
    };
  }`,
    }),
    defineBundledSiteDetector({
      id: 'builtin.site-detector.telegraph-image',
      kind: 'site-detector',
      name: 'Telegraph Image Site Detector',
      version: '1.0.0',
      author: 'GioPic',
      description: 'Detects the Telegraph-Image project and creates a matching custom uploader config.',
      icon: 'i-ph-paper-plane-tilt-duotone',
      priority: 50,
      targetDriveType: 'custom',
      presentation: {
        title: '发现 Telegraph Image',
        description: '点击后会为当前站点生成 Telegraph-Image 兼容的 GioPic 自定义图床配置。',
        actionText: '添加自定义配置',
        ignoreText: '本站不再提示',
        successText: 'Telegraph Image 配置已添加到 GioPic',
        failureText: 'Telegraph Image 配置生成失败。',
      },
      detectScript: String.raw`return async function(ctx) {
    const target = 'https://github.com/cf-pages/Telegraph-Image';
    const matched = await ctx.exists('.footer a[href="' + target + '"]');
    if (!matched) {
      return { matched: false };
    }

    return { matched: true, score: 14 };
  }`,
      extractScript: String.raw`return async function(ctx) {
    return {
      config: {
        apiUrl: ctx.page.origin + '/upload',
        method: 'POST',
        uploadFormat: 'formData',
        fileParamName: 'file',
        responseUrlPath: '[0].src',
        urlPrefix: ctx.page.origin
      }
    };
  }`,
    })
]
