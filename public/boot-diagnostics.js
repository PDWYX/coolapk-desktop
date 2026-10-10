/*
 * iOS 13 启动诊断（临时排查件，定位完成后应连同 index.html 的引用一起删除）。
 *
 * 目的：把真机上的「白屏」变成屏幕上看得见的文字，而不是只依赖日志文件。
 * 之所以必须自己画到屏幕上：真机上出现过「日志写到一半就再无任何输出」的情况，
 * 那种情况下日志本身已经不可信，只有屏幕上还在动的东西能说明 JS 主线程是否还活着。
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
 * 三段证据：
 *   1. index.html 里静态写在 body 里的黄条 —— 不需要任何 JS，证明 HTML/CSS 渲染正常；
 *   2. 本脚本把它改成 BD t=..s tick=.. —— 证明经典脚本执行了、且主线程还在跑；
 *   3. tick 每秒 +1，一旦停住就说明主线程被卡死（这时白屏不是渲染问题）。
 * last= 后面是 src/main.ts 用 window.__bootSteps 记下的最后一步。
 * 正常启动时除了这根黄条没有别的干扰，定位完成后整体删除。
 */
(function () {
  'use strict';

  var BANNER_ID = '__boot_probe__';
  var OVERLAY_ID = '__boot_diagnostics__';
  var MOUNT_DEADLINE_MS = 10000;
  var startedAt = Date.now();
  var messages = [];
  var overlay = null;
  var tick = 0;

  if (!window.__bootSteps) window.__bootSteps = [];

  function banner() {
    var el = document.getElementById(BANNER_ID);
    if (el) return el;
    var host = document.body || document.documentElement;
    if (!host) return null;
    el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute(
      'style',
      'position:fixed;left:0;top:0;right:0;z-index:2147483647;background:#ffd400;color:#000;border-bottom:2px solid #000;' +
        'font:12px/1.35 ui-monospace,Menlo,monospace;padding:3px 6px;white-space:pre-wrap;' +
        'pointer-events:none;-webkit-user-select:none;'
    );
    host.appendChild(el);
    return el;
  }

  function appChildren() {
    var app = document.getElementById('app');
    return app ? app.childNodes.length : -1;
  }

  // 这个函数每秒被调用一次。它一旦不再更新，就说明主线程死了；
  // 它更新到的最后一格数字，就是主线程死掉的时刻。
  function refresh() {
    try {
      var el = banner();
      if (!el) return;
      var steps = window.__bootSteps || [];
      tick += 1;
      var text =
        '[BD t=' + Math.round((Date.now() - startedAt) / 1000) + 's' +
        ' tick=' + tick +
        ' ' + document.readyState +
        ' vis=' + document.visibilityState +
        ' #app=' + appChildren() +
        ' steps=' + steps.length +
        ' last=' + (steps.length ? steps[steps.length - 1] : 'none') +
        ' err=' + messages.length + ']';
      var shown = messages.slice(0, 3);
      for (var i = 0; i < shown.length; i += 1) {
        text += '\n<<' + shown[i].replace(/\s+/g, ' ').slice(0, 220);
      }
      el.textContent = text;
      // 浮层万一因为任何原因没建起来（真机上出现过），每秒都补一次，
      // 免得唯一的错误原文只剩黄条里那 220 字。
      if (messages.length && !overlay) paint();
    } catch (err) {
      /* 诊断代码本身绝不能再抛异常 */
    }
  }

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
        'padding:16px;padding-top:28px;overflow:auto;-webkit-overflow-scrolling:touch;' +
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
      var steps = window.__bootSteps || [];
      box.textContent =
        '酷安 iOS 启动诊断（点击关闭）\n\n' +
        '启动步骤：' + (steps.length ? steps.join(' > ') : '（main.ts 一步都没走到）') + '\n' +
        '#app 子节点数：' + appChildren() + '\n\n' +
        messages.join('\n\n');
    } catch (err) {
      /* 诊断代码本身绝不能再抛异常 */
    }
  }

  function report(label, detail) {
    messages.push('【' + label + '】\n' + detail);
    refresh();
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
          var steps = window.__bootSteps || [];
          report(
            '应用未挂载',
            '进入页面 ' +
              MOUNT_DEADLINE_MS / 1000 +
              ' 秒后 #app 仍然是空的。main.ts 记录到的启动步骤：' +
              (steps.length ? steps.join(' > ') : '（一步都没走到，说明模块顶层在很早期就中断了）')
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

  // 立刻先画一次（经典脚本是同步执行的，这一步能证明脚本确实跑起来了），
  // 之后每秒刷新一次。
  refresh();
  window.setInterval(refresh, 1000);
})();
