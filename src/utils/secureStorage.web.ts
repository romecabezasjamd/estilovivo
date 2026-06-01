export class SecureStorageWeb {
  async getItem(options: { key: string }) {
    const value = window.localStorage.getItem(options.key);
    return { value };
  }

  async setItem(options: { key: string; value: string }) {
    window.localStorage.setItem(options.key, options.value);
    return {};
  }

  async removeItem(options: { key: string }) {
    window.localStorage.removeItem(options.key);
    return {};
  }

  async clear() {
    Object.keys(window.localStorage).forEach(key => {
      if (key.startsWith('secure:')) {
        window.localStorage.removeItem(key);
      }
    });
    return {};
  }
}
