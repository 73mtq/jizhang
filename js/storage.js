const TOKEN_KEY = 'jizhang_token';
const GIST_ID_KEY = 'jizhang_gist_id';
const GIST_FILENAME = 'jizhang-data.json';
const API = 'https://api.github.com';

function headers(token) {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };
}

export const storage = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  getGistId() {
    return localStorage.getItem(GIST_ID_KEY);
  },

  setGistId(id) {
    localStorage.setItem(GIST_ID_KEY, id);
  },

  isConnected() {
    return !!(this.getToken() && this.getGistId());
  },

  async loadData() {
    const token = this.getToken();
    const gistId = this.getGistId();
    if (!token || !gistId) return null;

    try {
      const resp = await fetch(`${API}/gists/${gistId}`, {
        headers: headers(token)
      });
      if (!resp.ok) {
        if (resp.status === 404) {
          this.setGistId('');
          return null;
        }
        throw new Error(`HTTP ${resp.status}`);
      }
      const gist = await resp.json();
      const file = gist.files[GIST_FILENAME];
      if (!file) return null;
      return JSON.parse(file.content);
    } catch (e) {
      console.error('Load failed:', e);
      return null;
    }
  },

  async saveData(data) {
    const token = this.getToken();
    const gistId = this.getGistId();
    if (!token) return false;

    const body = JSON.stringify({
      description: '记账本数据',
      public: false,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(data, null, 2)
        }
      }
    });

    try {
      const url = gistId ? `${API}/gists/${gistId}` : `${API}/gists`;
      const method = gistId ? 'PATCH' : 'POST';
      const resp = await fetch(url, {
        method,
        headers: headers(token),
        body
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const gist = await resp.json();
      if (!gistId) {
        this.setGistId(gist.id);
      }
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      return false;
    }
  },

  async testConnection(token) {
    try {
      const resp = await fetch(`${API}/gists`, {
        headers: headers(token)
      });
      if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };
      await resp.json();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async findExistingGist(token) {
    try {
      const resp = await fetch(`${API}/gists?per_page=100`, {
        headers: headers(token)
      });
      if (!resp.ok) return null;
      const gists = await resp.json();
      const found = gists.find(g =>
        g.files && g.files[GIST_FILENAME] && !g.public
      );
      return found ? found.id : null;
    } catch {
      return null;
    }
  }
};
