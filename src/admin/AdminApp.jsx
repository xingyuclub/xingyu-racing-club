import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { getConfig, login, logout } from './adminApi.js';
import { ConfigEditor } from './ConfigEditor.jsx';
import './admin.css';

const REMEMBER_KEY = 'xingyu-admin-remember';

function loadRememberedCredentials() {
  try {
    const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null');
    if (saved && typeof saved.username === 'string' && typeof saved.password === 'string') {
      return saved;
    }
  } catch { /* ignore malformed storage */ }
  return null;
}

export default function AdminApp() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [remember, setRemember] = useState(false);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const saved = loadRememberedCredentials();
      if (saved) {
        setCredentials(saved);
        setRemember(true);
      }
      try {
        const current = await getConfig();
        if (active) setConfig(current);
      } catch (next) {
        if (next.status !== 401 || !saved) return;
        try {
          await login({ username: saved.username, password: saved.password });
          if (active) setConfig(await getConfig());
        } catch {
          if (active) setError('账号或密码错误');
        }
      }
    };
    restore();
    return () => { active = false; };
  }, []);

  const signIn = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await login(credentials);
      if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify(credentials));
      else localStorage.removeItem(REMEMBER_KEY);
      setConfig(await getConfig());
    }
    catch (next) { setError(next.status === 401 ? '账号或密码错误' : next.message); }
    finally { setBusy(false); }
  };
  const expire = (next) => {
    if (next.status === 401) { setConfig(null); setError('登录状态已失效，请重新登录'); return true; }
    return false;
  };

  if (!config) return <main className="admin-login"><form onSubmit={signIn}><h1>星屿配置后台</h1>{error && <p className="admin-error">{error}</p>}<label>账号<input value={credentials.username} onChange={(e) => setCredentials({ ...credentials, username: e.target.value })} /></label><label>密码<input type="password" value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} /></label><label className="admin-remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />记住密码</label><button disabled={busy}>登录</button></form></main>;

  return <main className="admin-page"><header><div><h1>星屿配置后台</h1><p>保存后，前台刷新即可看到最新内容</p></div><button className="icon-command" title="退出登录" onClick={async () => { await logout().catch(() => {}); setConfig(null); }}><LogOut size={18} />退出</button></header><ConfigEditor initialConfig={config} onAuthError={expire} /></main>;
}
