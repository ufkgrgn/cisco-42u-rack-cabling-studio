/**
 * Cable Color Palette, Naming & Schedule (Metraj) Modals
 */
export function initCableModals(studio) {
    // 7. Cable Color Palette Bar
    const paletteBar = document.getElementById('cable-palette-bar');
    const paletteOptions = document.getElementById('cable-palette-options');
    const paletteTrigger = document.getElementById('btn-3d-colors');
    const activeColor = document.getElementById('active-3d-cable-color');
    if (paletteBar && paletteOptions && window.CABLE_COLORS_3D) {
      const selectedIdx = Number.isInteger(studio.state.cableColorIdx) ? studio.state.cableColorIdx : 0;
      const closePalette = () => {
        paletteOptions.hidden = true;
        paletteTrigger?.setAttribute('aria-expanded', 'false');
      };
      paletteTrigger?.addEventListener('click', () => {
        paletteOptions.hidden = !paletteOptions.hidden;
        paletteTrigger.setAttribute('aria-expanded', String(!paletteOptions.hidden));
      });
      document.addEventListener('pointerdown', event => {
        if (!paletteOptions.hidden && !paletteBar.contains(event.target)) closePalette();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !paletteOptions.hidden) {
          closePalette();
          paletteTrigger?.focus();
        }
      });
      window.CABLE_COLORS_3D.forEach((c, idx) => {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = 'palette-choice' + (idx === selectedIdx ? ' active' : '');
        const dot = document.createElement('span');
        dot.className = 'color-dot' + (idx === selectedIdx ? ' active' : '');
        dot.style.backgroundColor = c.css;
        const label = document.createElement('span');
        label.className = 'palette-choice-name';
        label.textContent = c.name;
        choice.title = c.name;
        choice.append(dot, label);
        choice.addEventListener('click', () => {
          paletteOptions.querySelectorAll('.palette-choice, .color-dot').forEach(d => d.classList.remove('active'));
          choice.classList.add('active');
          dot.classList.add('active');
          studio.state.cableColorIdx = idx;
          if (activeColor) activeColor.textContent = c.name;
          closePalette();
          studio.showToast(`Kablo rengi: ${c.name}`);
        });
        paletteOptions.appendChild(choice);
      });
      const selected = window.CABLE_COLORS_3D[studio.state.cableColorIdx] || window.CABLE_COLORS_3D[0];
      if (activeColor && selected) activeColor.textContent = selected.name;
    }

    // 8. CABLE EDIT & NAMING MODAL (User Priority #1)
    const cableEditModal = document.getElementById('modal-cable-edit');
    const btnCloseCableEdit = document.getElementById('btn-close-cable-edit');
    const btnCancelCableEdit = document.getElementById('btn-cancel-cable-edit');
    const btnSaveCableEdit = document.getElementById('btn-save-cable-edit');
    const btnDeleteCableModal = document.getElementById('btn-delete-cable-modal');
    const editCableNameInput = document.getElementById('edit-cable-name');
    const editCableNoteInput = document.getElementById('edit-cable-note');
    const editCablePalette = document.getElementById('edit-cable-palette');
    const editCableFromSpan = document.getElementById('edit-cable-from');
    const editCableToSpan = document.getElementById('edit-cable-to');
    const editCableLenSpan = document.getElementById('edit-cable-len');

    let activeEditCableId = null;
    let activeEditColorHex = null;

    window.openCableModal = function (cableId) {
      const cable = studio.state.cables.find(c => c.id === cableId);
      if (!cable || !cableEditModal) return;

      activeEditCableId = cableId;
      activeEditColorHex = cable.color;

      const devFrom = studio.state.devices.find(d => d.id === cable.from.devId);
      const devTo = studio.state.devices.find(d => d.id === cable.to.devId);

      editCableNameInput.value = cable.name || '';
      editCableNoteInput.value = cable.note || '';
      editCableFromSpan.textContent = `${devFrom ? devFrom.name : 'Bilinmeyen'} (Port #${cable.from.portIdx})`;
      editCableToSpan.textContent = `${devTo ? devTo.name : 'Bilinmeyen'} (Port #${cable.to.portIdx})`;
      editCableLenSpan.textContent = `${cable.lengthM} Metre`;

      // Render color choices
      if (editCablePalette && window.CABLE_COLORS_3D) {
        editCablePalette.innerHTML = '';
        window.CABLE_COLORS_3D.forEach((c) => {
          const dot = document.createElement('div');
          dot.className = 'color-dot' + (c.hex === cable.color ? ' active' : '');
          dot.style.backgroundColor = c.css;
          dot.title = c.name;
          dot.addEventListener('click', () => {
            editCablePalette.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            activeEditColorHex = c.hex;
          });
          editCablePalette.appendChild(dot);
        });
      }

      cableEditModal.style.display = 'flex';
      setTimeout(() => editCableNameInput.focus(), 50);
    };

    if (btnCloseCableEdit) btnCloseCableEdit.addEventListener('click', () => cableEditModal.style.display = 'none');
    if (btnCancelCableEdit) btnCancelCableEdit.addEventListener('click', () => cableEditModal.style.display = 'none');

    if (btnSaveCableEdit) {
      btnSaveCableEdit.addEventListener('click', () => {
        if (!activeEditCableId) return;
        const newName = editCableNameInput.value.trim();
        const newNote = editCableNoteInput.value.trim();
        studio.updateCable(activeEditCableId, {
          name: newName,
          note: newNote,
          color: activeEditColorHex
        });
        cableEditModal.style.display = 'none';
      });
    }

    if (btnDeleteCableModal) {
      btnDeleteCableModal.addEventListener('click', () => {
        if (!activeEditCableId) return;
        if (confirm('Bu kablo bağlantısını sökmek istediğinize emin misiniz?')) {
          studio.removeCable(activeEditCableId);
          cableEditModal.style.display = 'none';
          studio.showToast('Kablo söküldü.');
        }
      });
    }


    // 10. Cable Schedule (Metraj) Modal with Naming Column
    const btnSchedule = document.getElementById('btn-3d-schedule-modal');
    const scheduleModal = document.getElementById('modal-schedule');
    const btnCloseSchedule = document.getElementById('btn-close-schedule');
    const scheduleBody = document.getElementById('schedule-table-body');
    const btnExportCsv = document.getElementById('btn-export-csv');

    if (btnSchedule && scheduleModal) {
      btnSchedule.addEventListener('click', () => {
        if (scheduleBody) {
          scheduleBody.innerHTML = '';
          if (studio.state.cables.length === 0) {
            scheduleBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:16px;">Henüz kablo bağlantısı yapılmadı.</td></tr>';
          } else {
            studio.state.cables.forEach((c, idx) => {
              const dFrom = studio.state.devices.find(d => d.id === c.from.devId);
              const dTo = studio.state.devices.find(d => d.id === c.to.devId);
              const rFrom = (studio.state.racks || []).find(r => r.id === (c.from.rackId || (dFrom && dFrom.rackId))) || { name: 'MDF' };
              const rTo = (studio.state.racks || []).find(r => r.id === (c.to.rackId || (dTo && dTo.rackId))) || { name: 'MDF' };
              const tr = document.createElement('tr');
              tr.innerHTML = `
                <td>#${idx + 1}</td>
                <td><strong style="color:#38bdf8;cursor:pointer;" class="schedule-cable-name" title="İsmi düzenlemek için tıklayın">${c.name || 'İsimsiz Kablo'}</strong></td>
                <td><span style="font-size:10px;padding:1px 4px;border-radius:3px;background:rgba(2,132,199,0.2);color:#38bdf8;margin-right:4px;">${rFrom.name}</span><strong>${dFrom ? dFrom.name : 'Bilinmeyen'}</strong> (P${c.from.portIdx})</td>
                <td><span style="font-size:10px;padding:1px 4px;border-radius:3px;background:rgba(2,132,199,0.2);color:#38bdf8;margin-right:4px;">${rTo.name}</span><strong>${dTo ? dTo.name : 'Bilinmeyen'}</strong> (P${c.to.portIdx})</td>
                <td><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#${c.color.toString(16).padStart(6, '0')};margin-right:6px;vertical-align:middle;"></span>#${c.color.toString(16).padStart(6, '0')}</td>
                <td><strong>${c.lengthM} Metre</strong></td>
                <td>
                  <button class="hud-btn btn-edit-cbl" data-id="${c.id}">Düzenle</button>
                  <button class="hud-btn btn-del-cbl" data-id="${c.id}" style="padding:2px 6px;color:#ef4444;">Sök</button>
                </td>
              `;

              tr.querySelector('.schedule-cable-name').addEventListener('click', () => {
                scheduleModal.style.display = 'none';
                window.openCableModal(c.id);
              });

              tr.querySelector('.btn-edit-cbl').addEventListener('click', () => {
                scheduleModal.style.display = 'none';
                window.openCableModal(c.id);
              });

              tr.querySelector('.btn-del-cbl').addEventListener('click', () => {
                studio.removeCable(c.id);
                btnSchedule.click();
              });

              scheduleBody.appendChild(tr);
            });
          }
        }
        scheduleModal.style.display = 'flex';
      });

      if (btnCloseSchedule) btnCloseSchedule.addEventListener('click', () => scheduleModal.style.display = 'none');
      if (btnExportCsv) {
        btnExportCsv.addEventListener('click', () => {
          let csv = 'No,Kablo Adı / Etiketi,Kaynak Cihaz,Kaynak Port,Hedef Cihaz,Hedef Port,Kablo Renk,Uzunluk (Metre),Açıklama\n';
          studio.state.cables.forEach((c, idx) => {
            const dFrom = studio.state.devices.find(d => d.id === c.from.devId);
            const dTo = studio.state.devices.find(d => d.id === c.to.devId);
            csv += `${idx + 1},"${c.name || ''}","${dFrom ? dFrom.name : ''}",${c.from.portIdx},"${dTo ? dTo.name : ''}",${c.to.portIdx},#${c.color.toString(16)},${c.lengthM},"${c.note || ''}"\n`;
          });
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'kabin-kablo-metraj-cizelgesi.csv';
          a.click();
          URL.revokeObjectURL(url);
          studio.showToast('CSV Metraj Raporu İndirildi.');
        });
      }
    }

}
