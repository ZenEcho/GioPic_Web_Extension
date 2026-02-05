/**
 * @file index.ts
 * @description 页面注入脚本 (Page Script) 入口
 * 
 * 职责：
 * 1. 运行在页面上下文 (Page Context) 中，可以访问页面全局变量 (如 window.editor, window.tinymce 等)
 * 2. 启动编辑器检测器，监听来自 Content Script 的图片注入请求
 * 3. 防止脚本重复加载
 */

import { Detector } from './EditorInjector'

declare global {
  interface Window {
    __GioPicPageScriptLoaded__?: boolean
  }
}

if (!window.__GioPicPageScriptLoaded__) {
  window.__GioPicPageScriptLoaded__ = true
  
  // 启动编辑器注入监听
  Detector.startListening()
}
