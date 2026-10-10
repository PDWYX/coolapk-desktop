/*
 * iOS 13 启动诊断（临时排查件，定位完成后应连同 index.html 的引用一起删除）。
 *
 * 目的：把真机上的「白屏」变成屏幕上看得见的错误文本。
 *
 * 为什么是独立的同源脚本，而不是 index.html 里的内联脚本：
 * src-tauri/tauri.conf.json 的 CSP 是
 *   script-src 'self' https://cstaticdun.126.net https://*.dun.163.com https://*.163yun.com
 * 没有 'unsafe-inline'，内联脚本会被 WKWebView 直接拦掉。
 *
 * 为什么不是 module：module 是延迟执行，而且一旦入口模块图在解析阶段就
 * 失败，module 里注册的任何处理器都不会有机会运行。这里用普通同步脚本，
 * 在 src/main.ts 之前加载并完成注册。
 *
 * 正常启动时它什么都不做：只有真的捕获到错误，或者 #app 迟迟没有挂载，
 * 才会画出浮层。浮层点一下即可关闭。
 */
(function () {
  'use strict';

  var OVERLAY_ID = '__boot_diagnostics__';
  var MOUNT_DEADLINE_MS = 10000;
  var messages = [];
  var overlay = null;

  function describe(value) {
    try {
      if (!value) return '（没有可用的错误对象）';
      if (value.stack) return String(value.stack);
      if (value.message) return String(value.name || 'Error') + ': ' + String(value.message);
      return String(value);
    } catch (err) {
      return '（无法序列化错误对象）';
    }
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    if (!document.body) return null;
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute(
      'style',
      'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;' +
        'background:#111;color:#ff9a9a;font:12px/1.6 ui-monospace,Menlo,monospace;' +
        'padding:16px;overflow:auto;-webkit-overflow-scrolling:touch;' +
        'white-space:pre-wrap;word-break:break-all;'
    );
    overlay.addEventListener('click', function () {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function paint() {
    try {
      if (!messages.length) return;
      var box = ensureOverlay();
      if (!box) return;
      box.textContent = '酷安 iOS 启动诊断（点击关闭）\n\n' + messages.join('\n\n');
    } catch (err) {
      /* 诊断代码本身绝不能再抛异常 */
    }
  }

  function report(label, detail) {
    messages.push('【' + label + '】\n' + detail);
    paint();
  }

  window.addEventListener(
    'error',
    function (event) {
      var target = event && event.target;
      if (target && target !== window && (target.src || target.href)) {
        report('资源加载失败', String(target.src || target.href));
        return;
      }
      if (!event) {
        report('脚本错误', '（没有事件对象）');
        return;
      }
      var detail = describe(event.error || event.message);
      if (event.filename) {
        detail += '\n  ' + event.filename + ':' + event.lineno + ':' + event.colno;
      }
      report('脚本错误', detail);
    },
    true
  );

  window.addEventListener('unhandledrejection', function (event) {
    report('未处理的 Promise 拒绝', describe(event && event.reason));
  });

  function onReady() {
    window.setTimeout(function () {
      try {
        var app = document.getElementById('app');
        if (app && app.childNodes.length === 0) {
          report(
            '应用未挂载',
            '进入页面 ' +
              MOUNT_DEADLINE_MS / 1000 +
              ' 秒后 #app 仍然是空的，说明 main.ts 的 bootstrap() 没有执行到 app.mount()。'
          );
        }
      } catch (err) {
        /* 忽略 */
      }
    }, MOUNT_DEADLINE_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
