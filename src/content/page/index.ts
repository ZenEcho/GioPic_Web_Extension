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
  
  console.log('GioPic page script loaded (Main World)')
}
