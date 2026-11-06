// src/services/MqttService.ts
// FIXED: Now subscribes to BOTH tv/{id}/command AND tv/{id}/announcement
// So announcements arrive in real-time via MQTT (not just 60s polling)

import { ENV } from './api';

export type MqttCommand = 'true' | '1' | 'reload' | string;
type CommandListener       = (command: MqttCommand) => void;
type StatusListener        = (connected: boolean) => void;
type AnnouncementListener  = (announcement: any) => void;

// No hardcoded fallback hosts — MQTT host comes entirely from .env
// (LOCAL_MQTT_HOST, or the hostname parsed out of LOCAL_API_URL/PROD_API_URL).
const getMqttHosts = (): string[] => {
  const hosts = new Set<string>();
  if (ENV.MQTT_HOST && ENV.MQTT_HOST.trim()) hosts.add(ENV.MQTT_HOST.trim());
  for (const url of ENV.API_URLS) {
    try {
      const match = url.match(/https?:\/\/([^:/]+)/);
      if (match && match[1]) hosts.add(match[1]);
    } catch (_) {}
  }
  return Array.from(hosts).filter(h => h.length > 0);
};

class MqttServiceClass {
  private client: any        = null;
  private tvId: number       = -1;
  private dbName: string     = '';
  private connected: boolean = false;
  private commandListeners:      CommandListener[]      = [];
  private statusListeners:       StatusListener[]       = [];
  private announcementListeners: AnnouncementListener[] = [];
  private reconnectTimer: any  = null;
  private hostIdx: number      = 0;
  private hosts: string[]      = [];

  init(tvId: number, dbName: string): void {
    this.tvId   = tvId;
    this.dbName = dbName;
    this.hosts  = getMqttHosts();
    this.hostIdx = 0;
    console.log(`[MQTT] Will try hosts: ${this.hosts.join(', ')}`);
    this._connect();
  }

  private _connect(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

    if (!this.hosts || this.hosts.length === 0) {
      console.warn('[MQTT] No hosts available — retrying in 10s');
      this.reconnectTimer = setTimeout(() => {
        this.hosts = getMqttHosts();
        this._connect();
      }, 10000);
      return;
    }

    try {
      const Paho     = require('paho-mqtt');
      const clientId = `TV_${this.tvId}_${Date.now()}`;
      const host     = this.hosts[this.hostIdx % this.hosts.length];
      const port     = ENV.MQTT_PORT || 9001;
      const user     = ENV.MQTT_USER || '';
      const pass     = ENV.MQTT_PASS || '';

      if (!host || host.trim() === '') {
        this.hostIdx = (this.hostIdx + 1) % Math.max(this.hosts.length, 1);
        this.reconnectTimer = setTimeout(() => this._connect(), 3000);
        return;
      }

      // console.log(`[MQTT] Connecting → ws://${host}:${port}/mqtt`);
        console.log(`[MQTT] Connecting → wss://${host}:${port}/mqtt`);
      this.client = new Paho.Client(host, Number(port), '/mqtt', clientId);

      this.client.onConnectionLost = (res: any) => {
        console.log('[MQTT] Connection lost:', res.errorMessage);
        this.connected = false;
        this._notifyStatus(false);
        this.hostIdx = (this.hostIdx + 1) % this.hosts.length;
        this.reconnectTimer = setTimeout(() => this._connect(), 5000);
      };

      this.client.onMessageArrived = (msg: any) => {
        const topic   = msg.destinationName;
        const payload = msg.payloadString?.trim() || '';

        // Command topic: tv/{id}/command
        if (topic === this._topic('command')) {
          const cmd = payload.toLowerCase();
          console.log('[MQTT] Command:', cmd);
          this.commandListeners.forEach(l => l(cmd));
        }

        // Announcement topic: tv/{id}/announcement
        if (topic === this._announcementTopic()) {
          console.log('[MQTT] Announcement received');
          try {
            const ann = JSON.parse(payload);
            this.announcementListeners.forEach(l => l(ann));
          } catch (e) {
            console.warn('[MQTT] Failed to parse announcement:', e);
          }
        }

        // Global announcements broadcast: announcements/{dbName}
        if (topic === `announcements/${this.dbName}`) {
          console.log('[MQTT] Global announcement received');
          try {
            const ann = JSON.parse(payload);
            this.announcementListeners.forEach(l => l(ann));
          } catch {}
        }
      };

      const Paho2   = require('paho-mqtt');
      const willMsg = new Paho2.Message('OFFLINE');
      willMsg.destinationName = this._topic('status');
      willMsg.qos = 1; willMsg.retained = true;

      const opts: any = {
        keepAliveInterval: 60,
        cleanSession: false,
        timeout: 8,
        // useSSL: false,
          // useSSL: true,
                  useSSL: ENV.MQTT_SSL,
        willMessage: willMsg,
        onSuccess: () => {
          console.log(`[MQTT] Connected ✅ → ${host}:${port}`);
          this.connected = true;
          this._notifyStatus(true);
          if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

          // Subscribe to command topic
          this.client.subscribe(this._topic('command'), { qos: 1 });

          // FIX: Subscribe to per-TV announcement topic
          this.client.subscribe(this._announcementTopic(), { qos: 0 });

          // FIX: Subscribe to global broadcast announcement topic
          this.client.subscribe(`announcements/${this.dbName}`, { qos: 0 });

          this._publish(this._topic('status'), 'ONLINE', true);
        },
        onFailure: (err: any) => {
          console.warn(`[MQTT] Failed on ${host}: ${err.errorMessage}`);
          this.connected = false;
          this._notifyStatus(false);
          this.hostIdx = (this.hostIdx + 1) % this.hosts.length;
          this.reconnectTimer = setTimeout(() => this._connect(), 3000);
        },
      };

      if (user) { opts.userName = user; opts.password = pass; }
      this.client.connect(opts);

    } catch (e: any) {
      console.warn('[MQTT] Init error:', e?.message || e);
      this.hostIdx = (this.hostIdx + 1) % Math.max(this.hosts.length, 1);
      this.reconnectTimer = setTimeout(() => this._connect(), 5000);
    }
  }

  publishStatus(status: 'ONLINE' | 'OFFLINE'): void { this._publish(this._topic('status'), status, true); }
  publishCompleted(): void { this._publish(this._topic('completed'), 'true', false); }

  private _publish(topic: string, payload: string, retained: boolean): void {
    if (!this.client || !this.connected) return;
    try {
      const Paho = require('paho-mqtt');
      const msg  = new Paho.Message(payload);
      msg.destinationName = topic; msg.qos = 1; msg.retained = retained;
      this.client.send(msg);
    } catch (e) { console.warn('[MQTT] Publish failed:', e); }
  }

  private _topic(type: 'command' | 'status' | 'completed'): string {
    return `tv/${this.tvId}/${type}`;
  }

  private _announcementTopic(): string {
    return `tv/${this.tvId}/announcement`;
  }

  onCommand(l: CommandListener): void { if (!this.commandListeners.includes(l)) this.commandListeners.push(l); }
  removeCommandListener(l: CommandListener): void { this.commandListeners = this.commandListeners.filter(x => x !== l); }
  onConnectionChange(l: StatusListener): void { if (!this.statusListeners.includes(l)) this.statusListeners.push(l); }
  onAnnouncement(l: AnnouncementListener): void { if (!this.announcementListeners.includes(l)) this.announcementListeners.push(l); }
  removeAnnouncementListener(l: AnnouncementListener): void { this.announcementListeners = this.announcementListeners.filter(x => x !== l); }
  private _notifyStatus(c: boolean): void { this.statusListeners.forEach(l => l(c)); }
  isConnected(): boolean { return this.connected; }

  disconnect(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.commandListeners = []; this.statusListeners = []; this.announcementListeners = [];
    if (this.client) {
      try { if (this.connected) { this.publishStatus('OFFLINE'); this.client.disconnect(); } } catch (_) {}
      this.client = null;
    }
    this.connected = false;
  }
}

export const MqttService = new MqttServiceClass();