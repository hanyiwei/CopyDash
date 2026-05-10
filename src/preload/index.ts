import { contextBridge, ipcRenderer } from 'electron';

const allowedInvoke = [
  'db:getAll', 'db:updatePin', 'db:deleteById', 'db:clearAll',
  'db:settings:get', 'db:settings:set',
  'clipboard:writeText', 'clipboard:writeAndPaste',
  'app:getVersion', 'shell:openExternal',
  'setting:setAutoLaunch', 'shortcut:update',
  'update:check', 'update:download', 'update:quit-and-install', 'update:getStatus',
  'menu:showContext',
];

const allowedOn = [
  'new-clip', 'window-shown', 'window-hide-start', 'window-focus',
  'shortcut-changed', 'update:status', 'menu-action',
];

const allowedSend = ['window:hide', 'renderer-log'];

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: any[]) => {
    if (!allowedInvoke.includes(channel)) {
      console.error('[Preload] Blocked invoke:', channel);
      return Promise.reject(new Error(`Channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, func: (...args: any[]) => void) => {
    if (!allowedOn.includes(channel)) {
      console.error('[Preload] Blocked on:', channel);
      return () => {};
    }
    const subscription = (_event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  send: (channel: string, ...args: any[]) => {
    if (!allowedSend.includes(channel)) {
      console.error('[Preload] Blocked send:', channel);
      return;
    }
    ipcRenderer.send(channel, ...args);
  },
});
