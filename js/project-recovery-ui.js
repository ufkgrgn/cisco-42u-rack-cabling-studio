(function () {
  'use strict';
  const RS = window.RackStudio;
  function download(text, filename) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function shell(title) {
    const dialog = document.createElement('dialog');
    dialog.className = 'project-recovery-dialog';
    dialog.classList.add('product-dialog');
    const heading = document.createElement('h2'); heading.textContent = title;
    heading.id = 'project-dialog-' + crypto.randomUUID();
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.append(heading); document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    return dialog;
  }
  function button(label, action) {
    const element = document.createElement('button');
    element.type = 'button'; element.textContent = label;
    element.className = 'recovery-action';
    element.addEventListener('click', action);
    return element;
  }
  function choose(candidates) {
    return new Promise(resolve => {
      const dialog = shell('Kurtarılacak kaydı seçin');
      const message = document.createElement('p');
      message.textContent = 'Farklı proje kayıtları bulundu. Kaynakların orijinalleri korunur; seçiminiz açık çalışmanın yerine yüklenir.';
      dialog.append(message);
      for (const candidate of candidates) {
        const row = document.createElement('section');
        const info = document.createElement('p');
        info.textContent = candidate.document ? `${candidate.source} · ${candidate.document.metadata.name || 'Adsız proje'} · revizyon ${candidate.document.revision}` : `${candidate.source} · okunamadı: ${candidate.error}`;
        row.append(info);
        if (candidate.document) row.append(button('Bu kaydı aç', () => { resolve(candidate); dialog.close(); }));
        if (candidate.raw) row.append(button('Orijinali indir', () => download(candidate.raw, 'kurtarma-orijinal.json')));
        dialog.append(row);
      }
      dialog.append(button('Kayıt seçmeden çalışmaya dön', () => dialog.close()));
      dialog.addEventListener('cancel', () => resolve(null));
      dialog.addEventListener('close', () => resolve(null));
      dialog.showModal();
    });
  }
  async function library(options = {}) {
    if (!options.legacy && RS.ProjectManager) return RS.ProjectManager.open();
    const dialog = shell('Yerel proje kayıtları');
    const status = document.createElement('p'); status.setAttribute('role', 'status'); dialog.append(status);
    const run = action => async () => {
      try { status.textContent = 'İşlem sürüyor…'; await action(); status.textContent = 'İşlem tamamlandı'; }
      catch (error) { status.textContent = error.message; }
    };
    const list = document.createElement('div'); dialog.append(list);
    const refresh = async () => {
      list.replaceChildren();
      for (const project of await RS.ProjectRepository.list()) {
        const row = document.createElement('section'), name = document.createElement('p');
        name.textContent = `${project.name} · revizyon ${project.revision}${project.archived ? ' · arşiv' : ''}`;
        row.append(name, button('Aç', run(async () => { await RS.openStoredProject(project.projectId); dialog.close(); })));
        row.append(button('Taslağı sakla, bu kaydı aç', run(async () => { await RS.openStoredProject(project.projectId, { preserveDraft: true }); dialog.close(); })));
        row.append(button(project.archived ? 'Arşivden çıkar' : 'Arşivle', run(async () => {
          if (!project.archived) await RS.saveProjectNow();
          await RS.ProjectRepository.archive(project.projectId, !project.archived); await refresh();
        })));
        list.append(row);
      }
    };
    dialog.append(button('Tam dış yedek indir', run(async () => {
      await RS.saveProjectNow();
      download(await RS.ProjectArchive.exportArchive(), 'rack-studio-tam-yedek.json');
    })));
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.json'; file.setAttribute('aria-label', 'Tam dış yedek dosyası');
    file.addEventListener('change', run(async () => {
      const selected = file.files[0]; if (!selected) return;
      if (selected.size > RS.ProjectArchive.LIMIT) throw new Error('Dış yedek 128 MB sınırını aşıyor.');
      await RS.ProjectArchive.importArchive(await selected.text()); await refresh();
    }));
    dialog.append(file, button('Kapat', () => dialog.close()));
    dialog.append(button('Kurtarma orijinallerini göster', run(async () => {
      const originals = document.createElement('section');
      for (const entry of await RS.ProjectRepository.listRecovery()) {
        const label = document.createElement('p'); label.textContent = entry.value.source;
        originals.append(label, button('Orijinali indir', () => download(entry.value.raw, 'kurtarma-orijinal.json')));
      }
      dialog.append(originals);
    })));
    dialog.showModal();
    await run(refresh)();
  }
  RS.ProjectRecoveryUI = Object.freeze({ choose, library });
  function install() {
    const sibling = document.getElementById('btn-snapshot-modal');
    if (sibling) {
      const element = button('Proje kayıtları ve yedek', library);
      element.id = 'btn-project-records'; element.className = 'hud-btn'; element.style.cssText = '';
      sibling.insertAdjacentElement('afterend', element);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
