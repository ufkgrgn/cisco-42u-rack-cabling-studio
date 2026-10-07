export function initWorkflowSelection(studio){
  for(const [method,kind]of [['selectDevice','device'],['deselectDevice','device'],['selectCable','cable']]){
    const original=studio[method];
    studio[method]=function(...args){const result=original.apply(this,args);document.dispatchEvent(new CustomEvent('rackstudio:selection',{detail:{kind,id:method==='deselectDevice'?null:args[0],source:'3d'}}));return result;};
  }
  for(const method of ['addDevice','removeDevice','moveDevice','connectPorts','removeCable']){
    const original=studio[method];if(!original)continue;
    studio[method]=function(...args){if(window.RackStudio.WorkflowViews?.canEdit()===false){this.showToast('Düzenlemek için Tasarım veya Saha görünümüne geçin.');return false;}return original.apply(this,args);};
  }
}
