(function() {
  var container = document.querySelector('[data-tastas-jobs]');
  if (!container) return;

  // LP番号をmetaタグから取得
  var lpMeta = document.querySelector('meta[name="lp-number"]');
  var lpNumber = lpMeta ? lpMeta.getAttribute('content') : '';

  var iframe = document.createElement('iframe');
  iframe.src = '/lp/jobs-widget' + (lpNumber ? '?lp=' + lpNumber : '');
  iframe.style.cssText = 'width:100%;border:none;min-height:400px;overflow:hidden;';
  iframe.setAttribute('scrolling', 'no');

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'tastas-jobs-resize') {
      iframe.style.height = e.data.height + 'px';
    }
  });

  container.appendChild(iframe);
})();
