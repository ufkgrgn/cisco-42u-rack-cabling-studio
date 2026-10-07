(function () {
  'use strict';
  const RS=window.RackStudio, labels={design:'Tasarım',field:'Saha',presentation:'Sunum'};
  let current='design', beforeField=null;
  function updateStatus(){const status=document.getElementById('workflow-status');if(!status)return;status.hidden=current==='design';status.textContent=(current==='field'?'Saha · Plan ve gözlemler ayrı.':'Sunum · Düzenlemek için Tasarıma dönün.')+' · '+(document.getElementById('studio-save')?.textContent||'');}
  const editing='#preset-btn-group,#tools-2d-only .tools-slider-row,#rack-u-slider,#btn-2d-clear-action,#btn-hud-dismount,#btn-dev-remove,#btn-dev-move-up,#btn-dev-move-down,.studio-editor [data-command],.dev-btn,.port,.port-icon,[data-port-id],#btn-inventory-import,#btn-import-json-3d';
  function set(mode) {
    if (!labels[mode]) throw new Error('Geçersiz çalışma görünümü.');
    if (mode===current) return;
    const active=document.activeElement;
    if (current==='design' && mode!=='design') beforeField={left:document.getElementById('sidebar-left')?.classList.contains('collapsed'),right:document.getElementById('sidebar-right')?.classList.contains('collapsed')};
    current=mode; document.body.dataset.workflow=mode; document.body.classList.toggle('field-mode',mode==='field');
    const select=document.getElementById('workflow-mode'); if(select)select.value=mode;
    const field=document.getElementById('btn-field-mode'); field?.setAttribute('aria-pressed',String(mode==='field')); field?.classList.toggle('active',mode==='field');
    if(mode==='design' && beforeField){window.setLeftSidebarCollapsed?.(beforeField.left);window.setRightSidebarCollapsed?.(beforeField.right,false);beforeField=null;}
    else if(mode==='field'){window.setLeftSidebarCollapsed?.(true);if(!window.matchMedia('(max-width:1023px)').matches)window.setRightSidebarCollapsed?.(false,false);}
    else if(mode==='presentation'){window.setLeftSidebarCollapsed?.(true);window.setRightSidebarCollapsed?.(true,false);}
    updateStatus();
    if(active && (active.closest('.sidebar-left,.studio-editor') || active.closest(editing))) document.getElementById('btn-tools-menu-toggle')?.focus();
    RS.WorkflowSelection?.refresh(); document.dispatchEvent(new CustomEvent('rackstudio:workflow',{detail:{mode}})); window.dispatchEvent(new Event('resize'));
  }
  function blocked(){window.UIActions?.notify('Düzenlemek için Tasarım veya Saha görünümüne geçin.');}
  function init(){
    document.body.dataset.workflow=current;
    const save=document.getElementById('studio-save');if(save)new MutationObserver(updateStatus).observe(save,{childList:true,subtree:true,characterData:true});
    document.getElementById('workflow-mode')?.addEventListener('change',e=>set(e.target.value));
    document.addEventListener('click',e=>{if(current==='presentation' && e.target.closest(editing)){e.preventDefault();e.stopImmediatePropagation();blocked();}},true);
    document.addEventListener('keydown',e=>{
      if(current!=='presentation' || e.target.closest('input,textarea,select,[contenteditable=true]'))return;
      if(['Delete','Backspace','ArrowUp','ArrowDown'].includes(e.key) || ((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase()))){e.preventDefault();e.stopImmediatePropagation();blocked();}
    },true);
    document.addEventListener('pointerdown',e=>{if(current==='presentation' && e.target.closest('.mounted-device,#studio-multiselect-pill')){e.stopImmediatePropagation();}},true);
  }
  RS.WorkflowViews=Object.freeze({set,get:()=>current,canEdit:()=>current!=='presentation'});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
