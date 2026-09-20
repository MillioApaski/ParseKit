'use strict';
// File I/O stays inside the user's browser. No remote requests or storage.
const FILE_LIMIT = 8 * 1024 * 1024;
function fileTarget(target) {
  const name = target === input ? '输入' : target === $('diff-left') ? '旧数据' : '新数据';
  return name;
}
async function readLocalFile(file, target) {
  if (!file) return;
  if (file.size > FILE_LIMIT) {
    setStatus('文件过大：单个文件上限为 8 MiB，未导入 ' + file.name, true);
    return;
  }
  try {
    const text = (await file.text()).replace(/^\uFEFF/, '');
    target.value = text;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    setStatus('已导入 ' + file.name + ' → ' + fileTarget(target) + '（仅本地读取）');
    target.focus();
  } catch (error) {
    setStatus('文件读取失败：' + error.message, true);
  }
}
function selectLocalFile(target) {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.json,.xml,.txt,.log,application/json,application/xml,text/xml,text/plain';
  picker.hidden = true;
  document.body.append(picker);
  picker.addEventListener('change', async () => {
    try { await readLocalFile(picker.files?.[0], target); }
    finally { picker.remove(); }
  }, { once: true });
  picker.click();
}
function downloadResult() {
  const text = output.value;
  if (!text) { setStatus('没有可以下载的输出结果', true); return; }
  const kind = typeOf(text);
  const extension = kind === 'xml' ? 'xml' : 'json';
  const mime = kind === 'xml' ? 'application/xml;charset=utf-8' : 'application/json;charset=utf-8';
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'parsekit-result.' + extension;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  setStatus('已下载 ' + anchor.download);
}
$('import-input').addEventListener('click', () => selectLocalFile(input));
$('import-left').addEventListener('click', () => selectLocalFile($('diff-left')));
$('import-right').addEventListener('click', () => selectLocalFile($('diff-right')));
$('download-output').addEventListener('click', downloadResult);
for (const id of ['input', 'diff-left', 'diff-right']) {
  const target = $(id);
  const surface = target.closest('.pane');
  surface.addEventListener('dragover', event => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    surface.classList.add('drop-target');
  });
  surface.addEventListener('dragleave', event => {
    if (!surface.contains(event.relatedTarget)) surface.classList.remove('drop-target');
  });
  surface.addEventListener('drop', event => {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    surface.classList.remove('drop-target');
    readLocalFile(event.dataTransfer.files[0], target);
  });
}
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !$('format-workspace').hidden) {
    event.preventDefault();
    downloadResult();
  }
});
