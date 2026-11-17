class EventBus {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
  }

  emit(event, payload) {
    if (!this.events[event]) return;
    this.events[event].forEach((fn) => fn(payload));
  }
}

export const eventBus = new EventBus();